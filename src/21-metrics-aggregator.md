# 21 — Metrics aggregator

*The mirror image of every content system in this book: machines write everything, humans read almost nothing — rollups are the architecture, and cardinality is the bomb.*

## The prompt

> "Design a monitoring system — a Datadog-lite — for a company running 100,000 servers. Start with metrics."

This is the pipeline [chapter 11](11-url-shortener.md) deferred when the click stream outgrew the shortener. Every walkthrough so far served people reading what machines stored. This one inverts that, and every reflex you've built inverts with it — which is exactly why interviewers use it to close out a loop.

## Scope it in 60 seconds

Three questions change the numbers.

1. **Metrics only?** Logs and traces are different systems wearing the same dashboard — logs alone multiply the bytes ~200× (drill 21.1). Get them out of scope explicitly.
2. **How far back do dashboards scroll?** "Forever" and "at full detail" cannot both be true. Propose recent-at-full-detail, history-at-coarse-detail and get the nod — that sentence will become the storage design.
3. **How fresh must alerts be?** "About a minute" is the usual answer, and it decides whether alerting reads precomputed rollups or the raw stream. (It returns in the pushback round.)

Assume: metrics only, coarse history is acceptable, ~1-minute alerting.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| Fleet | 100 k hosts | given in the prompt |
| Metrics per host | ~100, emitted every 10 s | agent defaults — CPU, memory, disk, network, per-service counters — land near 100 |
| Data point on the wire | ~50 B | metric-id hash 8 B + timestamp 8 B + value 8 B, plus host/tag references and envelope → round to 50 |
| Engineers | ~10 k | ~10 hosts per engineer is normal at this scale |
| Dashboards | ~1 k, auto-refreshing every minute | roughly one per team and service, refreshing unattended |
| Alert rules | ~10 k, evaluated every minute | about one rule per 1 k series worth watching |
| Peak factor | ×1.5 | machines don't sleep — argued at rung 2 |

## Rung 1 — Users

For once the demand isn't people. The writers are 100,000 machines; the 10,000 engineers are the read side, and they barely register. Same move the URL shortener pulled with links: keep the rung, swap the noun. State the base in the system's native unit — hosts × metrics per host — and get the nod, because metrics-per-host is the assumption everything below scales with: 100 is agent-default territory, while a container-heavy shop can run 300+.

## Rung 2 — Actions (traffic)

```
ingest: 100 k hosts × 100 metrics ÷ 10 s = 1 M points/s sustained
peak:   1 M × 1.5                        ≈ 1.5 M points/s
```

Defend the deviation before it's poked: the canon's ×3 peak is diurnal — humans sleeping. Machines don't, so ingest is flat around the clock, and what spikes it is deploy storms and incident restarts — half the fleet re-registering at once — which ×1.5 covers. Reads do swing with humans:

```
reads: 1 k dashboards × ~10 charts + 10 k alert rules, each per minute
     = 20 k queries/min ÷ 60 ≈ 300 queries/s
```

Even a ×10 incident spike — every engineer storming the dashboards at once — is 3,000 queries/s, still two and a half orders below writes. Panicked humans cannot out-traffic machines. The ratio that *is* this chapter:

```
writes : reads = 1 M : 300 ≈ 3,000 : 1 → call it 1,000:1, generous to reads
```

The news feed ([chapter 12](12-news-feed.md)) was 100:1 read-heavy; this is 1,000:1 write-heavy — the same asymmetry, mirrored and an order more extreme. (The canon files telemetry at ~1:1 because every point *is* read once — by the rollup pipeline, machine-to-machine; against human queries it's 1,000:1.) Interpretation, one sentence: optimize the write path raw, and precompute everything the read path will ever ask.

## Rung 3 — Bytes (storage & bandwidth)

```
wire: 1 M points/s × 50 B = 50 MB/s — under half of one 1 Gbps port
day:  50 MB/s × 10^5 s    = 5 TB/day raw
```

Say which dimension binds, because here it's unusual: the bytes are modest, but a million discrete points a second is an enormous *operation* rate. This system is ops-bound, not byte-bound — hold that for rung 4. Storage is another story.

> ⚡ **Instinct check** — 5 TB/day kept forever: how much after a year?

```
5 TB/day × 365 ≈ 2 PB/year — unbounded, and unqueryable at that grain
```

Nobody will ever ask for a 10-second point from last March; questions about last year are trend questions, hourly at best. Make that observation quantitative and it becomes the rollup ladder:

| Tier | Resolution | Kept | Logical bytes |
|---|---|---|---|
| Raw | 10 s | 15 days | 5 TB/day × 15 ≈ 75 TB |
| Rollup | 1 min (÷6 points) | 13 months | ≈ 330 TB |
| Rollup | 1 hour (÷360 points) | forever | ≈ 5 TB/year |

```
1-min:  5 TB/day ÷ 6   ≈ 800 GB/day × 400 days ≈ 330 TB
1-hour: 5 TB/day ÷ 360 ≈ 14 GB/day × 365 days  ≈ 5 TB/year
```

Immortal history at hourly grain costs 5 TB a year — keeping it forever is a rounding error, and saying so out loud is the point. Then compression: metric streams are deltas of deltas — timestamps tick every 10 s exactly, values barely move — so Gorilla-style delta-of-delta encoding earns the canon's ÷10 logs ratio, applied to telemetry:

```
hot raw tier: 75 TB ÷ 10 ≈ 7.5 TB → call it 10 TB of hot data
```

Retention policy × resolution ladder just turned 2 PB/year into ~10 TB hot plus a few hundred cold TB, near-flat forever. The rollup ladder is this system's load-bearing wall. A national census works the same way: millions of enumerator sheets nobody will ever re-read individually; districts get tables, the nation gets one headline number. The whole apparatus exists to roll detail *up* — the sheets go to a warehouse, the tables live on every desk.

### The cardinality bomb

Storage was the easy bomb. The live one: a **series** is one metric × one unique tag combination, and the index — the thing that turns a query into the right data — holds one entry per live series.

```
100 k hosts × 100 metrics = 10 M series
× ~1 KB per index entry (the canon row default) = 10 GB → fits RAM, fine
```

Now one engineer, mid-debug, adds a `user_id` tag to one request-latency metric:

```
10 M users × that metric's 10–100 existing tag combos = 100 M – 1 B new series
× 1 KB ≈ 0.1 – 1 TB of index
```

The index leaves RAM, shards, and every query now fans out across the shards. Note what *didn't* move: a tagged point is still ~50 B, so data volume barely changed. The system dies of keyspace explosion, not byte explosion.

> ⚠️ **Trap** — computing storage and declaring victory. Bytes are the question you were asked; keys are the question that pages you.

The fix isn't hardware — it's governance: tag allow-lists, per-team cardinality budgets, ingest-time rejection of unbounded tags. A social fix to an arithmetic problem, and the estimate is how you justify the policy *before* the outage instead of in its postmortem.

> 🎯 **In the room** — raising cardinality unprompted is the strongest production signal this interview can emit. Engineers who have run a metrics system carry this scar; engineers who have only read about them don't.

## Rung 4 — Machines (cache, servers, shards)

**Ingest gateways.** Points never travel alone — agents buffer and ship one batch per 10 s:

```
batched:   100 k hosts ÷ 10 s = 10 k POSTs/s of ~100-point batches
           light parse-and-enqueue → 10 k ÷ 10 k trivial ÷ 0.6 ≈ 2 → run 4–5
unbatched: 1 M POSTs/s ÷ (1 k typical … 10 k trivial) ÷ 0.6 ≈ 170 – 1,700 → call it 500
```

Five gateways or five hundred: batching is the whole game on a write path, because per-point cost vanishes when amortized across a batch. Say that sentence — it is this rung's interpretation.

**The bus.**

```
50 MB/s ÷ 100 MB/s per Kafka broker = 1 broker by bytes
× 3 replication + partition headroom for consumers ≈ 6 brokers
```

**Time-series store (TSDB), write path.** Two numbers, both out loud:

```
naive: 1 M points/s ÷ 10 k LSM writes/s/node = 100 nodes
real:  same-series points batch into appends → ~50 – 100 k points/s/node
       1.5 M peak ÷ 75 k ≈ 20 primaries → × 3 replication ≈ 30 – 60 → call it 50
```

The canon's 10 k ceiling prices *independent row-writes*; a metrics store appends many points to few series — sequential, compressed, batched — and appends buy roughly 10×. Showing both numbers and naming the gap beats quietly using either. Each node then holds ~10 TB ÷ 20 ≈ 500 GB of hot data — NVMe yawns. The shard count came from write ops, not bytes; saying which is the senior tell.

**Query and alert tier.** 300 queries/s of typical work over precomputed rollups → 300 ÷ 1 k ÷ 0.6 ≈ 1 → run 3–4. Notice there is no Redis in this story: the read path's cache *is* the rollups, computed at write time. The RAM citizen here is the series index, and rung 3 already sized it.

## Rung 5 — Money

```
boxes:   ~5 gateways + 6 brokers + ~50 TSDB + 4 query ≈ 65 × $1 k ≈ $65 k/month
hot SSD: 10 TB × 3 replication = 30 TB × $100           ≈ $3 k/month
cold:    ~350 TB object store × $20  (uncompressed — conservative) ≈ $7 k/month
total:                                                  ≈ $75 k/month → the $50–80 k band
per host: $75 k ÷ 100 k hosts                           ≈ $0.75/host/month
```

A metrics SaaS runs ~$15+/host/month — $1.5 M/month for this fleet, a ~20× spread. Before gloating, add the canon's engineer: a 5-person team to build and run this costs 5 × $15 k = $75 k/month — the people equal the hardware. All-in build ≈ $150 k versus $1.5 M buy: still ~10× at 100 k hosts. So derive the line instead of declaring a religion:

```
buy = build:  $15 × N hosts ≈ $75 k team + ~$0.75 × N
              N ≈ 5,000 hosts
```

Below ~5–10 k hosts the team alone costs more than the SaaS — buy. At 100 k hosts the gap is ~$16 M/year and funds the team many times over — build. The spread is real at every scale; only after the people are priced in does the answer become a fleet-size threshold instead of an opinion.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 1 M writes/s vs ~300 reads/s (≈1,000:1) | optimize the write path; precompute the read path — rollups computed at ingest, not at query |
| 5 TB/day raw → ~2 PB/year naive | the retention ladder *is* the storage design: 15 d raw / 13 mo 1-min / hourly forever |
| ÷10 delta-of-delta compression → ~10 TB hot | the hot tier fits a small SSD cluster; history lives in cheap object storage |
| 10 M series = 10 GB index; one unbounded tag → 0.1–1 TB | cardinality governance — tag allow-lists, per-team budgets — enforced at ingest |
| 100 write nodes naive vs 10–20 real | LSM engine + per-series append batching; sized by ops, not bytes |
| $0.75 vs ~$15/host/month, crossover ~5–10 k hosts | a numeric build-vs-buy line you can defend to a CFO |

## The pushback round

**Interviewer:** "Your alerts evaluate every minute. Product wants 5-second alerting on everything. What breaks?"

**You:** "Two things, one structural. Volume first: 10 k rules every 5 s is 2 k evaluations/s, up from ~170 — a 12× jump, but that's just boxes. The structural break: at 5-second freshness the 1-minute rollups are useless, so every rule must read the raw hot path — exactly the path I've spent the whole design protecting from reads. For rules that genuinely need it, I'd flip evaluation from query-time to ingest-time: streaming evaluation, where the rule runs as an operator on the stream while points flow past — no query at all. Then I'd push on 'everything': how many of the 10 k rules actually page a human? Maybe 100. Those get 5-second streaming — 100 ÷ 5 s = 20 evaluations/s, trivial. The rest fill dashboards and tickets and stay at a minute."

**Interviewer:** "Product insists all ten thousand are critical."

**You:** "Then I'd put both bills on the table — streaming state for 10 k raw-resolution windows sitting on the ingest path, versus two tiers — and ask them to defend rule number 7,000. Nobody ever does. Uniform requirements are how systems get gold-plated; tiering the requirement is usually the design."

## Say it in 60 seconds

> "Let me put numbers on it. A hundred thousand hosts, a hundred metrics each, every ten seconds — a million points a second, sustained; machines don't sleep, so peak is only ×1.5, from deploy storms rather than dinnertime. Points are ~50 bytes, so 50 megabytes a second — half a gigabit port — but 5 terabytes a day: bytes are fine, point count is the problem. Reads are a thousand dashboards and ten thousand alert rules per minute — about 300 queries a second. That's a thousand-to-one write-heavy, the news feed mirrored, so I optimize the write path and precompute the read path. Storage is a rollup ladder: 10-second raw for 15 days is 75 TB — about 10 compressed; 1-minute for 13 months, ~330 TB cold; hourly forever at 5 TB a year — immortal history is a rounding error. Machines: agent batching makes ingest a handful of gateways instead of five hundred; the store is 10 to 20 append-optimized write nodes, not the naive hundred — call it 60-odd boxes, ~$75 k a month, 75 cents a host against ~$15 SaaS, so building wins above roughly five thousand hosts once the team is priced in. The number that worries me is none of these — it's cardinality: 10 million series is a 10 GB index, and one unbounded tag makes it a terabyte. So the design ships with a tag budget enforced at ingest."

## Numbers to keep

- 100 k hosts × 100 metrics ÷ 10 s = 1 M points/s; peak ×1.5 — machines don't sleep
- 1 M writes/s vs ~300 reads/s ≈ 1,000:1 — the news feed's 100:1, mirrored
- 50 B/point → 50 MB/s → 5 TB/day raw: ops-bound, not byte-bound
- Rollup ladder: 15 d raw ≈ 75 TB / 13 mo 1-min ≈ 330 TB / hourly forever ≈ 5 TB/yr; ÷10 compression → ~10 TB hot
- 10 M series × 1 KB = 10 GB index; one unbounded tag → 0.1–1 TB — governance, not hardware
- Naive 100 write nodes vs real 10–20: batched appends buy ~10× over row-writes
- ~$0.75/host/month built vs ~$15 bought; crossover ≈ 5–10 k hosts with the team priced in

## Drills

**Drill 21.1** — Logs join the party: the same 100 k hosts each emit ~100 log lines/s at ~1 KB per line. Recompute the pipeline. Which dimension flips?

<details><summary>Answer</summary>

```
rate:  100 k × 100      = 10 M lines/s               (10× the metric points)
bytes: 10 M/s × 1 KB    = 10 GB/s                    (200× the metric bytes)
day:   10 GB/s × 10^5 s = 1 PB/day raw — vs 5 TB/day for metrics
÷10 log compression     ≈ 100 TB/day — one compressed day of logs > two weeks of raw metrics
```

The binding dimension flips: metrics were ops-bound (a million tiny points, bytes trivial); logs are bytes-bound (rate only 10× higher, bytes 200×). So-what: the architectures diverge — metrics engineering fights per-point overhead and cardinality, log engineering fights tonnage — which is why log systems lean on compression, days-not-months hot retention, and sampling, and why log SaaS prices per GB while metrics SaaS prices per host. Same fleet, different bomb.
</details>

**Drill 21.2** — The org mandates per-customer SLO dashboards for its 10 k customers. An engineer proposes adding a `customer_id` tag to the ~10 core request metrics. Do the cardinality math, then ship the feature anyway.

<details><summary>Answer</summary>

```
naive tag: 10 metrics × ~1 k existing combos (host × endpoint) × 10 k customers
         = 100 M new series × 1 KB ≈ 100 GB of index — 10× today's entire index
```

The naive tag *multiplies* dimensions. The fix makes the new dimension *replace* the old ones: aggregate across hosts and endpoints at ingest, into a dedicated per-customer rollup —

```
fix: 10 metrics × 10 k customers = 100 k series ≈ 1% of today's index
```

So-what: cardinality bombs are cross-products, and the defusal is routing the new dimension into a purpose-built aggregate instead of the shared index. Governance isn't "no" — it's "not in the index." The feature ships; the cross-product doesn't.
</details>

**Drill 21.3** — Retention audit. Leadership asks: "Why can't we keep 10-second data for 5 years?" Price it, then give the better reason.

<details><summary>Answer</summary>

```
5 TB/day × 365 × 5 ≈ 9 PB logical → ÷10 compression ≈ 900 TB
900 TB × $20/TB-month ≈ $18 k/month by year 5 — affordable, annoyingly
```

So cost alone won't win the argument. The better reason: the resolution is unusable at that span. Five years at 10 s is 5 × 3 × 10^7 s ÷ 10 s ≈ 15 M points per series, and a dashboard line is ~1,000 pixels wide — every 5-year query must collapse ~15,000 points per pixel, meaning the query engine rebuilds the hourly rollup on every read, slowly, forever. You'd pay to store detail no screen can render, then pay again to aggregate it away per query. So-what: the rollup ladder isn't a cost dodge — it matches stored resolution to answerable questions. Keep raw for the 15-day window where 10-second detail changes decisions, and spend the $18 k/month on something that does.
</details>
