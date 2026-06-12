# 10 — Latency, availability & cost

*Below 100 ms a tap feels instant; past 1 second, patience ends. Fast, up and affordable are three budgets someone else fixed — this chapter teaches you to spend them.*

## The question this chapter answers

Rungs 1 through 4 of [the Ladder](../part-1-foundations/04-the-ladder.md) measure how *big* a system is. This chapter measures whether it's any *good*: will it be fast enough, up enough, and affordable? These three estimations separate senior candidates from everyone else, because they're the questions a system's owner actually loses sleep over. A mid-level candidate proves the design can be built; a senior candidate proves it can be operated — inside a latency budget, an error budget and a dollar budget — and says which of the three is tightest.

The good news: all three run on the same kind of arithmetic, and you already own every number they need.

## From first principles

A budget is a total fixed from *outside* the system, plus rules for how parts consume it. That is exactly the structure of all three quality estimations:

| Budget | The total is fixed by | In series | In parallel |
|---|---|---|---|
| Latency | human perception: 100 ms, 1 s | latencies **add** | take the **max**, plus a merge |
| Availability | the SLA you signed | availabilities **multiply** | failure rates multiply — in your favor |
| Cost | a finance line | line items **add** | still adds — redundancy is a line item |

So each estimation is the same three moves: name the total (it is never yours to choose — neurons, contracts and CFOs choose it), walk the design applying the composition rule, and find the dominant consumer. You are not sizing anything on this rung; you are auditing. Notice also the trades hiding in that table: the replication that buys availability appears on the cost budget; the hedging that trims tail latency doubles a request's compute. The three budgets pay each other's debts, and saying which one you're spending on whose behalf is what architecture sounds like.

## Latency budgets

A batsman facing a fast bowler gets ~500 ms of ball flight — see it, decide, swing. The total is fixed by physics, the phases must fit inside it, and every extra millisecond spent reading the ball is stolen from the swing. Latency budgets work exactly like that: top-down from a fixed total, never bottom-up from what your components happen to take. Bottom-up budgets always pass — every component swears its milliseconds are necessary. Top-down budgets are the only ones that can say no.

The total comes from the canon's two human thresholds: **100 ms feels instant; 1 s is where patience ends**. For an interactive API — a tap that should still feel immediate after the client renders — take **200 ms p99 end-to-end** as the default target: double the instant line, leaving the client room to paint, and a fifth of the patience line. It's a choice, so state it as one.

Why p99 and not the average? p50 is the typical request; p99 is the one-in-a-hundred request. [Chapter 5](05-traffic.md)'s food-delivery user fired ~100 API calls a day — at that rate the "rare" p99 is a daily event for every single user, and your heaviest users eat it most often.

Now spend the 200 ms. First subtract what you don't control — the client's round trip to your edge, 50 ms on the same continent — then divide the remainder across the hops you do control:

| Leg | p99 allowance | Where the number comes from |
|---|---|---|
| Client → edge, one RTT | 50 ms | canon same-continent round trip — not yours to optimize |
| TLS handshake | 0 ms warm; +50 ms cold | one extra RTT; keep-alive makes warm the norm |
| LB + in-DC routing | 2 ms | a few 0.5 ms same-DC round trips |
| Service work | 20 ms | an allocation you choose: parse, logic, serialize |
| Cache legs — 2 Redis GETs | 1 ms | 2 × 0.5 ms |
| DB leg — 2 indexed queries | 10 ms | 2 × 5 ms |
| **Typical path** | **≈ 85 ms** | well under half the budget |
| **Tail headroom** | **≈ 115 ms** | queueing, GC, retries, the cold TLS |

Notice the shape. The typical path spends well under half the total, and that headroom is not slack to grow into — it is what absorbs the p99 events the budget is named for. A budget whose typical-path latencies already sum to the target is blown before launch.

Two structural rules govern the spending. **Sequential calls add; parallel calls cost the max, plus a merge you pay in CPU.** Chattiness is death by addition: ten sequential downstream calls at ~20 ms each is 200 ms — the entire budget gone on hop count while every individual hop looks innocent. An ORM lazily issuing ten indexed queries burns 10 × 5 ms = 50 ms — a third of the server side — inside one loop. The same ten calls issued in parallel cost ~20 ms plus the merge. The *shape* of the call graph, not the speed of its nodes, decides whether the budget survives — which is why "how many round trips?" is a sharper design review question than "how fast is the service?"

Then there's the cross-region tax. Canon prices an India ↔ US East round trip at 250 ms. Derive the rule instead of memorizing it: the interactive budget is 200 ms end-to-end, so a single synchronous cross-continent call — 250 ms of pure RTT before any work happens — exceeds the whole budget on its own. No tuning on either side fixes this; the ocean does not refactor. Even against the 1 s patience line, three such round trips cost 750 ms and leave scraps for actual work, so a chatty ten-call conversation across continents is 2.5 s of raw RTT — dead twice over. The conclusion is forced, not asserted: interactive paths get **zero** cross-continent round trips — replicate data into the user's region or take the dependency off the synchronous path — and even patient paths get one, which means batching the whole conversation into a single trip.

Finally, the tail's revenge on fan-out. Suppose each backend leg is slow — at or beyond its own p99 — 1% of the time, independently. Fan a request out across n legs in parallel and the request is slow whenever *any* leg is:

```
P(request hits a slow leg) = 1 − 0.99^n
n = 10   →  1 − 0.90 ≈ 10%
n = 100  →  1 − 0.37 ≈ 63%        (0.99^100 ≈ 1/e)
```

At 100-way fan-out, the per-leg p99 has become the request-level *median* — most requests now contain a tail event. Wide fan-outs make the tail the median. Hedged requests and strict per-leg timeouts aren't sophistication; they are the only exits this arithmetic leaves open.

## Availability arithmetic

The nines, from the canon, read not as grades but as **error budgets** — time you are allowed to spend:

| Nines | Downtime/year | Downtime/month |
|---|---|---|
| 99% | 3.7 days | 7.3 h |
| 99.9% | 8.8 h | 44 min |
| 99.99% | 53 min | 4.4 min |
| 99.999% | 5.3 min | 26 s |

99.9% means 44 minutes a month to spend on everything that goes wrong: deploys (a bad one that takes ten minutes to roll back just spent a quarter of the month), incidents, and — the part candidates miss — your dependencies' downtime, which drains your budget whenever they sit on your serial path.

**Series multiplies.** A request that must traverse gateway → auth → service → database → payment provider succeeds only if all five do, so availabilities multiply — and while failure rates are small, the unavailabilities simply add:

```
five dependencies at 99.9%:  5 × 0.1% = 0.5% unavailable
(0.999)^5 ≈ 99.5%
0.5%/month: canon prices 1% (99%) at 7.3 h → half of that ≈ 3.7 h/month
```

Five well-run three-nines services, chained, are a two-and-a-half-nines system. You cannot offer more nines than your weakest serial chain allows — an SLA is a product, not a max, and every synchronous dependency you add moves it the wrong way.

> ⚡ **Instinct check** — Your checkout synchronously calls a payment provider with a 99.9% SLA, and marketing wants to promise 99.99%. What's wrong, in one line? … You'd be promising to spend 4.4 min/month while one dependency alone is licensed to spend 44.

**Parallel multiplies failures instead.** Put two boxes behind a load balancer where either can serve, and the system fails only when both do — `1 − (1−a)²`. Two unremarkable 99% boxes:

```
1 − (0.01)² = 1 − 0.0001 = 99.99%
```

Two nines each, four nines together. Redundancy is the only move in this book that multiplies small numbers *in your favor*, which is why it's the cheapest availability money can buy — and why everything ships in threes: the third box exists for the hour when one is deliberately down for a deploy and your pair has quietly become a single ([Machines & shards](09-machines-and-shards.md) prices the threes out).

One honest caveat before you promise anyone anything: the formula assumes failures are **independent**, and most real failures aren't. The same bad config push reaches both replicas; the same AZ floods both racks; the same certificate expires everywhere at midnight. Correlated failure collapses `1 − (1−a)²` back toward plain `a` — two replicas of the same bad binary are one replica. This is why real systems earn fewer nines than the arithmetic promises, and why the actual engineering work is manufacturing independence: spread AZs, stagger deploys, canary first.

## Cost

A chaiwala runs his stall with no spreadsheet, yet he knows exactly which item pays the rent — the chai is volume, but some quiet line on the menu carries the margin. That instinct — *which line dominates the bill* — is the entire skill of cost estimation. The canon gives you the unit prices:

| Item | Cost | Reflex |
|---|---|---|
| Compute | ~$30 per vCPU-month | the 32-core box ≈ **$1k/month** |
| Object storage (S3-class) | ~$20 per TB-month | storage is cheap |
| Block SSD storage | ~$100 per TB-month | 5× object storage |
| Egress to internet | ~$100 per TB | egress runs the bill |
| CDN delivery, at volume | ~$30 per TB | why CDNs exist |
| Managed service | ~2× equivalent compute | the convenience tax |
| One engineer, fully loaded | ~$15k/month | the build-vs-buy unit |

And the pocket formula:

```
monthly cost ≈ boxes × $1k + TB stored × $20 + TB egress × $100
```

Run it once over any design, then sniff for the four smells:

- **Egress-heavy.** Storage is rent; egress is a toll paid on every trip. A stored TB costs $20 a month to keep but $100 every time the internet reads it in full — so for anything media-shaped, delivery dwarfs storage and the design conversation belongs on the delivery path.
- **Hot-storing cold data.** Block SSD at $100/TB-month versus object storage at $20 is a 5× tax on bytes nobody queries — and logs compress ÷10 on top. Tiering isn't a late optimization; at PB scale it is most of the bill.
- **Many small boxes vs a few big ones.** At ~$30 per vCPU-month, slicing changes nothing: thirty-two 1-vCPU boxes and one 32-core box are the same ~$1k. What moves the bill is utilization — a fleet idling at 10% pays ten boxes' rent for one box's work. (You already size at 60%: canon's ÷0.6.)
- **Managed tax vs ops time.** Managed runs ~2× raw compute. Convert the premium into engineer-fractions before flinching: a managed database with a $5k/month premium that replaces half an engineer of care ($7.5k) is *free*. The $15k engineer is the unit that decides build-vs-buy more often than any hardware number does.

> 🎯 **In the room** — Never end a cost estimate at the total. The architect sentence is: name the dominant line item, then the lever. "Order of $800k a month, ninety percent of it CDN egress — so the leverage is the delivery path: cache hit ratio, bitrate defaults, and at this scale maybe owning it." A total is accounting; the dominant term plus a plan is architecture.

## 🧮 Worked example — the podcast bill, and the build-vs-buy moment

[Chapter 4](../part-1-foundations/04-the-ladder.md)'s podcast platform climbed to 10 TB/day of provisioned storage and 800 TB/day of egress. Put prices on it:

```
storage:  10 TB/day × 365 ≈ 3.5 PB by year one
          3,500 TB × $20/TB-month             ≈ $70 k/month
egress:   800 TB/day × 30 ≈ 24 PB/month
          raw:  24,000 TB × $100/TB           ≈ $2.4 M/month   non-starter
          CDN:  24,000 TB × $30/TB            ≈ $700 k/month   the real bill
compute:  API tier + one SQL node, a few boxes ≈ noise
```

The bill is ~$800k a month and ~90% of it is one line. Now the senior move — read that line in engineer units: $700k/month ÷ $15k ≈ the cost of **45 engineers**, paid to a CDN, every month. That is the build-vs-buy moment. A ten-engineer delivery team costs $150k/month; if owning the delivery path could shave even a third off the per-TB price — an assumption, so say it out loud — that's ~$230k/month saved against $150k spent. At this scale, building is genuinely on the table, which is exactly why the biggest streaming platforms run their own delivery networks.

Run the same sketch at a hundredth the scale and the answer flips: a $7k/month CDN bill cannot fund half an engineer, so you buy and spend the meeting on something else. The threshold isn't a constant to memorize — it sits wherever the managed premium clears the cost of the team that would replace it, plus the honesty that ops is forever, not a project.

## The anchors

| Anchor | Value | Use it when |
|---|---|---|
| Human thresholds | 100 ms instant; 1 s patience line | setting any user-facing budget |
| Default interactive target | 200 ms p99 end-to-end — an assumption, state it | starting a budget |
| Latency composition | series **add**; parallel = **max** + merge | reading any call graph |
| Cross-continent round trip | 250 ms | any cross-region dependency |
| Fan-out tail | 1 − 0.99^n; n = 100 → ~63% | scatter-gather designs |
| Error budget at 99.9% | 44 min/month | SLO conversations |
| Availability composition | series multiply (small failures add); parallel 1 − (1−a)² | promising an SLA |
| The bill | boxes × $1k + TB stored × $20 + TB egress × $100 | rung 5, every time |
| Build-vs-buy unit | engineer ≈ $15k/month | any managed-vs-self argument |

Everything here is [cheat-sheet](../appendices/a-cheat-sheet.md) canon except the 200 ms target, which is a defensible default you state and let the interviewer adjust.

## ⚠️ Traps

- **Adding sequential p99s and calling the sum your p99.** Every hop hitting its worst centile on the same request is a near-impossible conjunction, so the sum overshoots reality. As a budget that's fine — conservative is what budgets are for; just say "conservative." As a *prediction* of measured p99 it's wrong, too scary, and will have you overbuilding.
- **Spending the whole budget on the typical path.** If the p50s sum to the target, the p99 is already gone. Healthy budgets leave roughly half the total as tail headroom.
- **Promising more nines than your serial chain allows.** 99.99% on top of one synchronous 99.9% dependency promises 4.4 minutes a month while licensing 44. Multiply the chain first; promise second.
- **Quoting a bill without its dominant term.** "$800k a month" is trivia; "$800k, 90% egress, here's the delivery lever" is design. A cost number that doesn't name its biggest line changes no decision.
- **Forgetting the last mile.** Your dashboard's 40 ms is measured from the load balancer; the user's thumb is 50 ms away before TLS even starts. End-to-end budgets begin at the thumb — subtract the client RTT before allocating a single millisecond to servers.

## Numbers to keep

- 100 ms feels instant; 1 s ends patience — every latency budget descends from these two
- Series adds, parallel takes the max plus a merge — chattiness is death by addition
- One cross-continent round trip (250 ms) outspends an entire 200 ms interactive budget by itself
- Fan-out tail: 1 − 0.99^n — at n = 100, the leg p99 reaches ~63% of requests; hedging and timeouts exist because of this line
- 99.9% = 44 min/month of error budget; serial chains multiply (small failures add), parallel redundancy gives 1 − (1−a)² — *if* failures are independent
- Monthly bill ≈ boxes × $1k + TB stored × $20 + TB egress × $100; CDN $30/TB; engineer $15k/month
- Never report a total without its dominant term and the lever you'd pull on it

## Drills

**Drill 10.1** — Decompose a 300 ms p99 budget for a search call: client on the same continent, a gateway, parallel fan-out to 20 index shards, merge and rank, snippet fetch from cache. Where does the budget go?

<details><summary>Answer</summary>

```
budget, end to end                       300 ms
client → edge RTT                        −50 ms
server side                              250 ms
  gateway + in-DC hops                     2 ms
  query parse                             20 ms
  scatter to 20 shards (parallel: max)    50 ms
  merge + rank                            30 ms
  snippets: 2 cached GETs                  1 ms
typical path ≈ 50 + 103                ≈ 155 ms
tail headroom                          ≈ 145 ms
```

The fan-out is parallel, so 20 shards cost one max-leg, not twenty sums — breadth is nearly free; the sequential stages (parse → scatter → merge) are what add. But 20 legs at 1% slow each means 1 − 0.99^20 ≈ 18% of searches contain a tail shard — that is what the 145 ms of headroom and per-shard timeouts are for.
</details>

**Drill 10.2** — Your request path chains four services, each honestly running at 99.9%. What availability can you promise customers?

<details><summary>Answer</summary>

```
unavailability: 4 × 0.1% = 0.4%  →  (0.999)^4 ≈ 99.6%
downtime: 0.4% of a month ≈ 0.4 × 7.3 h ≈ 3 h/month
```

Promise 99.5%, not 99.9%: the chain alone spends ~3 h of the ~3.7 h that 99.5% allows, leaving ~45 min for your own bugs. To promise more, shorten the chain (collapse hops) or make legs redundant so they compose in parallel — an SLA is a property of the architecture, not of ambition.
</details>

**Drill 10.3** — A recommendation service fans out to 50 feature stores in parallel; each is slow 1% of the time. What fraction of requests ride the tail — and how slow-proof must each leg become for the *request* to be slow only 1% of the time?

<details><summary>Answer</summary>

```
P(slow) = 1 − 0.99^50 ≈ 1 − 0.61 ≈ 40%
target:  1 − (1−x)^50 = 1%  →  50x ≈ 1%  →  x ≈ 0.02%
```

Two in five requests hit a slow leg. To pull the request tail back to 1%, each leg may be slow only 0.02% of the time — 50× tighter, the fan-out factor exactly. Nobody ships feature stores that reliable, so you cap the damage instead: per-leg timeouts with defaults, hedged duplicates for stragglers, or a smaller n.
</details>

**Drill 10.4** — An analytics platform ingests 50 TB/day of raw logs, retained one year, queried only internally (no egress). Sketch the monthly bill and name the dominant term.

<details><summary>Answer</summary>

```
compress logs ÷10:       5 TB/day stored
one year live:           5 TB/day × 365 ≈ 1.8 PB
object storage:          1,800 TB × $20/TB-month ≈ $36 k/month
hot tier, last 7 days:   35 TB × $100/TB-month   ≈ $3.5 k/month — noise
ingest + query boxes:    ~20 × $1k               ≈ $20 k/month
the naive version:       18 PB raw on block SSD × $100 ≈ $1.8 M/month
```

~$60k/month, dominant term storage — and the dominant *decision* is policy, not purchasing: compression (÷10) and tiering ($100 → $20) swing this bill 50× between the naive and the sane version. The architect sentence: "the bill is storage; compress at ingest, land on object storage, keep one week hot."
</details>

**Drill 10.5** — You need a message queue of ~4 brokers. Managed or self-run? Decide with the engineer number, then redo the decision at 100× scale.

<details><summary>Answer</summary>

```
self-run:  4 boxes ≈ $4 k/month + ~half an engineer of care ≈ $7.5 k → ~$11.5 k/month
managed:   ~2× compute = $8 k/month, ops ≈ 0
at 100×:   self: 400 boxes = $400 k + 3-engineer team $45 k ≈ $445 k/month
           managed: ≈ $800 k/month → building saves ~$355 k/month ≈ 24 engineers
```

At 4 brokers, buy: the $4k premium is cheaper than the half-engineer it replaces. At 400, build — *if* you have the platform muscle, because the saving only materializes while the 3-engineer team stays 3. The decision flips wherever the managed premium crosses the cost of the team that would replace it.
</details>

---
[← Previous: Machines & shards](09-machines-and-shards.md) · [Table of contents](../../README.md) · [Next: URL shortener →](../part-3-walkthroughs/11-url-shortener.md)
