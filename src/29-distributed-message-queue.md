# 29 — A distributed message queue

*A component you size by throughput, fill by retention, and pay for in disk — where every partition you add buys parallelism by spending order.*

## The prompt

> "Design a distributed, durable message queue — a Kafka-scale commit log — for our internal event bus. It carries a few gigabytes a second at peak. Put numbers on it first."

Like the rate limiter, this is a component, not a product, and the same three inversions apply. You inherit the traffic — you don't propose it from a DAU count. Your durability guarantee is a tax paid on every byte, three times over. And the numbers don't decorate a design you've sketched — they *choose the topology*: how many brokers, how many partitions, and whether the cluster is bound by throughput or by disk. Run the product playbook here (find users, find QPS, find storage) and you miss that a queue's whole life is measured in MB/s, not QPS.

## Scope it in 60 seconds

Three questions change the numbers; the third changes the architecture.

1. **What durability?** Fire-and-forget, or replicated and acknowledged? Say replication ×3 with `acks=all` — the queue's entire reason to exist is not losing the message. This sets the storage multiplier and the write-path tax.
2. **What retention?** A queue that holds messages for an hour and one that holds them for a month are the same design with a 700× difference in disk. Say **7 days** — long enough to replay a day's bug, short enough to bound the fleet. This is the dial; get the nod, and flag tiered storage for anything longer.
3. **What ordering guarantee — global, or per-key?** Global total order means one partition means one machine means no horizontal scale. Per-key order — order preserved within a partition, not across — is what makes the whole thing scale. Choose per-key. This single answer decides the partitioning, which decides everything.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| Aggregate ingest | 1 GB/s avg, 3 GB/s peak | inherited; "a few GB/s" for a large-co event bus, peak already the queue's job to absorb |
| Message size | ~1 KB | canon log-line / record default |
| Message rate | ~10^6 msg/s avg | 1 GB/s ÷ 1 KB — the queue's "QPS", but bytes are the real unit |
| Replication factor | ×3 | canon durability multiplier — the promise itself |
| Retention | 7 days | proposed dial; sets disk — get the nod |
| Consumer fan-out | 4 groups | ETL, search index, analytics, audit read the same stream — multiplies egress, not storage |
| Per-broker throughput | 100 MB/s | canon Kafka-broker ceiling |
| Per-broker disk | ~20 TB | proposed dense sequential JBOD; canon's "a few TB/node" is for random-access — an append-only log packs denser |

> ⚠️ **Trap** — Re-multiplying the inherited 3 GB/s by the ×3 peak factor. The producers' peak is already in that figure; a queue exists precisely to swallow the producers' peak. Ask whether a given number is average or peak, then leave it alone.

## Rung 1 — Users

The queue's "users" are other services — producers on one side, consumer groups on the other — so the top rung bends all the way, as it did for the rate limiter. State the demand in the two dimensions the rungs below will each consume: **throughput** — 1 GB/s average, 3 GB/s peak, which will drive brokers and disk — and **fan-out** — 4 consumer groups reading every message, which will drive egress and nothing else. Holding both, and knowing which rung eats which, is the rung-1 skill for any infrastructure component. Notice the shape early: this system writes each message once and reads it many times, and the whole design turns on that asymmetry paying off.

## Rung 2 — Actions (traffic)

Split the produce path (write) from the consume path (read) — but here both are measured in bytes per second, because that is the currency a broker actually spends.

```
produce (write):  10^6 msg/s × 1 KB          = 1 GB/s avg   → peak ×3 = 3 GB/s
consume (read):   10^6 msg/s × 4 groups       = 4×10^6 reads/s = 4 GB/s avg → peak 12 GB/s
read:write ratio  = fan-out = 4:1             (canon telemetry ~1:1 × fan-out)
```

The read:write ratio *is* the fan-out — a queue has no 100:1 read amplification like a feed, just however many groups subscribe. And the load-bearing fact, said now: **fan-out multiplies bandwidth, never storage.** One physical copy set on disk, read four times over the wire. That single sentence is why a log scales where a fan-out-on-write feed does not.

### The signature sub-question — how many brokers, and how much disk, does X MB/s over R days demand?

Two independent pressures decide the broker count, and naming which one binds is the whole interview. Start with throughput, because durability makes it bigger than it looks: every ingested byte is written three times.

> ⚡ **Instinct check** — 3 GB/s of peak ingest, replicated ×3, against 100 MB/s brokers. How many brokers just to absorb the writes — before storing a single day of it? Answer before reading on.

```
durability tax:      every ingested byte written ×3 (replication)
peak write to disk   = 3 GB/s × 3         = 9 GB/s
per broker           = 100 MB/s
brokers (throughput) = 9 GB/s ÷ 100 MB/s  = 90
```

Ninety brokers just to absorb the replicated write stream, with retention still at zero. That is the throughput floor, and it is set entirely by the peak — brokers are sized for the worst second, not the average one.

What about the 12 GB/s of consumer egress — doesn't that need its own brokers? No, and the reason is the point: consumers read the tail, which is seconds old and resident in OS page cache, so egress is served from RAM by zero-copy, burning NIC rather than the disk-bound 100 MB/s ceiling.

```
NIC budget:  90 brokers × 1.25 GB/s (10 Gbps) = ~110 GB/s aggregate
NIC demand:  ingest 3 + replication 6 + egress 12 = 21 GB/s   → fits five times over
```

Egress is a network problem the fleet already has the ports for. The disk-write path is what sets the broker floor. But is 90 the answer? Only if throughput binds. The other pressure — disk — needs the byte rung. Hold it.

## Rung 3 — Bytes (storage & bandwidth)

Storage fills at the **average** rate — the peak fills nothing extra, it just arrives sooner — carried for the full retention window, times replication.

```
avg ingest 1 GB/s × 10^5 s/day = 100 TB/day logical
× 3 replication                = 300 TB/day provisioned
× 7 days retention             = 2,100 TB   ≈ 2 PB standing
```

Note the multiplier: **×3, not the canon ×5.** An append-only log has no secondary indexes, no write amplification, no B-tree overhead — the ×1.5 that databases pay for structure simply is not spent here. Durability is the whole multiplier. Derived from the canon by dropping the term that does not apply, and said out loud so the interviewer can audit it.

> ⚠️ **Trap** — Sizing disk at the peak rate. Brokers are sized for peak throughput; disk fills at the average. Multiply retention by 3 GB/s instead of 1 GB/s and you provision three times the disk you will ever fill.

Now the disk pressure on the broker count:

```
per-broker disk       = 20 TB (dense sequential JBOD)
brokers (disk)        = 2,000 TB ÷ 20 TB = 100
```

Why HDD holds this at all is the append-only shape. A log only ever writes to the end — pure sequential I/O — and a single HDD sustains ~150 MB/s sequential (canon) despite a laughable ~150 random IOPS. A dozen HDDs per broker is ~1.8 GB/s of sequential write, eighteen times the 100 MB/s planning ceiling.

```
HDD sequential:  ~150 MB/s  → append-only never seeks → 12 HDDs ≈ 1.8 GB/s/broker
NVMe:            ~3 GB/s     → wasted on a workload that never does a random read
```

The log being append-only is worth real money: it lets cheap dense HDD carry 2 PB where a random-access store this size would demand NVMe and cost five times more. The access pattern *is* the cost model.

## Rung 4 — Machines (cache, servers, shards)

**Brokers.** Two pressures, one fleet — take the max.

```
brokers = max( throughput 90 , disk 100 ) = 100
```

At 7 days the two nearly tie, which is the tell: the cluster is *balanced*, and retention is the dial that tips it. One day of retention → disk needs only ~15, throughput's 90 binds, the cluster is throughput-bound. Thirty days → disk needs ~450, throughput unchanged, firmly disk-bound. Same ingest, opposite dominant constraint, chosen by one number.

> 🎯 **In the room** — "About a hundred brokers" is a recital. "About a hundred, and at a week's retention throughput and disk nearly tie — so it's balanced, and lengthening retention makes it disk-bound while raising ingest makes it throughput-bound" is an architect naming which lever moves which wall. The max() is not arithmetic trivia; it is the whole shape of the system.

**Partitions.** The partition is the unit of parallelism *and* the unit of ordering — one knob doing two jobs — so its count is the max of a throughput need and a parallelism need.

```
throughput:   3 GB/s peak spread so no partition exceeds ~10 MB/s   → ~300 partitions
parallelism:  hungriest consumer group wants ~1,000 parallel readers
              (a partition feeds at most one consumer per group)     → ~1,000
partitions  = max(300, 1,000) = 1,000
```

A thousand partitions across a hundred brokers is ~10 leaders each — comfortable. And here is the tension the whole chapter turns on, made physical. During Durga Puja in Kolkata the pandal serves *bhog* to thousands. One serving line keeps perfect arrival order — first come, first fed — but it crawls at one server's pace. Open ten counters and you feed ten times as many people a minute; but "who arrived first" now holds only *within* each line — the man third at counter seven eats before the woman tenth at counter two who came earlier. Speed bought by surrendering a single global order; order surviving only inside each line. A partition is a serving counter: add counters for parallelism and throughput, and per-message order lives only within a partition, never across. And the donation register beside the counter, where every gift is entered on the next blank line and never scratched out — that is the log itself: append-only, read by scanning straight down.

**Cache.** No tier to build. Consumers lag the head by seconds, so the working set is structural page cache:

```
working set = 1 GB/s × ~100 s of lag ≈ 100 GB across the fleet ≈ 1 GB/broker
```

Against 128 GB of RAM per box, the hot set is a rounding error — the "cache" is free and comes with the OS. This is the canon's 20%-of-reads working set collapsed to almost nothing, because in a queue the hot data *is* the write head.

**Metadata.** A controller / metadata quorum of 3–5 nodes tracks partition leadership. Negligible boxes, but say it — at 1,000 partitions × 3 replicas that quorum is tracking 3,000 assignments, and it becomes the failover bottleneck long before disk does.

## Rung 5 — Money

Disk-heavy, and — crucially — no internet egress, because the consumers are internal services in the same datacenter.

```
boxes:    100 brokers × $1k              = $100k/month
disk:     2,000 TB × $20 (HDD/object-class)= $40k/month     (block SSD would be $200k)
egress:   consumers internal, same-DC     ≈ $0 internet egress
          (hidden line: ~6 GB/s cross-AZ replication — a real inter-AZ transfer bill)
total    ≈ $140k/month  → order $150k
```

Contrast the podcast platform from the Ladder chapter, where 800 TB/day of egress *was* the system. Here egress never leaves the building, so the bill is disk and boxes — and the append-only shape kept the disk line at HDD's $40k instead of SSD's $200k. The one number to chase before the finance meeting is the cross-AZ replication transfer, the only egress-shaped cost in the design.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 9 GB/s replicated write ÷ 100 MB/s = 90 brokers | throughput sets a broker floor before retention is even counted |
| 2 PB standing ÷ 20 TB = 100 brokers | disk sets a second floor; broker count is the **max** of the two |
| throughput 90 ≈ disk 100 at R = 7 days | cluster is balanced — retention is the dial that tips throughput-bound vs disk-bound |
| ×3 replication, not ×5 | append-only log has no index overhead; durability is the whole multiplier |
| fan-out ×4 → +egress, +0 storage | one stored copy set, read four times — bandwidth scales, disk does not |
| partitions = max(300 throughput, 1,000 parallelism) | partition count is set by the hungriest consumer group, not by ingest |
| append-only → sequential → HDD, not NVMe | the access pattern picks the medium and cuts the disk bill 5× |

## The pushback round

**Interviewer:** "Retention just went from 7 days to 30. Do I buy five times the brokers?"

**You:** "Disk goes 5×, brokers don't have to. Thirty days is 9 PB provisioned — 450 disk-bound brokers versus a throughput need still stuck at 90. But those extra 350 brokers would exist only to be a filesystem for data no consumer ever reads, because consumers live at the head. The move is tiered storage: keep the hot day on broker HDD — throughput's ~90 brokers already carry it — and offload the cold 29 days to object storage, which is erasure-coded at the canon's ×1.5, not ×3. Retention becomes an object-store line item, not a broker count."

**Interviewer:** "Then why not just run 10,000 partitions and never worry about parallelism again?"

**You:** "Because partitions aren't free and more of them makes two things worse. Each is a leader, a replicated log, and an entry the controller quorum must track — over-partition and failover slows, controller load climbs, and end-to-end latency rises as batches thin out. And every partition you add fragments ordering further. Partition count is a max of throughput and parallelism, deliberately — not 'as many as fit', because you'd be spending recovery time and ordering guarantees to buy parallelism no consumer is using."

**Interviewer:** "One tenant needs strict order on their stream and pushes 300 MB/s. Fine?"

**You:** "No — and this is the wall the whole design leans on. Strict order pins that tenant's stream to one partition, one partition is one leader on one broker, and one broker's log tops out near 100 MB/s. Three hundred ordered megabytes a second is three times a ceiling I cannot split, because splitting is exactly what surrenders the order they asked for. So it's a genuine choice, not a tuning knob: keep total order and cap them at one log's throughput, or shard their key across three partitions with a suffix and give them order only within each sub-stream. You cannot have per-key total order and unbounded per-key throughput — ordering and parallelism are the same knob turned opposite ways. Which one the tenant actually needs is a question for them, not for me."

That last line — **ordering and parallelism are one knob, and per-key total order is a throughput ceiling by construction** — is the senior signal of the round.

## Say it in 60 seconds

> "A component, so I inherit the load: a gigabyte a second average, three at peak, arriving as a million one-kilobyte messages a second. Durability is replication times three, so the write path is nine gigabytes a second at peak — ninety brokers just to absorb it at a hundred megabytes each. Seven days of retention at the *average* gigabyte a second is a hundred terabytes a day, three hundred replicated, two petabytes standing — a hundred brokers at twenty terabytes of cheap HDD each, cheap because an append-only log only ever writes sequentially. So broker count is the max of ninety and a hundred: throughput and disk nearly tie at a week, and retention is the dial — a day is throughput-bound, a month is disk-bound. Partitions are the max of throughput and parallelism — three hundred to spread the bytes, a thousand to feed the hungriest consumer group — call it a thousand, and every one buys parallelism by spending global order. Fan-out of four groups pushes egress to twelve gigabytes a second, all served off page cache, none of it touching disk, because a log stores once and is read many times. Consumers are internal, so there's no internet egress — the bill is disk and boxes, about a hundred and fifty thousand a month. The number that worries me is the retention-times-replication two petabytes, so I'd design tiered storage — hot tail on the brokers, cold days in object store — first."

## Numbers to keep

- Ingest 1 GB/s avg, 3 GB/s peak = 10^6 msg/s × 1 KB — a queue is sized in **MB/s, not QPS**
- Write path = ingest × replication: 3 GB/s × 3 = 9 GB/s → ÷ 100 MB/s = **90 brokers by throughput**
- Storage = **avg** rate × retention × 3: 100 TB/day × 7 = 2 PB → ÷ 20 TB = **100 brokers by disk**
- Broker count = **max(throughput, disk)**; at 7 days they tie — retention is the dial
- Append-only → sequential → cheap HDD carries 2 PB; replication ×3, not ×5 (no index overhead)
- Fan-out multiplies **egress, not storage** — one stored copy set, read G times, off page cache
- Partitions = max(throughput ÷ ~10 MB/s, desired parallelism) — the unit of **both** ordering and throughput
- No internet egress (internal consumers) → disk + boxes dominate → order $150k/month
- Per-key total order pins a key to one log ≈ 100 MB/s — a throughput ceiling by construction

## Drills

**Drill 29.1** — Retention goes from 7 days to 30. Which rung moves, by how much, and what's the fix that doesn't triple the fleet?

<details><summary>Answer</summary>

```
logical/day:    100 TB × 30 = 3 PB logical
on brokers:     × 3 replication = 9 PB → ÷ 20 TB = 450 disk-bound brokers
throughput:     unchanged at 90 → now firmly disk-bound
fix — tier:     hot 1 day on brokers (~15 brokers of disk, 90 for throughput)
                cold 29 days to object store × 1.5 (erasure-coded, not × 3)
                ≈ 4.5 PB × $20/TB = $90k/month  vs  ~350 extra brokers = $350k+
```

So what: retention beyond the replay window belongs in object storage, not on brokers. Brokers are for throughput and the hot tail; keeping cold data on them turns a durable log into an expensive filesystem. Lengthening retention is an object-store line item, not a broker count.
</details>

**Drill 29.2** — A stream gets popular: fan-out rises from 4 consumer groups to 20. Which rung moves, and which stays flat?

<details><summary>Answer</summary>

```
egress:    1 GB/s avg × 20 = 20 GB/s avg, peak 60 GB/s
storage:   unchanged — 2 PB   (fan-out never touches disk)
disk:      unchanged — 100 brokers
NIC check: 60 GB/s ÷ 100 brokers = 600 MB/s/broker  → within 1.25 GB/s port, fine
at G=40:   120 GB/s → 1.2 GB/s/broker → NIC-bound → add brokers (or follower-fetch replicas) for ports, not disk
```

So what: fan-out is a bandwidth problem forever, never a storage one — you add brokers for NIC, not for terabytes. This is the exact opposite of a fan-out-on-write feed (see the news-feed chapter), where each extra reader was a stored copy. A log fans out on read and stores once; that asymmetry is the whole reason to reach for a log.
</details>

**Drill 29.3** — One tenant needs strict order on a single stream pushing 300 MB/s. What breaks, and what are the only two ways out?

<details><summary>Answer</summary>

```
strict order   → one partition
one partition  → one leader log on one broker
one broker log → ~100 MB/s hard ceiling
demand 300 MB/s ordered → 3× a ceiling you cannot split without losing order
```

So what: per-key total order is a throughput ceiling by construction — the partition is the unit of both. Exit A: keep total order, cap the tenant at one log's ~100 MB/s. Exit B: shard the key across 3 partitions with a suffix — 3× throughput, but order now holds only within each sub-stream. You cannot have both total order and unbounded throughput on one key; deciding which the tenant actually needs is the chapter in a single question.
</details>
