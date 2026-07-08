# 27 — Ad click & impression aggregation

*A write-heavy firehose feeding two masters — a dashboard that forgives a rounding error and an invoice that forgives nothing — where the cheapest byte is the one you agree not to keep.*

## The prompt

> "Design real-time aggregation of ad impressions and clicks. It has to feed an advertiser dashboard and the billing system. Assume a large network — order 100 billion impressions a day. Put numbers on it first."

Every previous product in this part had a read problem wearing a storage costume. This one is the opposite: a telemetry firehose where writes are the entire event, reads are an afterthought, and the design question is not "how do I serve this fast" but "how do I avoid keeping most of it." The 100-billion figure is handed to you on purpose — it is large enough that the naive move (store the events, scan them for the dashboard) is dead on arrival, and the round is graded on how fast you see the corpse.

## Scope it in 60 seconds

Three questions change the numbers; the second changes the architecture.

1. **Bill on clicks or on impressions — CPC or CPM?** This decides which event carries the exactly-once tax. Clicks are ~1000× rarer than impressions, so deduping clicks is cheap and deduping impressions means deduping the firehose itself. Assume the exact billable event is the **click** (CPC), with CPM priced as the harder variant when it comes up. Get it on record — it sizes the entire billing path.
2. **Two freshness numbers, not one: how fresh must the dashboard be, and how fast must a spent budget stop serving ads?** These are different SLAs on the same data. Say the interviewer answers "dashboard within a minute, budget enforcement within a few seconds." That split *is* the two-path design — flag it now, it returns at the end as the reason the system forks.
3. **How long must raw events live, and for whom?** Dispute, fraud review, and reprocessing want the raw log; analytics only ever wants the rollups. Resolve: **raw kept ~7 days**, rollups kept long (per-minute for 90 days, per-day effectively forever). This single answer is what makes the storage bill survivable.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| Impressions | 100 B/day | given — ad-network scale |
| Click-through rate | ~0.1% → 100 M clicks/day | industry standard; impressions dwarf clicks ~1000:1, the fact the whole chapter turns on |
| Active campaigns | ~1 M | millions of advertisers, ~1 M campaigns live at once — this sets rollup cardinality |
| Impression event | ~1 KB | canon log line: ad / campaign / user ids, timestamp, geo, device, placement |
| Rollup row | ~100 B | ~a dozen 8 B fields: key (campaign, time bucket, dims) + counters (impressions, clicks, spend) |
| Dedup key | 16 B UUID | canon — one per billable event, for exactly-once |
| Dashboard tolerance | **±1%** | **the load-bearing assumption — approximate is fine for the eye, exact only for the invoice** |
| CPM | ~$2 | industry-ish; enters only at the money rung — stated out loud |
| Peak factor | ×3 | global network, diurnal — canon global peak |

## Rung 1 — Users

This system has two populations, and like the rate limiter its top rung is inherited, not proposed. The **write side** is not humans at all — it is an ad-serving fleet emitting 100 B impressions a day, demand you are handed rather than derive. The **read side** is advertisers: ~1 M active campaigns, each owner glancing at a dashboard maybe 10 times a day.

State both dimensions, because the rungs below eat one each: **rate** — 100 B impressions/day, the firehose — and **cardinality** — ~1 M campaigns, the number of buckets the firehose collapses into. Rate drives the machines; cardinality drives the storage.

Interpret: the two populations are separated by four orders of magnitude — a million writes a second against a hundred reads a second. This is not a content system with a read problem. It is telemetry, and the whole game is on the write side.

## Rung 2 — Actions (traffic)

Split writes from reads, as always — except here the split is the punchline.

```
WRITES (the firehose)
impressions: 100 B/day ÷ 10^5 s = 1,000,000/s avg   → ×3 = 3,000,000/s peak
clicks:      100 M/day ÷ 10^5 s =     1,000/s avg   → ×3 =     3,000/s peak

READS (dashboards)
queries: 1 M campaigns × 10/day = 10 M/day ÷ 10^5 = 100/s avg → ×3 = 300/s peak
```

Interpret: read:write is ~100 : 1,000,000 — roughly **1:10,000**, inverted from every content system in this book. The canon's ~1:1 for telemetry is about raw event I/O; here even that understates it, because the reads aren't raw events, they're aggregates computed once and served cheap. There is no read path to cache your way out of. **Writes are the wall, and the wall is 1 M/s.**

And notice the click-to-impression gap: 3,000 clicks/s against 3,000,000 impressions/s. The billable events are a thousandth of the firehose — which is exactly why scope question 1 mattered.

### The signature sub-question — how much does the raw firehose weigh, and can you ever scan it?

The tempting design is the one every candidate reaches for: land the events in a store, and when the dashboard asks "how did campaign X do today," scan them. Price that instinct before you commit to it.

> ⚡ **Instinct check** — 100 billion impressions a day at ~1 KB each, replicated and provisioned. How many days of raw events fill a petabyte? Answer before reading on.

```
raw logical:      100 B events/day × 1 KB = 100 TB/day
× 5 (replication + overhead, if kept hot & queryable) = 500 TB/day provisioned
→ a petabyte every TWO days; one year = 180 PB
```

One hundred and eighty petabytes a year, and every dashboard query is a full-day scan across it. **The store-and-scan design is dead** — not slow, not expensive, dead: you cannot hold it and you could not query it if you did.

Now the toll plaza on the national highway. The lane sensor clicks once per axle, all day, millions of clicks — that is the firehose. Two people want those numbers and they want them completely differently. The control-room screen wants a live "roughly how heavy is traffic through Gate 4 right now" — a sensor estimate, nobody audits it to the car. The concessionaire's accountant wants every toll reconciled to the last rupee at month-end — exact, and a day late is fine. And nobody keeps a photograph of every car for a year: the plaza holds the raw lane-tape for a week in case of a dispute, then shreds it, carrying forward only the hourly and daily totals in the ledger. **Same clicks, two ledgers with opposite tolerances, and the raw stream is a cost you shed, not an asset you hoard.** That is this entire system.

So you don't store and scan — you **stream and roll up**. Aggregate the firehose in flight into progressively coarser buckets, and query the buckets:

```
per-minute:  1 M campaigns × 1,440 buckets/day × 100 B ≈ 150 GB/day
per-hour:    1 M         ×    24            × 100 B ≈ 2.5 GB/day
per-day:     1 M         ×     1            × 100 B ≈ 100 MB/day
```

The collapse, said explicitly:

```
raw            100 TB/day
per-minute     150 GB/day   → ~700×   smaller than raw
per-day        100 MB/day   → ~10^6×  smaller than raw
```

Interpret: the dashboard never touches raw. Its entire dataset is the per-minute rollup, ~700× lighter than the firehose that produced it, and the per-day roll is a millionth. **The rollup is not an optimization; it is the only version of this data a query can survive.** The forced move is a Kafka-class bus in front, rollup workers behind, and raw kept only long enough to replay.

## Rung 3 — Bytes (storage & bandwidth)

Two tiers, because the scope forced them: raw (cold, brief) and rolled (hot, long).

**Raw tier** — cold object storage, 7-day retention, and impression logs are the most compressible bytes there are (repeated ids, dictionary-friendly):

```
100 TB/day logical  ÷10 (logs compress hard)      = 10 TB/day
× 1.5 (object store, erasure-coded — NOT ×5)      = 15 TB/day provisioned
× 7 days                                          ≈ 100 TB resident
```

Interpret: the whole raw firehose, tiered correctly, is ~100 TB of cold storage — a rounding error. The 180 PB monster of the last rung only exists if you keep raw hot and forever, which is precisely what you refuse to do.

**Rollup tier** — hot, queryable, replicated (×5), summed over its retention:

```
per-minute × 90 days:  150 GB × 90  = 13 TB × 5 ≈ 65 TB
per-hour   × 1 year:    2.5 GB × 365 =  1 TB × 5 ≈  5 TB
per-day    × 10 years:  100 MB × 3,650 ≈ 360 GB × 5 ≈ 2 TB
                                       rollup total ≈ 70 TB
```

Interpret: the entire queryable surface of a 100-billion-a-day ad network is ~70 TB. It fits in a modest sharded cluster. The finest grain (per-minute) dominates it — hold that thought for the drills.

**Dedup tier (exactly-once, billing path).** Money must be exact, so every billable event carries a UUID and duplicates are rejected inside a window:

```
CPC — dedup clicks:      100 M/day × 16 B, 24 h window ≈ 1.6 GB    → fits in RAM
CPM — dedup impressions: 100 B/day × 16 B, 24 h window ≈ 1.6 TB/day → a real, sharded store
```

Interpret: the exactly-once tax is set by the **billable event, not the traffic**. Bill on clicks and dedup is a gigabyte you hold in a single Redis. Bill on impressions and you must dedup the firehose itself — a thousand times heavier. This is why scope question 1 was load-bearing.

**Bandwidth.** Ingress is the firehose: 1 GB/s average, 3 GB/s peak (computed above). Egress is dashboards serving aggregates:

```
300 reads/s × ~10 KB (a dashboard's worth of rollup rows) ≈ 3 MB/s
```

Interpret: 3 MB/s against a 1.25 GB/s port. Unlike a video system, **egress is a rounding error; the entire bandwidth story is ingress.** Nobody ever fights the read side here.

## Rung 4 — Machines (cache, servers, shards)

**The bus (Kafka).** The firehose must land on a durable log before anything aggregates it:

```
1 GB/s avg ÷ 100 MB/s per broker      = 10 brokers of raw throughput
× 3 replication (billing-grade log)   ≈ 30 brokers avg
peak 3 GB/s                           → ~90 brokers
```

Interpret: order 30 brokers steady, provisioned toward 90 for peak — and replication factor, not raw throughput, is what triples the fleet. Run the billing topic at ×3 and you could carry the pure-analytics feed at ×2, but say the multiplier out loud; it is half the broker count.

**Rollup workers.** They consume the firehose and combine by key in memory before writing — this is where the firehose gets tamed:

```
consume: 3,000,000/s peak ÷ ~100k events/worker ÷ 0.6 ≈ 50 workers
emit:    1 M campaigns re-flushed per minute = 1 M ÷ 60 ≈ 17,000 upserts/s
```

Interpret: the workers absorb 3 M reads/s off the bus and emit only ~17k writes/s to the rollup store — the same collapse the storage numbers showed, now in throughput. **Aggregation is the pressure valve: 3 million events in, seventeen thousand upserts out.**

**Rollup store.** Size by the max of the two pressures:

```
by writes: 17,000/s ÷ 10,000 TPS (NoSQL LSM node) ≈ 2 nodes
by bytes:  70 TB ÷ 2 TB/node                       ≈ 35 shards
```

Interpret: **bytes force the sharding, not writes** — the firehose was already digested upstream, so 35 shards exist to hold 90 days of per-minute rows, not to absorb throughput. Shard by campaign id, which is also the dashboard's query key.

**The two counters, forked by tolerance.** The stream feeds two very different sinks:
- **Budget counter (approximate, fast).** A running per-campaign spend total on the stream, so ad serving can stop within seconds. Redis INCR, fed by the workers' per-few-second flushes → well under 100k ops/s → 1–2 nodes.
- **Billing ledger (exact, slow).** The deduped, reconciled count, replayable from the 7-day raw log, that produces the invoice. It can lag hours; correctness is the only SLA.

> 🎯 **In the room** — What forked this system was **±1%**, a business number, exactly like the rate limiter's ±5%. There is a 2×2 hiding here: exact-vs-approximate crossed with fast-vs-slow. Billing is exact+slow, the budget gate is approximate+fast, the dashboard is approximate+medium — and the one quadrant nobody asked to buy is exact+fast, which is the most expensive corner in distributed systems. The senior move is to ask "which number gets audited, and by whom?" before drawing a box. A candidate who makes everything exact is paying, a billion times a day, for a precision only the monthly invoice ever needed.

## Rung 5 — Money

```
compute:  ~30 brokers + 50 workers + 35 rollup + 5 counters ≈ 120 boxes × $1k ≈ $120k/month
storage:  raw    100 TB × $20/TB  (object, cold)          ≈ $2k
          rollup  70 TB × $100/TB (block SSD, hot)        ≈ $7k   → ~$9k
egress:   trivial
                                                        total ≈ $130k/month
```

Now the counterfactual, which is where the money lesson actually lives:

```
raw kept hot & queryable for a year: 180 PB × $20/TB-month ≈ $3.6 M/month
                                     — and unqueryable at any price
rollups + tiered raw (the storage line above): ≈ $9k, call it ~$10k
```

Interpret: rolling up turns a **$3.6M-a-month unqueryable swamp into ~$10k of queryable truth** — a **~360× storage saving** (3.6M ÷ 10k) that also happens to be the only version you can serve. The architecture is a storage-cost decision as much as a latency one.

And the cost of lag, which sizes the budget SLA:

```
network spend: 100 B/day × $2 CPM = $200 M/day ≈ $2,000/s
```

Interpret: at $2,000/s of live spend, every second the stop-serving counter lags is real money the network eats on campaigns already over cap — which is why the budget gate rides the stream at seconds while billing reconciles slowly. Lag on the dashboard costs an apology; lag on the budget costs cash.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 180 PB/year of raw if kept hot | store-and-scan is dead — you must stream-aggregate, not query events |
| raw 100 TB/day vs per-minute 150 GB/day (~700×) | the dashboard queries rollups; raw exists only to replay |
| 1 M writes/s in → 17k upserts/s out | rollup workers are the pressure valve; the firehose never reaches the DB |
| rollup store 70 TB → 35 shards by bytes | shard for retention, not throughput — the opposite of a write-bound system |
| dedup: 1.6 GB (CPC) vs 1.6 TB/day (CPM) | the billable event, not the traffic, sizes exactly-once — pick it in scope |
| ±1% dashboard tolerance | fork the pipeline: approximate+fast for eyes and budgets, exact+slow for invoices |
| $2,000/s of spend, seconds of enforcement lag | the budget counter rides the stream; billing may lag hours |

## The pushback round

**Interviewer:** "Why not count exactly everywhere and delete the approximate path? One number is simpler than two."

**You:** "Exactly-once on a 1-million-a-second firehose means a synchronous dedup check on every event — 1.6 TB/day of keys under CPM, and worse, the ingest rate is now capped by the dedup store's write ceiling instead of Kafka's bandwidth. You'd throttle a 3 GB/s firehose to make a chart a human reads to one significant figure. The approximate path removes the dedup entirely: sample, or use probabilistic counters, and land the dashboard within ±1%. Exactness is a cost I pay only where money changes hands — on the clicks, in the billing ledger, not on the impressions feeding a graph."

**Interviewer:** "So an advertiser's dashboard says 1.00 million clicks and the invoice says 0.99 million. That's a support ticket."

**You:** "It's a *published* tolerance, not a bug. Dashboards are sampled and eventually consistent to within a percent; the invoice is the reconciled exactly-once count and it always wins. The senior mistake is forcing the two to match — that buys strict consistency on a billion events a day to satisfy a glance. I'd make the disagreement a documented SLA and let the numbers differ by design."

**Interviewer:** "And a mobile click that arrives four hours late, after your rollups have closed that minute?"

**You:** "That's exactly why raw lives seven days. The rollups are a cache — disposable, rebuildable; the raw log is the ledger. Late events replay against raw with a watermark, the billing count corrects, and the affected rollup buckets are recomputed. The dashboard may never even notice, and that's fine — it was approximate by contract. **Approximate for the eye, exact for the invoice, and raw as the replayable ledger behind both** — the retention window isn't storage policy, it's the correction window for money."

## Say it in 60 seconds

> "Numbers first, because here they kill the obvious design. A hundred billion impressions a day is a million a second, three million peak; clicks at a tenth of a percent are only a thousand a second — impressions dwarf clicks a thousand to one. Dashboard reads are a hundred a second, so this is telemetry, not content: writes are the wall and there's nothing to cache. The killer number is raw storage — a hundred terabytes a day, a petabyte every two days, a hundred and eighty petabytes a year if you kept it hot, and every dashboard query would scan a full day of it. So you can't store and scan — you stream and roll up: per-minute buckets are a hundred and fifty gigs a day, seven hundred times lighter, and that's all the dashboard ever touches. Workers eat three million events a second off a thirty-broker Kafka and emit seventeen thousand upserts — the firehose never reaches the database. Then you fork on tolerance: exact, deduped, replayable billing on the clicks — a gigabyte of dedup keys — and an approximate running spend counter on the stream so a spent budget stops serving within seconds, because at two thousand dollars a second of spend, lag is cash. Keep raw seven days as the replayable ledger, rollups long. About a hundred and thirty grand a month, and rolling up saved three and a half million. The number that worries me is a hundred and eighty petabytes of raw a year that no query can touch — so I'd design the streaming rollups and the retention tiers first."

## Numbers to keep

- 100 B impressions/day = 1 M/s avg, 3 M/s peak; 100 M clicks/day = 1k/s, 3k peak — impressions dwarf clicks ~1000:1
- Firehose bytes: 1 GB/s avg, 3 GB/s peak → ~10 brokers of throughput, ~30 with ×3 replication
- Raw: 100 TB/day logical; **180 PB/year if kept hot — impossible**; keep raw 7 days compressed ≈ 100 TB cold
- Per-minute rollup 150 GB/day = ~700× lighter than raw; per-day 100 MB/day = ~10^6× lighter
- Rollup store over retention ≈ 70 TB → ~35 shards, **bytes force it, not writes**
- Workers: 1 M/s in → 17k upserts/s out — aggregation is the pressure valve
- Dedup: CPC 1.6 GB (RAM) vs CPM 1.6 TB/day — the billable event sizes exactly-once
- Budget lag costs money: $2,000/s of spend; stop-serving rides the stream, billing reconciles slow
- Three consumers, two tolerances: dashboard + budget approximate, billing exact; raw is the replayable ledger

## Drills

**Drill 27.1** — The network switches from CPC to CPM: it now bills per impression, not per click. What changes in the exactly-once path?

<details><summary>Answer</summary>

```
CPC dedup: 100 M clicks/day × 16 B, 24 h ≈ 1.6 GB       → one Redis, in RAM
CPM dedup: 100 B impr/day  × 16 B, 24 h ≈ 1.6 TB/day    → 1000× heavier
```

The billable event moved from the 3k/s trickle to the 3M/s firehose, so exactly-once now taxes ingestion itself: you cannot hold 1.6 TB of keys in one node, and a synchronous dedup on every impression caps the firehose at the dedup store's write ceiling. Options: shard the dedup keyspace, or accept a probabilistic filter (Bloom/Cuckoo) with a bounded false-duplicate rate and reconcile against raw. So what: **the billable event, not the traffic volume, sizes the exactly-once machinery** — a one-line billing-model change is a 1000× infrastructure change, which is why it belongs in the first 60 seconds of scoping.
</details>

**Drill 27.2** — A campaign with a $50k daily budget burst-spends during the evening peak. If the stop-serving counter lags 30 seconds, how much can it overspend — and why does one campaign's number not matter?

<details><summary>Answer</summary>

```
spend rate: $50k over the ~8 busy hours (3×10^4 s) ≈ $1.5/s, call it ~$2/s at burst
30 s lag:   $2/s × 30 s ≈ $60 overspend — for ONE campaign
but at peak, 10,000 campaigns hit their cap in the same window:
            10,000 × $60 = $600k of unbillable overspend on one 30-second lag
```

One campaign's $60 is lunch money; the network's *simultaneous* cap-hits turn lag into a six-figure leak. So what: this is why the budget gate is a separate fast-approximate counter riding the stream at seconds, not the exact-but-late billing tally — enforcement latency is priced in aggregate overspend, and that price sets the SLA. Tighten the tolerance and you push the counter closer to the stream; loosen it and you save nodes.
</details>

**Drill 27.3** — Product wants per-minute rollups retained for 2 years instead of 90 days. New storage, and the fix?

<details><summary>Answer</summary>

```
per-minute × 730 days: 150 GB × 730 = 110 TB × 5 ≈ 550 TB
                       vs 90-day: ~65 TB → ~8× the rollup store, ~275 shards
```

Retention on the *finest* grain dominates everything — the per-minute tier is 60× heavier than per-hour and 1,440× heavier than per-day, so keeping it for 2 years is almost the whole bill. The fix is that the rollup hierarchy is itself a retention tier: **downsample as data ages** — keep per-minute for 90 days, roll it into per-hour beyond that, per-day beyond a year. Nobody queries a single minute from 18 months ago; they query a day. So what: retention isn't "how long do I keep the data," it's "at what grain do I keep it when" — the coarsening schedule bounds the store by construction, exactly as the rollup collapsed the firehose in the first place.
</details>
