# Appendix D — The problem bank

*Thirty-odd problems, graded, for the spaced and interleaved practice the retention schedule runs on. The chapters taught the moves; the Drills chapter drilled a first set; this is the deep well you keep drawing from for months.*

**How to use this.** Cover the answer with your hand. Say your estimate *out loud* — the whole number, the chain, the so-what — before you reveal anything. Then open the collapse and grade yourself on *order of magnitude only*: within 3× is a pass, within 2× with a named cause is interview-ready, and a 10× miss is a structural bug worth one sentence of diagnosis. Log the ratio, never a tick. And the one rule that makes a bank a bank: **pull problems at random and interleaved, never top to bottom.** A fire drill announced a week ahead trains nobody; the alarm that rings at 3 PM on a Tuesday, mid-sentence, when you have to find the exit cold — that one trains the reflex that saves you. A problem you see coming tests recognition. A problem pulled from the shuffle tests recall, which is the only thing the room tests. Every answer traces to the cheat sheet; when you disagree with one, the sheet wins.

## Tier 1 — Arithmetic reflexes

Target: **10 seconds each**, no paper. Anchor recall or one multiplication — the strokes, not the compositions.

**T1.1** — How many seconds in a day, the number you actually use?

<details><summary>Answer</summary>

10^5 s (86,400 exact). Every rung-2 QPS line divides by this; if you reached for 86,400 you've already lost the ten seconds.
</details>

**T1.2** — A service writes 1 KB records at 100 writes/s. Logical bytes in a day?

<details><summary>Answer</summary>

```
100/s × 10^5 s      -> 10^7 writes/day
× 1 KB              -> 10^10 B = 10 GB/day
```

10 GB/day logical — a rate you restate as ~3 TB/year (× 3 × 10^7) the moment retention comes up.
</details>

**T1.3** — Monthly cost of one commodity box (32 vCPU, 128 GB)?

<details><summary>Answer</summary>

~$1k/month. The most reused number in rung 5 — every fleet's compute bill is this times the box count.
</details>

**T1.4** — Your NIC reads 1 Gbps. Payload throughput in MB/s?

<details><summary>Answer</summary>

125 MB/s — bits divide by 8 before they become bytes. Answering "1,000" is the single most common trap in bandwidth math.
</details>

**T1.5** — One minute of video, all renditions stored. Bytes?

<details><summary>Answer</summary>

~100 MB (a single 1080p rendition is ~50 MB; all renditions ≈ 2×). Media is where storage problems live — remember it, and the podcast/YouTube family of answers falls out.
</details>

**T1.6** — 8 M DAU. Peak concurrent users, and how many WebSocket boxes to hold them?

<details><summary>Answer</summary>

```
10% × 8 M           -> 800 k concurrent
800 k ÷ 100 k/box   -> 8 boxes
```

The peak-concurrent cut is really a connection-tier sizing in disguise.
</details>

**T1.7** — One Redis node. Ops/s ceiling?

<details><summary>Answer</summary>

~100k ops/s — RAM-bound, not CPU-bound. Any single-node claim past a few hundred k is a benchmark trick, not a machine.
</details>

**T1.8** — A Kafka broker at its ceiling ingests 1 KB events. Events/s?

<details><summary>Answer</summary>

```
100 MB/s ÷ 1 KB     -> 10^8 ÷ 10^3 = 10^5 events/s
```

One broker ≈ 100k 1-KB events/s. Past that you add brokers, not optimism.
</details>

## Tier 2 — Single-rung drills

Target: **30 seconds each**. Each exercises exactly one pocket formula. Say the formula first, then push the numbers through — formula, compute, interpret.

> ⚡ **Instinct check** — Before you touch a T2 problem: which of the seven pocket formulas is it? If you can't name it in two seconds, you're about to compute the wrong thing quickly.

**T2.1** — A pastebin takes 10 M new pastes/day. Peak write QPS?

<details><summary>Answer</summary>

```
10 M ÷ 10^5          -> 100 writes/s average
content site → ×3    -> 300 writes/s peak
```

300 peak writes/s is one SQL node with room to spare — pastebin's write path is a non-event; its story lives in reads and retention.
</details>

**T2.2** — Autocomplete serves 500 M prefix lookups/day from a cache, each entry ~1 KB. Cache size?

<details><summary>Answer</summary>

```
read volume: 500 M × 1 KB   -> 500 GB/day
hot 20%                     -> 100 GB → one 128 GB node
```

The entire autocomplete working set is a single cache box — autocomplete is a memory-locality problem, not a compute one.
</details>

**T2.3** — A login tier verifies 3 k peak logins/s, each a deliberately slow password hash. Servers?

<details><summary>Answer</summary>

```
heavy (crypto) → 100/server:  3 k ÷ 100 ÷ 0.6 = 50 servers
```

Fifty boxes just to check passwords — hash cost is a fleet-sizing decision, which is why the Monday-9-AM login spike gets its own capacity plan.
</details>

**T2.4** — A distributed scheduler holds 20 M cron jobs, ~10 fires each per day. Peak dispatch QPS?

<details><summary>Answer</summary>

```
20 M × 10           -> 2 × 10^8 fires/day ÷ 10^5 = 2 k/s average
clustered on ":00"  -> event ×10 ≈ 20 k/s peak
```

The mean is trivial; the danger is everyone scheduling the top of the hour — jitter the dispatch or the scheduler DDoSes itself at every hour boundary.
</details>

**T2.5** — A feature store serves 100 M users × 500 features (~8 B each) online. RAM, and how many nodes?

<details><summary>Answer</summary>

```
per user: 500 × 8 B         -> 4 KB
100 M × 4 KB                -> 4 × 10^11 B = 400 GB logical
× 3 in-RAM replication      -> 1.2 TB ÷ 128 GB ≈ 10 nodes
```

Online feature serving is a ~10-node in-memory cluster, and "500 features/user" is the knob that sets it — cut the feature vector, cut the fleet.
</details>

**T2.6** — A stock-ticker service pushes a 1 KB snapshot once/s to 200 k concurrent clients. Egress?

<details><summary>Answer</summary>

```
200 k × 1 KB/s      -> 200 MB/s × 8 = 1.6 Gbps
```

1.6 Gbps of personalized pushes — two 1 Gbps ports, and no CDN can help because every stream is unique. Fan-out, not ingest, is the cost.
</details>

**T2.7** — A metrics pipeline ingests 50 k writes/s at 1 KB into an LSM store; the hot window holds ~2 TB. Nodes, and which bound?

<details><summary>Answer</summary>

```
by writes: 50 k ÷ 10 k TPS   -> 5 nodes
by size:   2 TB ÷ 2 TB       -> 1 node
writes bind                  -> ~5 nodes
```

Write throughput sets the cluster, not data size — this is an LSM problem by construction, and naming *which* arm of the max() binds is the whole answer.
</details>

**T2.8** — A social app fans a celebrity's post out to 10 M followers, SLA one minute. Peak delivery QPS?

<details><summary>Answer</summary>

```
10 M ÷ 60 s         -> ~170 k deliveries/s for a minute
```

One post becomes 170 k writes/s for sixty seconds — fan-out-on-write turns a single action into a burst, which is exactly why hot accounts get read-time fan-out instead.
</details>

## Tier 3 — Full-ladder sprints

Target: **5 minutes each, spoken end to end.** None of these appear in the walkthroughs — a new system tests the method where a familiar one tests memory. At every rung: state, compute, interpret. Split reads from writes at rung 2.

> 🎯 **In the room** — The rung you *skip* is part of the answer. "Storage is trivial here, moving on" in two seconds reads as mastery; grinding out a number no decision needs reads as a candidate on rails.

**T3.1** — *A pastebin.* 40 M MAU; users post text snippets and share them by link. Reads dominate (100:1); a paste is ~1 KB; most expire within a year.

<details><summary>Answer</summary>

```
users:    40 M MAU × 25%          -> 10 M DAU
actions:  writes: 5 M pastes/day ÷ 10^5 = 50/s -> ×3 = 150 writes/s peak
          reads:  100:1 → 500 M/day ÷ 10^5 = 5 k -> ×3 = 15 k QPS peak
bytes:    5 M × 1 KB = 5 GB/day × 5 = 25 GB/day provisioned
          ~1-year retention ≈ 9 TB; text ÷3 ≈ 3 TB -> one SQL node, shard only in the out-years
          read egress: 15 k × 1 KB = 15 MB/s ≈ 0.1 Gbps -> nothing
machines: cache = 20% × 500 GB = 100 GB -> one 128 GB node
          API: 15 k cached reads ÷ 10 k ÷ 0.6 ≈ 3 -> 5 boxes; shards: none
money:    ~5 boxes ≈ $5 k/month + storage noise
```

Pastebin is a small system pretending to be a big one — text never fills disks and the hot set fits one cache box. The only real design questions are link-id generation and abuse/expiry, not scale. Say that fast and you've read the system correctly.
</details>

**T3.2** — *Group video calls.* 10 M DAU, global; each in ~2 calls/day, average group of 4, ~30 min per call. Video runs at call bitrate, not broadcast.

<details><summary>Answer</summary>

```
users:    10 M DAU, global; peak concurrent = 10% × 10 M = 1 M users in calls at once
actions:  a streaming system, not a QPS one — signaling is trivial; bytes is the game
          stream ~10 MB/min (call bitrate ≈ 1/5 of the 50 MB/min 1080p anchor)
bytes:    in an SFU each user sends 1 stream, receives 3 -> receive = 3 × 10 MB/min = 0.5 MB/s
          peak egress = 1 M × 0.5 MB/s = 500 GB/s ≈ 4 Tbps         <- the system
          daily egress = 10 M × 2 calls × 30 min × 30 MB ≈ 18 PB/day
          storage: calls not recorded -> ~0
machines: SFU boxes are NIC-bound at 10 Gbps = 1.25 GB/s
          500 GB/s ÷ 1.25 ÷ 0.6 ≈ 700 boxes; no database story worth the breath
money:    18 PB/day × $100/TB ≈ $1.8 M/day if rented as cloud egress   <- non-starter
```

At ~$50M/month of egress-if-rented, the architecture is *forced*: you own edge datacenters and relay peer-to-peer where you can. This is precisely why real-time video companies don't live on public-cloud egress — the bill designs the system before you do.
</details>

**T3.3** — *An e-commerce flash sale.* A 50 M-DAU store drops a limited deal at noon; ~5 M users storm one product page inside a 10-minute window; ~500 k actually buy. Order row ~1 KB.

<details><summary>Answer</summary>

```
users:    a synchronized cohort — 5 M users inside a ~10-min (600 s) window, not diurnal
actions:  browse: 5 M × ~10 refreshes = 50 M ÷ 600 s ≈ 80 k QPS in-window
          front-loaded first seconds -> event ×10, not ×3 -> ~800 k QPS peak reads
          buys:   500 k orders ÷ 600 s ≈ 800 TPS, spiking to a few k on the drop
bytes:    orders: 500 k × 1 KB = 500 MB/day × 5 = 2.5 GB -> the ledger is tiny
          sale catalog: a few k SKUs × 1 KB = a few MB -> fits L2 cache
          read egress: 800 k × ~2 KB JSON = 1.6 GB/s ≈ 13 Gbps peak
machines: cached reads: 800 k trivial ÷ 10 k ÷ 0.6 ≈ 130 boxes (a 1 s-TTL edge -> far fewer)
          inventory writes converge on a handful of hot SKUs -> the wall is the row lock, not node TPS
          shards: data is tiny; you shard for write contention, never size
money:    tens of boxes for an hour -> noise; the cost is engineering, not hardware
```

The flash sale is small in bytes and brutal in contention: thousands of buyers racing one SKU's stock counter, so the design problem is oversell correctness — an atomic decrement or a reservation queue — not capacity. And the peak factor is ×10: reach for ×3 here and you under-size the front door threefold.
</details>

**T3.4** — *A transactional email service.* Sends 1 B emails/day on behalf of customers; each email ~50 KB; delivery events (open/click/bounce) arrive back ~3 per email.

<details><summary>Answer</summary>

```
users:    a machine pipeline, not human DAU — the base is 1 B sends/day
actions:  sends:  1 B ÷ 10^5 = 10 k/s -> campaigns/nightly batches ×3 = 30 k/s peak
          events: ~3× -> another 30 k writes/s inbound
bytes:    bodies: 1 B × 50 KB = 50 TB/day logical × 1.5 (blob, erasure-coded) = 75 TB/day -> 30-day store ≈ 2.25 PB
          headers + events only (~1 KB): 1 B × 1 KB × 5 = 5 TB/day -> 30 days ≈ 150 TB   (50× less)
machines: send workers (SMTP I/O): 30 k ÷ 1 k ÷ 0.6 ≈ 50 boxes
          event ingest 30 k writes/s -> LSM: 30 k ÷ 10 k = 3 nodes
          Kafka spine if bodies flow through it: 30 k × 50 KB = 1.5 GB/s ÷ 100 MB/s = 15 brokers
money:    keeping bodies: 2.25 PB × $20/TB ≈ $45 k/month just to archive copies
```

The entire cost swing is one product decision — store full message bodies (2.25 PB, ~$45k/month) or store only headers plus delivery events (~150 TB, noise). Transactional email is a retention-policy business wearing an SMTP costume; egress to mail servers (~50 TB/day) is the easy part.
</details>

**T3.5** — *IoT sensor telemetry.* A connected fleet of 2 M trucks; ~30% driving during ~10 active hours; each sends a ~1 KB telemetry packet every 5 s while moving. Keep 90 days hot.

<details><summary>Answer</summary>

```
users:    2 M trucks — machines; the danger is synchronization, not evenings
actions:  active: 30% × 2 M = 600 k driving × 0.2/s -> 120 k writes/s daytime, ~flat
          daily:  120 k × 3.5 × 10^4 active-s ≈ 4 B packets/day
bytes:    ingress: 120 k × 1 KB = 120 MB/s ≈ 1 Gbps sustained
          storage: 4 B × 1 KB = 4 TB/day raw; telemetry ÷10 -> 400 GB/day
          × 5 -> 2 TB/day provisioned; 90-day hot ≈ 180 TB
          live "where is truck X": 2 M × 1 KB = 2 GB -> one cache node
machines: by writes: 120 k ÷ 10 k LSM = 12 nodes
          by size:   180 TB ÷ 2 TB = 90 nodes   <- size binds -> ~90-node cluster
money:    ~90 boxes ≈ $90 k/month + archive -> storage-dominated
```

Retention, not ingest rate, sizes the cluster (90 nodes by bytes versus 12 by writes) — so the lever with the most leverage on cost is the hot-window length, and the entire live fleet position fits in 2 GB of RAM no matter how many trucks there are.
</details>

**T3.6** — *An online multiplayer match.* 20 M DAU, global; ~5 matches/day; a battle-royale match is 100 players for ~20 min; servers tick state ~20×/s. Each player sends ~20 inputs/s.

<details><summary>Answer</summary>

```
users:    20 M DAU, global; peak concurrent = 10% × 20 M = 2 M players in matches at once
actions:  matchmaking: 20 M × 5 = 100 M/day ÷ 10^5 = 1 k/s -> ×3 = 3 k/s peak -> trivial
          in-match:    2 M × 20 inputs/s = 40 M packets/s          <- the real load
bytes:    inputs ~100 B: 40 M × 100 B = 4 GB/s ingress
          egress: server pushes each player a ~1 KB world-delta 20×/s = 20 KB/s/player
                  2 M × 20 KB/s = 40 GB/s ≈ 300 Gbps               <- the system
          storage: match results ~1 KB: 100 M × 1 KB × 5 = 500 GB/day -> noise
machines: authoritative servers hold ~100 players each: 2 M ÷ 100 = 20 k game processes
          packing ~4 matches per 32-vCPU box -> ~5 k boxes, CPU/tick-bound not QPS-bound
money:    ~5 k boxes ≈ $5 M/month compute; egress is secondary
```

This is a compute-and-latency fleet, not a data system: 5,000 stateful game servers sized by players-per-tick, with a trivial results table as the only database. Matchmaking QPS — the thing a beginner sizes first — is a rounding error against the tick loop.
</details>

**T3.7** — *Geo check-ins.* 30 M DAU, global; each checks in ~3×/day and pulls a "places near me" feed ~20×/day. Check-in row ~1 KB; the places dataset is ~100 M POIs.

<details><summary>Answer</summary>

```
users:    30 M DAU, global -> ×3
actions:  writes (check-ins): 30 M × 3 = 90 M/day ÷ 10^5 = 900/s -> ×3 ≈ 3 k/s peak
          reads (nearby):     30 M × 20 = 600 M/day ÷ 10^5 = 6 k -> ×3 = 18 k QPS peak
          read:write ≈ 6:1 -> a read-leaning social app
bytes:    check-ins: 90 M × 1 KB = 90 GB/day × 5 = 450 GB/day -> ~160 TB/year
          places index: 100 M × 1 KB = 100 GB -> fits one cache node
machines: nearby query = spatial lookup, typical logic: 18 k ÷ 1 k ÷ 0.6 = 30 boxes
          hot places cache: 20% × (600 M × 1 KB = 600 GB) = 120 GB -> one 128 GB node
          shards: 160 TB/yr ÷ 2 TB ≈ 80 over years vs writes 3 k ÷ 1 k = 3 -> size binds, later
money:    ~30 boxes ≈ $30 k/month; egress trivial (JSON) -> order $30-40 k/month
```

The working set that matters is the places index (~100 GB, one box), not the check-in log. Geo check-ins is a read-mostly cache-and-spatial-index problem; the write ledger is small enough that you shard it for size only after a couple of years.
</details>

**T3.8** — *A logging pipeline.* 5,000 services emit a combined ~2 M log lines/s at ~1 KB; keep 7 days hot, 90 days cold. Logs compress hard.

<details><summary>Answer</summary>

```
users:    machine source: 2 M lines/s at ~1 KB, roughly flat (traffic-correlated)
actions:  ingest = 2 M writes/s -> the number the whole system is built around
bytes:    raw: 2 M × 1 KB = 2 GB/s
          Kafka spine: 2000 MB/s ÷ 100 MB/s = 20 brokers (× 3 replication -> ~60)
          logs ÷10 -> 200 MB/s stored; daily = 200 MB/s × 10^5 = 20 TB/day
          × 5 -> 100 TB/day provisioned; 7-day hot ≈ 700 TB
machines: index writes 2 M/s -> LSM: 2 M ÷ 10 k = 200 nodes (writes)
          by size: 700 TB ÷ 2 TB = 350 nodes -> both arms scream: a ~300-node tier either way
          query side is tiny (a few engineers grepping) — cost is ingest + retention
money:    ~300 boxes ≈ $300 k/month + Kafka + cold (90-day ≈ 2 PB compressed × $20 ≈ $40 k)
          -> order $400 k/month, producing zero revenue
```

A logging pipeline is a firehose you pay for and rarely read: 2 M writes/s forces a 300-node cluster and ~$400k/month, so the highest-leverage move is sampling and compression *at the source*, not scaling the sink. The cheapest log line is the one you never ship.
</details>

## Tier 4 — Fermi curveballs

Target: **3 minutes, structure over precision.** No system to design, sometimes no DAU given — just a quantity in the wild, an existing system with one assumption twisted, or a claim to audit. Name the factors before you touch a number. Population-scale inputs are calibration points, not canon — say them with a "~" in your voice.

> ⚠️ **Trap** — The adversarial ones want you to size the *average* when the pain is the *distribution*, or to reach for "petabytes" when the qualifier ("text only", "the fact not the row") makes it laptop-class. Read the framing twice before you multiply.

**T4.1** — A vendor benchmark claims a single cache node sustains 5 M ops/s. Plausible?

<details><summary>Answer</summary>

```
canon Redis ceiling: ~100 k ops/s/node
5 M ÷ 100 k         -> 50× over
```

Off by ~50×, so audit the definition of "op": it's probably 50 nodes reported as one, pipelined multi-key commands counted as single ops, or a RAM-only microbenchmark with the network amputated. Any single-node KV claim past a few hundred k should trip the alarm before you trust the slide.
</details>

**T4.2** — Your pastebin (from T3.1) goes viral: one paste is read 100 M times in a day. Which rung moves, and to what?

<details><summary>Answer</summary>

```
writes:  unchanged — still one 1 KB paste
reads:   100 M ÷ 10^5 = 1 k QPS average -> ×3 = 3 k QPS peak, all on ONE key
egress:  100 M × 1 KB = 100 GB for the day -> trivial in total
```

Total volume is nothing; the danger is a single hot key taking 3 k QPS — a hot-partition problem, solved by fronting *that one object* with a CDN or an in-process cache, not by scaling the whole tier. The trap is sizing the average when the distribution is the pain.
</details>

**T4.3** — An OS vendor ships a 2 GB update to 500 M devices in one day. Egress and cost?

<details><summary>Answer</summary>

```
500 M × 2 GB        -> 10^9 GB = 1 EB total
÷ 10^5 s            -> 10 TB/s average egress — impossible from an origin
CDN at $30/TB:      10^6 TB × $30 ≈ $30 M for the rollout
```

An exabyte in a day at 10 TB/s can only exist as a CDN-plus-peer problem — origin serves it once per edge, not once per device. This is why OS updates trickle out over days and lean on P2P: bandwidth, not the build, is why staged rollouts exist. Within 3× is a pass.
</details>

**T4.4** — A team proposes 200 shards for a 1 TB dataset taking 500 writes/s. Plausible?

<details><summary>Answer</summary>

```
by size:   1 TB ÷ 2 TB          -> under one node
by writes: 500 ÷ 1 k SQL        -> under one node
max()                           -> 1 shard; even ×5 provisioned (5 TB) = 3 shards
```

200 shards for a single-node workload is ~100× over — operational complexity bought for nothing. Run both arms of the shard max() and neither justifies more than a handful; over-sharding is as much a smell as under-sharding, and 30 seconds of running the Ladder downhill catches it.
</details>

**T4.5** — RAM to hold the live rank and score of every player of a 200 M-install game leaderboard?

<details><summary>Answer</summary>

```
per player: id 8 B + score 8 B  -> 16 B
200 M × 16 B                    -> 3.2 × 10^9 B ≈ 3 GB logical
× 3 in-RAM replication          -> ~10 GB -> one 128 GB box, easily
```

An entire game's leaderboard is one cache box — 16-byte facts about 200 M people are RAM-scale. So the hard part is never storage; it's the sorted-structure update rate and the top-K query. Within 3× is a pass.
</details>

**T4.6** — How long to rebuild a 100 TB search index by streaming it once from local NVMe at 3 GB/s?

<details><summary>Answer</summary>

```
100 TB = 10^14 B; NVMe ~3 GB/s = 3 × 10^9 B/s
10^14 ÷ 3 × 10^9    -> ~3 × 10^4 s ≈ 10 hours   (a third of a 10^5-s day)
```

~10 hours just to *read* the bytes once, before a byte of CPU work — so a full rebuild is an overnight batch, not an online operation. Need it faster? Parallelize across nodes (10 nodes -> ~1 hour) or go incremental. The disk-read floor is the real SLA, set by physics, not code.
</details>

**T4.7** — A broadcaster streams the cricket final to 50 M concurrent viewers at HD. Peak egress and delivery cost?

<details><summary>Answer</summary>

```
per viewer ≈ 50 MB/min ÷ 60  -> ~0.8 MB/s (the 1080p anchor)
50 M × 0.8 MB/s              -> 4 × 10^7 MB/s = 40 TB/s ≈ 300 Tbps peak
3-hour match (10^4 s):       40 TB/s × 10^4 = 4 × 10^5 TB = 400 PB
CDN: 4 × 10^5 TB × $30       -> ~$12 M for the match
```

~300 Tbps and ~$12M of delivery for one match — no single origin or CDN region survives it, so live sport rides many CDNs stitched together plus ISP-embedded edge caches. The bandwidth bill and the broadcast-rights bill are the same conversation. Within 3× is a pass.
</details>

**T4.8** — Twist on the Drills chapter's smart electricity meters: the utility changes 200 M meters to report every **1 second** instead of every 15 minutes. What breaks, quantitatively?

<details><summary>Answer</summary>

```
old: every 15 min = 900 s -> 200 M ÷ 900 ≈ 200 k writes/s
     write-bound: 200 k ÷ 10 k LSM = 20 nodes (Drills sized ~45 by bytes)
new: every 1 s            -> 200 M writes/s                 (~1000× jump)
bytes:  200 M/s × 100 B = 20 GB/s raw; × 10^5 s = 2 PB/day raw ÷10 = 200 TB ×5 = 1 PB/day
nodes:  200 M ÷ 10 k LSM  -> 20 k nodes
```

One word in the spec — "per second" — multiplies the write-bound cluster from ~20 nodes to ~20,000 and the daily provisioned store from ~1 TB to ~1 PB: a clean 1000× cost explosion for readings almost no one will ever query. The estimate exists to make someone justify the sampling rate *before* it ships. The senior move is to push back on the requirement, not to heroically size the 20k-node monster.
</details>
