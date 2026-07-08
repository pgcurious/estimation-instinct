# 19 — Rate limiter

*A component, not a product: you size for someone else's traffic, your latency taxes every request, and the arithmetic — not taste — picks the algorithm.*

## The prompt

> "Design a rate limiter for our API gateway. It sees 100k QPS at peak."

Everything before this chapter was a product. This is a component, and component estimations invert three habits at once. You don't propose the traffic — you inherit it. Your latency isn't a feature with its own budget — it's a tax levied on every request of the system you serve. And the numbers don't size a design you've already sketched — they *choose the algorithm*. Candidates who run the product playbook here (find users, find QPS, find storage) miss all three inversions, and the interviewer sees it within minutes.

## Scope it in 60 seconds

Three questions change the numbers; the third changes the architecture.

1. **What's a key?** Per-user, per-IP, per-API-key, or all three? This sets key cardinality — the limiter's second dimension of demand.
2. **What latency may I add?** The tax applies to 100% of gateway traffic. "About a millisecond" is a typical answer; hold it as a hard line.
3. **How exact must enforcement be?** Cluster-wide precision, or best-effort within a few percent? This single question will decide the entire topology — flag it, and get the answer on record.

Assume the interviewer answers: per-user and per-IP limits, ~1 ms of added latency allowed, and enforcement within ±5% is acceptable.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| Gateway traffic | 100 k QPS at peak | given — and *peak is already inside it*; components inherit the host's peak factor |
| Distinct active keys | ~10 M/hour (users + IPs) | large public API; proposed, nodded at |
| Limit policy | e.g. 100 req/min per user | typical public-API default; only the window length enters the arithmetic |
| Added latency budget | ~1 ms per request | a tax on everything must stay invisible inside the 100 ms human budget |
| Enforcement tolerance | **±5%** | **the load-bearing assumption — it will pick the architecture by itself** |

> ⚠️ **Trap** — Multiplying 100 k QPS by the ×3 peak factor. The gateway team already did that; re-applying it sizes a limiter for a gateway that doesn't exist. When you inherit traffic, ask whether the number is average or peak — then leave it alone.

## Rung 1 — Users (the host system's traffic)

[Chapter 11](11-url-shortener.md) bent the Ladder's top rung once: demand arrived as links, not people. A component bends it all the way — the rate limiter's "user" is the API gateway itself, and the top rung's question (how much demand, how peaky?) is answered by someone else's traffic graph.

State the base in two dimensions, because the rungs below consume one each: **rate** — 100 k checks/s at peak, since every gateway request consults the limiter before it does anything else — and **cardinality** — ~10 M distinct active keys an hour. Rate will drive ops on rung 2; cardinality will drive memory on rung 3. Holding both, and knowing which rung eats which, is the rung-1 skill for any infrastructure component.

## Rung 2 — Actions (checks per second)

Every other walkthrough split reads from writes here. A limiter check fuses them: read the counter, increment it, atomically or not at all. That fusion is why this rung plays differently — **a counter you cache is a counter you've stopped enforcing** — so there is no read path to offload. Every check hits authoritative state.

```
checks:    100 k/s — one per gateway request, peak included
naive:     read + increment = 2 ops/check         → 200 k ops/s
scripted:  fused into ~1 atomic op (Lua / INCR)   → 100 k ops/s
plan for:  100–200 k ops/s  vs  ~100 k ops/s per Redis node
shards:    2 if scripting lands at one op, 3 with headroom → 2–3, by hash of the key
```

Now the inversion to say out loud: most candidates hear "10 million keys" and reach for memory math. Backwards. **Memory is nothing here; ops are everything** — this is the one walkthrough in the book where the machine count is settled before a single byte has been computed.

## Rung 3 — Bytes (state per key)

Sketch one key's row. The key string — a user id or an IP plus a prefix, a few dozen characters — call it ~50 B, half a canon URL. Add Redis's per-key bookkeeping: a hash-table entry, an object header, allocator padding — a dozen-odd pointers and counters at 8 B each, call it ~100 B. Plus the per-key state itself.

But "per-key state" smuggles in a decision you haven't earned: how big is that state? It depends on the algorithm — and choosing the algorithm is what this estimation exists to do.

### The signature sub-question — which algorithm survives a hot key?

The "most accurate" limiter is a sliding-window **log**: store the timestamp of every request, count how many fall inside the last 60 s. Price it on the key that matters — an abusive client hammering at 10 k QPS, a tenth of the entire gateway:

> ⚡ **Instinct check** — 10 k requests/s × 60 s window, ~20 B per stored timestamp (8 B of time plus member-and-score bookkeeping, charitably). How much memory for that one key? Answer before reading on.

```
10 k/s × 60 s   = 600 k timestamps in the window
600 k × 20 B    ≈ 12 MB — for ONE key
```

Twelve megabytes per hot key — and hot keys are not this system's edge case, **they are its workload**. A rate limiter exists precisely to meet the keys that are hammering you. The sliding log is an algorithm that melts on exactly the input it was hired to handle.

Now price the alternative. A token bucket — or a fixed-window counter — keeps O(1) state per key: a count and a timestamp, two 8 B integers, **16 B regardless of rate**. One request a minute or ten thousand a second: 16 bytes.

```
sliding log, one hot key:  ~12 MB
token bucket, any key:      16 B      — six orders of magnitude apart
```

**Estimation, not preference, picks the token bucket.** That sentence is the chapter. Candidates argue log-versus-bucket as a taste debate about burst semantics; four lines of arithmetic end the debate.

The darshan counter at a busy temple already knows this. It keeps no register of every pilgrim who ever entered — it hands out numbered tokens for each time slot and refuses when the slot runs out. The temple's memory is a stack of tokens, the same size on festival day as on a Tuesday.

**Total memory**, with the algorithm now earned:

```
per key:  ~50 B key + 16 B bucket + ~100 B overhead ≈ 170 B
state:    10 M active keys × 170 B ≈ 1.7 GB → call it 2 GB
```

Two gigabytes — about a fiftieth of one 128 GB box. Say it plainly: **RAM is a rounding error; the shards exist for throughput alone.** In every previous walkthrough, bytes forced the sharding conversation; here bytes barely show up to it. (Bandwidth, for completeness: 100 k checks × ~100 B each way ≈ 10–20 MB/s against a 1 Gbps port's 125 MB/s — say "trivial" and never mention it again.)

## Rung 4 — Machines (topology and the latency tax)

The fleet is small: 3 shards × 2 (primary + replica) = **6 boxes**, plus a client library in every gateway node. The machine question that matters isn't *how many* — it's *where the check happens*.

### The latency tax

A central check is one in-datacenter round trip: ~0.5 ms, on 100% of requests. Inside the 1 ms allowance — but price it at fleet scale:

```
0.5 ms × 100 k req/s = 50 seconds of waiting injected per second
```

Fifty request-seconds of pure waiting, every second: at any instant ~50 requests sit parked mid-air, asking permission. Invisible per request, real in aggregate. And the central store is now a hard dependency, which forces a policy you must name before the incident: **fail-open** — limiter unreachable, let everything through; you stay up, unprotected at exactly the moment overload is likeliest. **Fail-closed** — limiter unreachable, reject everything; the protection becomes the outage. The nines arithmetic ([chapter 10](10-latency-availability-cost.md)) is blunt: a fail-closed limiter at 99.9% sits in series with the gateway — chains in series multiply — so the gateway is capped at 99.9% no matter what else you gold-plate.

### The local-first alternative

Run the token buckets *in-process* on each gateway node; reconcile counts asynchronously in the background. Added latency: ~0 — the check is a main-memory reference, ~100 ns against the 0.5 ms round trip, three-plus orders of magnitude cheaper. The price is accuracy: a key sprayed across N gateway nodes can transiently earn up to N× its limit until the next sync. With sticky routing — hash the key to a preferred node — the spread collapses to failover moments, and the error sits comfortably inside ±5%.

That is the triangle, priced: **central buys accuracy and costs 0.5 ms × everything plus a serial dependency; local-first buys zero latency and no dependency, and costs a few percent of error.** The decision rule: tolerance of a few percent or more → local-first. Strict enforcement — billing, paid quotas, compliance caps → central, and pay the tax knowingly.

> 🎯 **In the room** — Notice what decided the architecture: the ±5%, which is a *business* number, not an engineering one. Pushing the question back up — "how exact do limits have to be, and who needs them exact?" — is the senior move in this interview. A candidate who picks a topology before asking is guessing with confidence.

## Rung 5 — Money

```
limiter:  6 boxes × $1 k                      ≈ $6 k/month
estate:   100 k QPS ÷ 1 k/server ÷ 0.6        ≈ 170 servers ≈ $170 k/month compute
          + managed databases at ~2× compute  → order $500 k/month behind the gateway
```

Six thousand a month guarding half a million a month — the limiter costs ~1% of the fleet it protects. Rate limiting is the cheapest insurance in infrastructure; say that line and move on.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 100–200 k ops/s vs 100 k ops/s per node | shard by key hash — ops force the sharding; bytes never would |
| 2 GB of state vs 128 GB per box | never argue memory; one box holds the keys fifty times over |
| 12 MB per hot key (log) vs 16 B (bucket) | token bucket — O(1) per-key state, chosen by hot-key arithmetic |
| ±5% tolerance | local-first in-process buckets with async sync; central only when tolerance ≈ 0 |
| 0.5 ms × 100 k/s = 50 s of waiting/s | the central tax is real at fleet scale even while invisible per request |
| limiter at 99.9%, in series | fail-open vs fail-closed is an availability decision, made before the incident |

## The pushback round

**Interviewer:** "Your 10 million active keys — what happens when a botnet shows up with 50 million IPs?"

**You:** "Memory first, because it's quick: 50 M × ~170 B ≈ 8.5 GB — still a fraction of one box, so the state doesn't frighten me. The deeper point is that ops scale with *request rate*, not key count: 50 million idle IPs cost nearly nothing, and 50 million IPs actually requesting is my same 100 k QPS wearing more labels. So the attack lands in two places — the ops ceiling, which is the shard count and scales with money, and eviction, which is design. Every counter carries a TTL: idle ten minutes, evicted. That bounds the working set by construction — even if every request carried a never-seen IP, new keys arrive at most at the request rate, so the resident set tops out at 100 k/s × 600 s = 60 M keys ≈ 10 GB. The internet's size never enters the formula."

**Interviewer:** "So the limiter itself can be overwhelmed."

**You:** "Yes, and its ceiling is explicit: 3 nodes × 100 k ops ≈ 300 k checks/s. Past that I shed load *before* the check — static per-node caps as a circuit breaker, or sampled enforcement — because a limiter that needs unlimited capacity to limit things has the problem inverted. Bounding by construction beats bounding by guess."

## Say it in 60 seconds

> "The limiter inherits the gateway's numbers: 100 k checks a second at peak — peak is already in that figure, so I won't multiply again. Each check is a read-plus-increment, scripted into one or two Redis ops: 100–200 k ops a second against a 100 k per-node ceiling, so two to three shards by key hash — sharded by ops, because memory is trivial: 10 million active keys under 200 bytes each is about 2 GB, a fiftieth of one box. Per-key state must be constant-size — a sliding log on one 10 k-a-second hot key is 600 thousand timestamps, megabytes for a single key, and hot keys are exactly the workload — so token bucket, 16 bytes, chosen by arithmetic. Topology hangs on one business number: with ±5% tolerance I run buckets in-process on the gateway nodes, sync asynchronously, and add roughly zero latency; if enforcement must be exact, it's a central check at half a millisecond on every request plus a hard dependency — and we pick fail-open or fail-closed before the incident, not during it. Cost: six boxes, about $6 k a month, insuring a half-million-a-month fleet. The number I'd confirm before drawing anything is the ±5% — it picks the whole architecture."

## Numbers to keep

- Components inherit the host's peak — 100 k QPS arrives pre-multiplied; never re-apply ×3
- A check fuses read and write → nothing to cache; scripted ≈ 1–2 ops → 100–200 k ops/s → 2–3 shards, **by ops**
- Per-key state all-in ≈ 170 B; 10 M keys ≈ 2 GB — RAM is a rounding error here
- Sliding log = rate × window × ~20 B → 12 MB for one hot key; token bucket = 16 B at any rate
- Central check: +0.5 ms on 100% of traffic = 50 s of waiting per second at 100 k QPS
- Tolerance ≥ a few % → local-first buckets; exact (billing, quotas) → central — the business picks the topology
- TTL bounds the working set by construction: rate × TTL = 100 k/s × 600 s = 60 M keys ≈ 10 GB, whatever the internet does

## Drills

**Drill 19.1** — Product changes limits from 100/min to 2,000/day. What changes in per-key state, and what new failure mode appears at midnight?

<details><summary>Answer</summary>

Per-key state: nothing. A bucket is two integers whether the window is a minute or a day — 16 B is rate- and window-independent. Key *lifetime* changes: TTLs must now outlive the day, so the resident set grows from "keys active in the last few minutes" toward "keys seen today" — call it 50 M keys × 170 B ≈ 8.5 GB. Still a fraction of one box.

The new failure is the reset cliff: with a fixed daily window, every capped key's quota refills at the same instant. Users who ran dry at 4 PM all retry at 00:00 — a synchronized release of a day's pent-up demand, a thundering herd the per-minute window was too short to accumulate. A continuously refilling token bucket (2,000 tokens/day ≈ 1.4 tokens dripped per minute) has no reset instant at all. So what: window length is a product decision that changes failure modes, not state size — and continuous refill deletes the midnight cliff by construction.
</details>

**Drill 19.2** — The gateway grows to 1 M QPS. Which design survives unchanged — central or local-first?

<details><summary>Answer</summary>

Central: ops scale linearly — 1–2 M ops/s ÷ 100 k per node ≈ 10–20 shards, ×2 for replicas = 20–40 boxes, a live resharding migration, and the tax grows to 0.5 ms × 1 M/s = 500 seconds of waiting injected per second. It survives, but you rebuild it on the way up.

Local-first: each gateway node still does an in-process, O(1) check. The gateway team scaled their fleet to carry 1 M QPS — and the limiter rode along inside it. Sync traffic grows linearly but stays off the hot path. Local-first survives unchanged. So what: a design that puts the work where the traffic already is inherits the host's scaling for free — the deepest argument for local-first, which the latency numbers only hint at.
</details>

**Drill 19.3** — A paid API tier demands *exact* limits — customers are billed per call over quota. Which architecture, and what latency price?

<details><summary>Answer</summary>

Exact means tolerance ≈ 0, and the decision rule fires: central, atomic check-and-decrement — one scripted op, one shard owning each key — and fail-closed, because you cannot give away quota you bill for; an unreachable limiter must mean reject, so the limiter's nines now multiply into the paid tier's availability in series.

Price: +0.5 ms on every paid-tier request, plus that serial dependency. The senior refinement: pay it only where the business pays you — route the paid tier's keys (a small fraction of traffic) through the central exact path and leave the free tier on local-first ±5%. So what: accuracy is bought per key, not per system — hybrid enforcement gives the business exactness precisely where it's monetized.
</details>
