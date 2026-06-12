# 16 — Ride hailing

*Two million dots moving across every city on Earth, refreshed every four seconds — and the whole map weighs less than your phone's photo roll.*

## The prompt

> "Design Uber. Start with the numbers."

Candidates hear "Uber" and reach for planet-scale machinery: petabytes, thousand-node clusters, the works. The numbers, walked honestly, say something stranger — the business traffic is tiny, the telemetry is a firehose, and the famous live map is a few hundred megabytes. This walkthrough is graded on whether you notice that inversion and let it drive the design, because every interesting decision in a ride-hailing system follows from it.

## Scope it in 60 seconds

Three questions change the numbers.

1. **Is the core matching plus live tracking?** Request a ride, match a driver, watch the car crawl toward you. ETAs and turn-by-turn routing consume map services you'd buy, not build — confirm they're out.
2. **Is surge pricing out of scope?** It's a pricing policy computed from the same supply and demand counts you'll already be keeping. Out, usually.
3. **One country or global?** Assume global — but this changes the *shape* of peak, not just its size. A single country compresses traffic into ~8 hours: peak ×5. Globally, every city peaks at its own local rush hour and the fleet follows the sun, so the worldwide aggregate smooths toward ×3 — while each city still feels its own ×5 inside its shard. You will plan capacity per city, not per planet. Say this out loud; it's why geo-sharding shows up at rung 4 before anything forces it.

Assume the interviewer agrees: matching plus tracking, surge out, global but city-sharded.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| Trips | 20 M/day | Uber-scale; propose it, get the nod |
| Drivers online at global peak | 2 M | 20 M trips ÷ 2 M drivers = 10 trips per driver-day — a sane shift |
| Location ping | every 4 s, ~100 B | industry-typical cadence; payload derived at rung 3; cadence defended in the pushback |
| Riders | 30 M DAU, ~10 app opens/day | ~15 opens per booked trip — most opens are price and ETA checks |
| Latency target | the map feels live | inside the 100 ms human-"instant" budget |

Note what the second row buys you: 2 M is a *peak-concurrent* figure, so everything derived from it is already a peak number. No second ×3 later.

## Rung 1 — Users

Two populations, making opposite demands. Riders — 30 M DAU — behave like normal app users: bursty pulls when they open the app, silence in between. Drivers — 2 M online at peak — are the inverse: each one is a sensor that emits continuously for a whole shift whether or not anyone is riding. The supply side generates load by *existing*; the demand side generates load by *acting*. Keep them separate at every rung — they will turn out to need different machines, different protocols, and different failure rules.

## Rung 2 — Actions (traffic)

Three streams. Compute all three before interpreting any of them.

```
trips:    20 M/day ÷ 10^5 s                      = 200 TPS average   global ×3 ≈ 600 TPS peak
pings:    2 M drivers ÷ 4 s/ping                 = 500,000 writes/s  sustained through peak hours
queries:  30 M × 10 opens = 300 M/day ÷ 10^5 s   = 3,000 QPS average   ×3 ≈ 10,000 QPS peak
```

(No ×3 on pings — the 2 M online figure is already the peak.) Now interpret, because this is the rung the chapter exists for:

```
500,000 pings/s ÷ 200 trips/s = 2,500×
```

The "business" of this business — a human getting a ride — is 200 transactions a second. Tiny. A mid-size payments app does more. But the exhaust of that business, the location telemetry, is two and a half thousand times larger, and it runs whether trips happen or not. **This system is its exhaust, not its transactions.** Candidates who size for trips build the wrong system; the architecture is dictated by the pings, and the trips ride along almost for free.

The rider queries sit in between: 10 k peak QPS of "what's near me" — real, but a shape you already know how to handle.

> ⚡ **Instinct check** — 500,000 writes/s at ~100 B each: how many MB/s? Does one Kafka broker hold it? Answer before rung 3 does.

## Rung 3 — Bytes (storage & bandwidth)

First, earn the 100 B. A ping is driver id 8 B, latitude 8 B, longitude 8 B, timestamp 8 B — 32 B of core payload — plus bearing, speed, and GPS accuracy at ~8 B each, plus envelope and framing. Round to 100 B and move.

The rung-3 move this system teaches is **stock versus flow** — what sits versus what streams. Compute them separately.

**Stock — the working set.** The live map needs exactly one current position per online driver:

```
2 M drivers × 100 B = 200 MB
```

The entire live map of every driver on Earth fits in one phone's RAM. Read that again, because the whole design hangs from it: the most famous real-time dataset in software is two hundred megabytes. There is no storage problem here. There is a *freshness* problem — those 200 MB are wrong four seconds after you read them, forever.

> 🎯 **In the room** — Say the phone-RAM line explicitly. Walkthroughs are graded on inversions caught, and "the live map is 200 MB — the problem is keeping it fresh, not keeping it" is this problem's senior sentence.

**Flow — the stream.**

```
ingress: 500,000 pings/s × 100 B = 50 MB/s
```

Half of one Kafka broker's ~100 MB/s, by bytes. You'll still partition the stream by city — for per-city ordering, consumer isolation, and blast radius — but say plainly that the partitioning is *not* for throughput. Egress is the same order: a map open returns ~50 nearby drivers × 100 B = 5 KB, so 10 k peak QPS pushes 50 MB/s out. Bandwidth, both directions, is trivial.

**History — only if you choose it.**

```
raw:        50 MB/s × 10^5 s = 5 TB/day
compressed: ÷10 (telemetry compresses like logs)  = 500 GB/day
a year:     500 GB/day × 365 ≈ 180 TB — S3-class object storage
```

180 TB/year sounds like the big number you expected this chapter to contain. It isn't a problem: append-only, never read by the live path, and cheap (priced at rung 5). Whether you keep one week or seven years is an analytics and compliance decision, not a capacity one — the log decouples that choice from the system that matters.

Think of an air-traffic-control radar: the sweep refreshes every few seconds, old blips fade off the glass, and the screen only ever holds what's airborne *now*. Nobody asks the radar about last Tuesday — that's the tape recorder bolted on beside it. Your live index is the screen; the log and the archive are the tape recorder.

## Rung 4 — Machines (cache, servers, shards)

**The live index.** 500 k writes/s into an in-memory store at the canon ~100 k ops/s per node:

```
500,000 writes/s ÷ 100,000 ops/s per node = 5 nodes — by capacity
```

But you won't run 5; you'll run 10–20, sharded by city. Here is the nuance worth saying explicitly: **geo-sharding is chosen for blast radius and latency, not capacity.** A city's index living in that city's region keeps queries off cross-continent round trips, and an overloaded node during a São Paulo downpour degrades São Paulo, not Jakarta. Capacity said 5; operations says 10–20; you take the operational number and the capacity comes along free. Each entry carries a ~30 s TTL — a driver who stops pinging simply fades from the map.

**Query boxes.** 10 k peak QPS of lookups against in-memory geo cells is trivial work — the 10 k rung:

```
10,000 QPS ÷ 10,000 QPS/server ÷ 0.6 ≈ 2 → a handful, spread across regions
```

**Ingest gateways.** Drivers hold long-lived connections; the canon plans 100 k sockets per server:

```
2 M connections ÷ 100,000 sockets/server = 20 → ~25 with redundancy
```

**Matching.** Find candidates, score them, orchestrate offer-accept with timeouts — heavy work, the 100 rung:

```
600 TPS peak ÷ 100 QPS/server ÷ 0.6 = 10 boxes
```

**Trips and payments.** A completed trip is a trip row plus a payment row — two typical ~1 KB records, call it 2 KB:

```
20 M/day × 2 KB = 40 GB/day logical × 5 ≈ 200 GB/day provisioned
```

Writes peak at 600 TPS against a ~1,000 TPS SQL ceiling — one well-indexed primary with a replica is fine on day one. Size, not throughput, is the pressure: at 40 GB/day the table goes multi-TB within months, so partition by time and archive closed trips off the hot set — a trip is over in an hour, and only open and recent trips need the fast path. Shard by city if the hot set itself ever outgrows a node.

Tally: ~20 index nodes + ~25 gateways + ~10 matching + a handful each of query boxes, brokers, and SQL — call it 50–100 boxes for the entire real-time core.

> ⚠️ **Trap** — Putting driver locations in a disk-backed database, then designing around its write amplification, compaction, and delete storms. The live map is not a storage system. It is a 200 MB self-expiring cache that happens to be the product.

## Rung 5 — Money

```
compute:  50–100 boxes × $1 k/month               ≈ $50–100 k/month
history:  180 TB by year-end × $20/TB-month       ≈ $4 k/month
egress:   300 M opens × 5 KB ≈ 1.5 TB/day ≈ 45 TB/month × $100/TB ≈ $5 k/month
```

Round the real-time core to $100 k a month. Against a business doing 20 M trips a day, that is not a cost conversation — and that's the punchline: **Uber's hard problem was never hardware cost.** The money rung's job is to point at where the difficulty actually lives, and here it points away from itself: at freshness — a 4-second-stale map sends a rider to a ghost driver — and at geo-query latency, which must land inside the 100 ms human-instant budget with a radius search in the middle. Spend engineers there, not on the bill.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 200 MB working set | RAM-resident geo index; disks exist only for the log |
| a ping is worthless in ~30 s | TTL everything — the index is self-cleaning; no deletes, no compaction, offline drivers just fade |
| 500 k/s pings vs 200 TPS trips | tracking is ops-shaped, matching is compute-shaped — separate tiers, separate SLOs, separate failure rules |
| every city peaks locally (×5) | city = shard = blast radius; deploys, failures, and capacity are per-city decisions |
| 5 TB/day raw history | decouple retention through the log; keeping it is an analytics budget line, never a live-path concern |

The deepest row is the third. Matching wants correctness, transactions, and an audit trail — and is allowed to be 50 ms slower. Tracking wants throughput and freshness — and is allowed to *lose data*, because a dropped ping is healed by the next one in 4 seconds. Two workloads with opposite virtues; forcing them into one tier ruins both.

## The pushback round

**Interviewer:** "Four-second pings feel coarse. Why not every second, for accuracy?"

**You:** "Let's price it. ×4 on the stream: 2 M writes/s and 200 MB/s — the index fleet grows from ~20 nodes toward 80, a couple of brokers by bytes, and the gateways carry 4× the messages on the same sockets. Call it fleet ×4 — feasible, a money answer. But the servers aren't the constraint. The radio is: waking 2 M phone radios every second burns driver batteries, and drivers who end shifts early are a supply problem no cluster fixes. And the accuracy isn't there to buy: at city speeds — 30 km/h is ~8 m/s — a 4-second gap is ~30 m of drift, except the ping already carries bearing and speed, so the map dead-reckons across the gap and the residual error is ~10 m, which is about GPS noise in a street canyon anyway. One-second pings buy precision the sensor can't deliver."

**Interviewer:** "So you'd never ping faster?"

**You:** "I'd ping faster where it pays: adaptive cadence — 1 s when the driver is within a minute of pickup, 4 s cruising, slower when idle. That buys accuracy exactly when the rider is staring at the car, for a few percent of the write budget. The real lesson of the estimate is that the bottleneck here is physics and product, not servers — and estimation includes knowing when the computer isn't the constraint."

## Say it in 60 seconds

> "Numbers first. Twenty million trips a day is 200 TPS — tiny. The real traffic is telemetry: 2 million drivers online at peak, pinging every 4 seconds — 500,000 writes a second, 2,500 times the business traffic. The system is its exhaust. Bytes: a ping is 100 bytes, so the live working set is 2 million times 100 — 200 megabytes. The entire live map of every driver on Earth fits in one phone's RAM; the problem is freshness, never storage. The stream is 50 megabytes a second — half a Kafka broker — and history, if we keep it, compresses to 500 gigabytes a day on S3: an analytics choice, not a capacity one. Machines: the in-memory index needs 5 nodes by capacity, but I'd run 10–20 sharded by city — for blast radius and latency, not throughput. Twenty-five gateways hold the 2 million connections, ten matching boxes do the heavy work, one SQL pair takes the trip records. The whole core is maybe 100 boxes — order of $100 k a month, so cost is a non-issue. The numbers that worry me are 4 seconds of staleness and the 100-millisecond query budget — so the design effort goes to freshness and the geo index, and everything gets a TTL."

## Numbers to keep

- 20 M trips/day = 200 TPS; pings 2 M ÷ 4 s = 500 k writes/s — the exhaust outweighs the business 2,500×
- Live working set: 2 M × 100 B = **200 MB** — one phone's RAM; freshness is the problem, not bytes
- Stream: 50 MB/s — half a Kafka broker; partition by city for ordering and isolation, not throughput
- History: 5 TB/day raw → ÷10 → 500 GB/day → ~180 TB/year on S3 — retention is an analytics choice
- Index: 5 nodes by capacity → 10–20 by geography; geo-sharding buys blast radius and latency
- Gateways: 2 M sockets ÷ 100 k = 20 + redundancy; matching: 600 peak TPS heavy → ~10 boxes
- Core ≈ 50–100 boxes ≈ $50–100 k/month — the hard problem is freshness inside 100 ms, never cost

## Drills

**Drill 16.1** — A bike-taxi launch triples the online driver count in one megacity: 100 k → 300 k at peak. Which number breaks first?

<details><summary>Answer</summary>

```
city pings before: 100 k drivers ÷ 4 s = 25 k writes/s — a quarter of one index node
city pings after:  300 k drivers ÷ 4 s = 75 k writes/s — 75% of the 100 k ops/s ceiling
```

The city's index shard breaks first — and precisely *because* city = shard, the rest of the fleet can't absorb it: one city's stream doesn't spread across other cities' nodes. Gateways are fine (300 k sockets is three boxes' worth), matching is fine (trips scale with demand, not supply). The fix is a finer shard key: split the city into geo-cells. So-what: a shard key chosen for blast radius will eventually be re-chosen for capacity — know which pressure you're under when it happens.
</details>

**Drill 16.2** — Legal says: store every ping for 7 years, for compliance. Size it and pick the tier.

<details><summary>Answer</summary>

```
compressed:  500 GB/day × 365 ≈ 180 TB/year × 7 ≈ 1.3 PB logical
provisioned: × 1.5 (erasure-coded blob store, not ×5) ≈ 2 PB
cost:        2,000 TB × $20/TB-month ≈ $40 k/month by year 7
```

Tier: S3-class object storage, append-only, partitioned by day — never a database, never the live tier. The bill grows to the same order as the entire real-time core, linearly and predictably: real money, but a budget line, not an architecture change. The contrast worth saying out loud: the archive is 2 PB and the working set is 200 MB — the cold tail outweighs the live map ten million to one, which is exactly why they must be different systems.
</details>

**Drill 16.3** — New Year's Eve: trips ×10 for one hour, in every city simultaneously. Matching, pings, or queries — which tier do you scale ahead of time?

<details><summary>Answer</summary>

Walk each stream against what it scales *with*:

```
pings:    drivers can't ×10 — the fleet is physical; maybe +20–30%. Self-limiting.
queries:  10 k → ~100 k QPS of trivial stateless work — autoscaling's job; pre-warm and forget
matching: 200 TPS × 10 = 2,000 TPS heavy → 2,000 ÷ 100 ÷ 0.6 ≈ 33 boxes — 3× the normal fleet
writes:   ~2,000 TPS of trip records vs a ~1,000 TPS SQL ceiling — the primary breaks
```

Pre-scale matching — heavy compute can't appear instantly — and fix the trip write path *before* the night: queue trip writes through the log and confirm asynchronously, or have city shards ready. The quiet catch is the SQL primary that's comfortable all year crossing its write ceiling exactly once a year. So-what: the three streams scale with three different populations — supply (physical, inelastic), demand (×10), and anxiety (app opens) — and you pre-scale only the tiers bound to demand.
</details>

---
[← Previous: Photo sharing](15-photo-sharing.md) · [Table of contents](../../README.md) · [Next: Cloud storage →](17-cloud-storage.md)
