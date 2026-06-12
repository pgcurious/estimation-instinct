# 9 — Machines & shards

*The arithmetic will say 0.4 servers. You will deploy three. Both numbers are right — this rung is knowing which one is speaking.*

## The question this chapter answers

[Traffic](05-traffic.md) left you holding rates; [Storage](06-storage.md), bytes. Rung 4 of [the Ladder](../part-1-foundations/04-the-ladder.md) converts both into hardware: how many boxes serve the traffic, and into how many pieces the data must split. It is the first rung whose output can page you, and the last one before money — server counts and shard counts are what the bill is made of.

Two formulas do the work, both [cheat-sheet](../appendices/a-cheat-sheet.md) canon:

```
servers = peak QPS ÷ per-server QPS ÷ 0.6
shards  = max( total bytes ÷ 2 TB , write TPS ÷ node write ceiling )
```

This chapter derives both, adds the floor they sit on (nobody deploys 0.4 of a server), and ends with the fleet neither formula covers — workers behind a queue, sized by a third quantity entirely.

## From first principles

### From peak QPS to a server count

The langar at Amritsar's Golden Temple feeds ~100k people a day, free, every day — not with one miraculous pot but with rows of identical serving lines fed by a kitchen cooking in staged batches. Adding capacity means opening another line, never forging a bigger pot. Stateless compute scales the same way: fleet capacity is boxes × per-box throughput, so the box count is one division.

```
servers = peak QPS ÷ per-server QPS ÷ 0.6
```

Three pieces. The numerator is peak — never average — and you earned it on rung 2. The other two you must be able to defend.

**The divisor: what one box does.** The 100/1k/10k rule: a commodity box sustains ~100 QPS of heavy work, ~1,000 of typical business logic, ~10,000 of trivial work. The rule is useless until you can say *why* your endpoint sits on its rung. Trivial means the box barely thinks: a cache hit, a proxy hop, a lookup and a redirect. Typical means real composition: authenticate, read a cache and an indexed query, apply business rules, build JSON. Heavy means the CPU is the product: ML inference, media transforms, crypto, server-side fan-out. "We'll say 5k per server" is not an estimate — it's a vibe with a number attached. In-between divisors are what profilers are for, after the offer; in the room, pick the rung whose description matches the request's work and say the description out loud.

**The ÷ 0.6: why you provision above peak.** Size to exactly peak and every box runs at 100% at the worst moment. Three things break that plan:

- **Deploys take capacity out.** A rolling deploy always has a slice of the fleet draining or warming. Ship a few times a day and the tax is permanent.
- **An AZ can vanish.** Run across three availability zones and lose one — power, fiber, a bad switch — and the survivors absorb +50% instantly: two-thirds of the fleet, all of the traffic. For that not to be an outage, every box must idle below ~67% *before* anything else goes wrong.
- **Spikes overshoot the peak factor.** The ×3 from [Traffic](05-traffic.md) names the busiest hour; the busiest minute inside it is sharper, and as a box nears 100% its queues — and its latency — grow without bound.

So you target 60% utilization and divide by 0.6. Running hot is running fragile: a 95%-utilized fleet is a cheaper bill and a standing invitation to the next deploy, AZ wobble, or flash crowd.

> ⚡ **Instinct check** — An endpoint does typical business logic and peaks at 6k QPS. Boxes, before reading on. … 6 k QPS ÷ 1 k QPS/server ÷ 0.6 = **10 servers**.

### The redundancy floor

Now the paradox in the hook. An internal endpoint peaks at 250 QPS of typical logic:

```
250 QPS ÷ 1,000 QPS/server ÷ 0.6 ≈ 0.4 servers
```

You deploy three. One box means every deploy is an outage and every hardware failure is a long one. Two means a deploy plus one unlucky failure takes you to zero — and that pairing is exactly when failures like to arrive. The floor is **n+2**: enough boxes for load, plus one out for deploys, plus one for failure — and never fewer than three, spread across three AZs, so the failure you're absorbing is allowed to be a building.

The floor inverts how small systems are counted. Below roughly ten servers, redundancy sets the number and the utilization math barely moves it; past ten, the +2 disappears into rounding and the ÷ 0.6 becomes real money — at 50 boxes it's 17 extra, visible on a bill. **Small systems are sized by failure; big systems are sized by load.** Do both steps audibly: "arithmetic says under half a box; I'll run three, multi-AZ." Five seconds, and it reads as someone who has carried a pager.

### Shards — when the data must split

Servers multiply easily because any box can serve any request. Data refuses: a byte lives on one particular node, and a node has ceilings. From the canon, three matter:

```
size:   ~2 TB practical data per SQL node
writes: ~1,000 TPS per SQL node · ~10,000 TPS per LSM node (Cassandra-style)
RAM:    128 GB — the working set one node can keep hot
```

A shard is one node's slice of the dataset, so the count is whichever ceiling you hit first:

```
shards = max( total bytes ÷ 2 TB , write TPS ÷ node write ceiling )
```

Why 2 TB when disks are ten times that? Because the ceiling is operational, not physical. Rebuilding a dead replica streams every byte over the network — throttled to ~125 MB/s so the node keeps serving — and 2 TB ÷ 125 MB/s = 1.6 × 10^4 s ≈ 4.5 h of degraded redundancy. Grow the node and every all-bytes operation — rebuilds, backups, index migrations — stops fitting in a night. The 2 TB line is where recovery time, not capacity, becomes the constraint.

The `max()` hides the most interview-relevant fact: **say which pressure forced the split**, because the futures differ. A size-sharded system grows with retention: the count rises predictably, the mapping stays stable, old shards cool, and archiving buys years. A write-sharded system grows with traffic: hot keys roam, rebalancing is routine, and choosing the hash key *is* the design. Same shard count, different operational lives.

There is a third, quieter trigger: the working set outgrows one node's 128 GB of RAM ([Memory & cache](08-memory-and-cache.md)). Bytes fine, writes fine — but the hot set spills to disk, p99 latency walks away, and you split for memory. It's the trigger that arrives without an alarm attached.

> 🎯 **In the room** — Don't stop at "4 shards." Say "we shard for writes, not size — 2k TPS against a 1k ceiling — so the hash key is booking id, and hot events are what I'll watch." Naming the binding pressure, and the key choice it implies, turns a count into a decision.

### Re-sharding, and how to pre-pay for it

Mumbai's dabbawalas run lunch delivery as a partitioned system: each carrier owns a route outright, sorting codes send every tiffin to exactly one of them, and growth is absorbed by splitting a route along boundaries everyone already knows. The operation the network is famous for avoiding is re-drawing the map — re-drawn routes mean re-learned streets and mis-delivered lunches. They are right to avoid it, and so are you: re-sharding means moving live data while serving it — weeks of copying, dual writes, and a cutover. It is the most dangerous routine operation a stateful system performs, so you provision against it twice:

- **Over-shard upfront, ×2–4, in powers of two.** If the arithmetic says 4, provision 8 or 16. Powers of two keep every future split a clean halving.
- **Make shards logical, not physical.** Carve the keyspace into 16 (small system) to 256 (large) logical shards and map several onto each physical node. Growth then means moving *whole logical shards* to new nodes — a copy, not a re-partition. No row ever changes shard.

Consistent hashing, in one sentence, is the move-less-data trick: arrange shards on a ring so that adding a node steals a sliver from each neighbor instead of re-dealing every key in the system.

### The asymmetry the whole chapter rests on

Look at what the two halves of this rung cost. Stateless tiers scale by adding boxes: an autoscaler does it in minutes, unattended, at 3 AM. Stateful tiers scale by moving data: a named project does it in weeks, carefully, with a rollback plan. Both are called "adding capacity"; they differ by four orders of magnitude in time.

That asymmetry is why architectures look the way they do: push state down into a few carefully-sharded layers — the database, the cache — and keep every tier above them stateless, so the slow-to-scale part of the system is as small as it can be made. You buy compute by the minute; you commit to data placement by the quarter. Every diagram you've ever called "standard three-tier" is that sentence, drawn.

### Queues and workers — sized by residence, not rate

The third fleet sits behind a queue: emails, PDFs, thumbnails, webhooks. Candidates size it like an API tier — jobs per second against a per-box QPS — and get nonsense, because a worker pool is constrained by how long work *stays*, not how fast it arrives. The law is the one [Traffic](05-traffic.md) used for open sockets:

```
jobs in flight = arrival rate × seconds per job
workers        = jobs in flight ÷ jobs one worker runs concurrently
```

A worker that runs one job at a time is rare; most jobs wait on something — a mail gateway, a render, a third-party API — so one box happily runs tens of them concurrently. State that concurrency as an assumption: it is the divisor that moves the answer 10×.

Two properties separate worker pools from API tiers. First, the queue absorbs spikes, so there is no ÷ 0.6 — a burst raises job latency by seconds instead of raising error rates, which is the whole reason the queue exists. Second — the interview classic — the queue can fall behind, and the recovery arithmetic is unforgiving:

```
catch-up time = backlog ÷ (capacity − arrival rate)
```

You drain a backlog with *surplus*, not with capacity. A fleet processing 4k jobs/s against 3k/s arriving drains at 1k/s no matter how impressive the 4k sounds. And if capacity ≤ arrival, catch-up time is infinite: the backlog is immortal, the queue has become a landfill, and waiting fixes nothing — only adding workers does. Say it that plainly; "it never catches up" is a correct and senior answer.

## The anchors

| Anchor | Value | Use it when |
|---|---|---|
| Server formula | peak QPS ÷ (100 / 1k / 10k) ÷ 0.6 | any stateless tier |
| Target utilization | 60% — deploys + AZ loss + spike overshoot | every fleet you size |
| Redundancy floor | 3 boxes minimum; n+2; multi-AZ | every tier that matters |
| Where load takes over | ~10 servers | below: failure sizes you; above: utilization math |
| Shard triggers | 2 TB data · 1k SQL / 10k LSM write TPS · 128 GB hot set | name which one binds |
| Over-sharding | ×2–4, powers of two; 16–256 logical shards | pre-paying the re-shard |
| In-flight load | arrival rate × residence time | worker pools, open sockets |
| Backlog drain | backlog ÷ (capacity − arrival) | post-incident catch-up |

Everything here is [cheat-sheet](../appendices/a-cheat-sheet.md) canon except the ~10-server crossover and the over-sharding defaults — those are this chapter's contribution: defaults to state out loud, not laws.

## 🧮 Worked example — a ticketing platform, tier by tier

Interviewer: *"You're sizing a national event-ticketing and booking platform. Earlier we established 30k peak read QPS, 2k peak write TPS, about 5 TB of hot bookings data — and every confirmed booking emits an email-with-PDF job: 500 jobs/s at peak, each taking ~2 s. Walk me through the machines."*

Front of the system to the back, out loud.

**Load balancers.** "A managed pair — failure-sized, not load-sized. Two."

**API tier.** "Reads and writes both land here: 32k peak, call it 30k at one significant figure. Typical or trivial work? Each request authenticates, pulls seat maps and event pages from cache, applies pricing and availability rules, assembles JSON. That's real composition — the 1k rung. Not the 10k rung, because this is never a single lookup-and-return."

```
30 k peak QPS ÷ 1 k QPS/server ÷ 0.6 = 50 servers
```

**Cache.** "Sizing straight from [Memory & cache](08-memory-and-cache.md): the hot set is 20% of a day's reads. 30k peak is 10k average — global ×3 — and a cached object is the canon 1 KB record."

```
10 k QPS × 10^5 s/day = 10^9 reads/day
10^9 reads × 1 KB     = 1 TB/day read volume
hot 20%               ≈ 200 GB
200 GB ÷ 128 GB/node  ≈ 2 nodes → ×2 for replicas = 4 boxes
```

"Ops sanity check: 30k peak across two nodes is 15k ops/s each — 15% of a Redis node's 100k ceiling. RAM binds here, not ops, which is the usual way around."

**Database.** "Two pressures — check both."

```
writes: 2 k TPS ÷ 1 k TPS/node = 2 shards → ×2 growth headroom = 4
size:   5 TB ÷ 2 TB/node       ≈ 3 shards
shards = max(4, 3)             = 4 — writes bind
```

"Writes forced this split, not size — so the hash key is booking id and hot events are the risk I name. I'd carve 16 logical shards and map four per node, so future splits move whole shards instead of re-dealing rows. Residue check: each node carries 500 writes/s — half its ceiling — and ~1.25 TB, under the 2 TB line. With ×3 replication, 4 primaries are 12 boxes."

**Queue.** "500 jobs/s at ~1 KB per job is 0.5 MB/s against a 100 MB/s broker. Load says one box; the floor says three."

**Workers.** "Residence time, not rate:"

```
in flight:   500 jobs/s × 2 s/job = 1,000 jobs
concurrency: jobs wait on the mail gateway and the PDF render → say 50 per box
workers:     1,000 jobs ÷ 50 per box = 20 boxes
```

"No ÷ 0.6 here — the queue is the headroom. A burst costs seconds of email latency, not errors."

The fleet:

| Tier | Boxes | What sized it |
|---|---|---|
| Load balancers | 2 | failure — a pair |
| API | 50 | load: 30 k ÷ 1 k ÷ 0.6 |
| Cache | 4 | RAM: 200 GB hot set, with replicas |
| SQL, 4 shards | 12 | writes: 2 k TPS vs 1 k ceiling, ×2 headroom, ×3 replication |
| Queue | 3 | failure — the floor |
| Workers | 20 | residence: 1,000 in flight ÷ 50 |
| **Total** | **≈ 90** | ≈ $90k/month at $1k a box |

Of these ninety boxes, the seventy-two stateless ones — API, workers, the LB pair — can be doubled by an autoscaler before lunch; the twelve under the bookings data are the only number you must get right today, because changing it means moving terabytes.

## ⚠️ Traps

- **Sizing the fleet on average QPS.** The average is what you pay for; the peak is what pages you. Every divisor in this chapter takes peak — a fleet sized on average is 3× short at the only hour that matters.
- **A divisor chosen by vibes.** "Say each server does 5k" — why 5k? Because it sits between 1k and 10k? Tie the endpoint's actual work to a rung of the 100/1k/10k rule, out loud, or the server count is theater with arithmetic in it.
- **Forgetting the ÷ 0.6.** Sized to exactly peak, the fleet is full at the worst moment, and the next deploy or AZ loss lands on a system with nothing to give. One division separates a capacity plan from a description of the cliff edge.
- **Sharding because the number sounds big.** 15 TB of cold compliance archives on S3-class storage needs exactly zero shards — no node ceiling is being hit, because there is no node. Shards answer a ceiling; if you can't name the ceiling (size, write TPS, RAM), the answer is no shards.
- **Treating worker pools as QPS problems.** "500 jobs/s, a box does 500 requests/s, so one box" — and the pool drowns, because each job *stays* for 2 s. Pools are sized by residence (arrival × duration) and drained by surplus; the arrival rate alone tells you neither.

## Numbers to keep

- Servers = peak QPS ÷ (100 / 1k / 10k) ÷ 0.6 — defend the rung out loud; the 0.6 buys deploys, a lost AZ (+50% on survivors), and spike overshoot
- The floor: never 1 box; n+2; three AZs — small systems are sized by failure, big ones by load; crossover ~10 servers
- Shards = max( bytes ÷ 2 TB , writes ÷ 1k SQL / 10k LSM ) — name the binding pressure
- The quiet third trigger: working set past 128 GB of node RAM
- Over-shard ×2–4 in powers of two; 16–256 logical shards on few nodes; consistent hashing = the move-less-data trick
- Worker pools: in-flight = arrival × seconds per job; workers = in-flight ÷ per-box concurrency — residence, not rate
- Catch-up = backlog ÷ (capacity − arrival); no surplus means the backlog is immortal — say so

## Drills

**Drill 9.1** — A global travel-booking aggregator has 50M DAU; each does ~12 API calls a day of typical business logic. How many API servers?

<details><summary>Answer</summary>

```
50 M × 12 calls = 600 M calls/day
600 M ÷ 10^5 s  = 6 k QPS average → ×3 global peak ≈ 18 k QPS
18 k ÷ 1 k QPS/server ÷ 0.6 = 30 servers
```

~30 servers. Watch what the 0.6 did: 18 boxes of raw arithmetic became 30 provisioned — twelve extra, ~$12k/month, all of it buying deploys, AZ loss, and spike room. Past ~10 servers, utilization math is real money; state it as a choice, not an apology.
</details>

**Drill 9.2** — Three datasets, one judgment each — which pressure, if any, forces a split? (a) An orders table: 8 TB on SQL, 300 writes/s. (b) A telemetry firehose: 600 GB live, 25k writes/s. (c) 15 TB of compliance archives: written nightly, read a few times a month.

<details><summary>Answer</summary>

```
(a) size:   8 TB ÷ 2 TB = 4 shards;  writes: 300 ÷ 1 k = 0.3 → size binds
(b) writes: 25 k ÷ 1 k SQL = 25 shards for 600 GB — wrong engine;
            25 k ÷ 10 k LSM = 2.5 → 3 LSM nodes — writes bind
(c) no node ceiling touched → blob store, zero shards
```

(a) has a calm, size-sharded future — the count grows with retention, and archiving buys years. (b) is write-bound, and 25 SQL shards for less than one node of data is the formula telling you to switch engines, not add shards. (c) is the trap: a big number with no ceiling behind it. No ceiling, no shard.
</details>

**Drill 9.3** — A worker fleet processes a steady 3k jobs/s; capacity is 4k jobs/s. A bad deploy halts all consumption for 2 hours. How long to catch up after the fix? What if capacity were 3k? And what would drain it in one hour?

<details><summary>Answer</summary>

```
backlog:  3 k jobs/s × 7,200 s ≈ 21.6 M → call it 20 M jobs
surplus:  4 k − 3 k = 1 k jobs/s
catch-up: 20 M ÷ 1 k = 2 × 10^4 s ≈ 5.5 h
capacity 3 k: surplus 0 → never — the backlog is immortal
1-hour drain: 20 M ÷ 3,600 s ≈ 5.5 k/s surplus → ~8.5 k/s capacity ≈ 2× today's fleet
```

A 2-hour outage costs ~5.5 hours of staleness, because backlogs drain by surplus and the surplus is a quarter of capacity. Wanting 1-hour recovery means roughly doubling the fleet — which is why "how fast must we catch up?" is a product requirement wearing an infrastructure costume.
</details>

**Drill 9.4** — An internal HR portal peaks at 40 QPS of typical logic. A teammate proposes one beefy box. Do the arithmetic, then the deployment.

<details><summary>Answer</summary>

```
40 QPS ÷ 1,000 QPS/server ÷ 0.6 ≈ 0.07 servers
deployment: 3 boxes, one per AZ
```

The arithmetic says 7% of one server; the deployment is still three, because at this size the count is set by failure, not load — one box makes every deploy an outage, two make a deploy plus one failure an outage. "Three small instances across AZs" is the whole answer, and the cost is noise.
</details>

**Drill 9.5** — Back to the worked example. The interviewer says: "Double everything — 60k reads, 4k writes, 1,000 jobs/s. What breaks first?"

<details><summary>Answer</summary>

```
API:     60 k QPS ÷ 1 k QPS/server ÷ 0.6 = 100 boxes      — autoscaler, minutes
workers: 1,000 jobs/s × 2 s = 2,000 in flight ÷ 50 = 40   — minutes
cache:   hot set 200 GB → 400 GB → 4 nodes, 8 with replicas — hours: a re-warm, not a migration
SQL:     4 k TPS on 4 shards × 1 k TPS = 100% of ceiling   — the break
```

The write shards break first: doubling eats exactly the ×2 headroom, and a write tier at 100% of ceiling has nothing left for a deploy, an AZ loss, or one hot on-sale event. The escape is the one you pre-paid — 16 logical shards mean 4 physical nodes become 8 by moving whole shards, a weekend instead of a quarter. Doubling was a non-event for every stateless tier and an event for the stateful one; that asymmetry is the answer the interviewer wanted.
</details>

---
[← Previous: Memory & cache](08-memory-and-cache.md) · [Table of contents](../../README.md) · [Next: Latency, availability & cost →](10-latency-availability-cost.md)
