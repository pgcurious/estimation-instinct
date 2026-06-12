# 3 — The numbers that matter

*Forty numbers, each with its why fused on. Everything else is multiplication.*

## The question this chapter answers

Eighty-odd entries sit in [the cheat sheet](../appendices/a-cheat-sheet.md) at the back of this book. Roughly half are one multiplication away from a neighbor — 125 MB/s is just 1 Gbps ÷ 8, the ×5 provisioning factor is just 3 × 1.5, the availability table is arithmetic on nines. What remains is about **forty irreducible anchors**, and they are the entire factual content of this skill. [Chapter 2](02-the-arithmetic-of-scale.md) gave you the arithmetic; this chapter stocks it with operands. [The next one](04-the-ladder.md) spends them.

Two failure modes bracket the problem. You cannot look numbers up — the canon says it plainly: *you cannot reason at speed with numbers you have to look up*, and the interview is conducted at speed. And you cannot memorize your way out: candidates who swallow two hundred benchmark figures find them gone, or jumbled, under interview adrenaline. What survives stress is not the bigger pile. It is the smaller pile with structure.

So the real question is not *which forty* — Appendix A settles that — but **why is each one the size it is**. A number with a physical cause attached can be rebuilt when you blank and defended when you're challenged. A bare number can do neither.

## From first principles

In the 1940s, Adriaan de Groot showed chess masters real game positions for a few seconds; they reproduced them almost perfectly. Shown random scatters of the same pieces, they did barely better than novices. The masters had never memorized boards — they had compressed decades of play into chunks, patterns with meaning, retrieved whole. A phone book of positions would have been useless. A vocabulary of structures was the skill.

Anchors work the same way. An anchor is not a fact; it is a number fused to its cause:

- **100 ns to touch RAM** — the request leaves the chip, and a DRAM row must charge.
- **~1k writes/s on one SQL node** — every commit waits for a disk and a replica, in order.
- **250 ms India ↔ US** — the Earth is large, and light in glass is only so fast.

The fusion is what makes the number load-bearing. Under stress, recall fails before reasoning does — and a number with a why can be *re-derived* mid-sentence when the value deserts you. It can also be defended: when an interviewer asks "where's that from?", the why is the answer, and it demonstrates more engineering than the estimate itself did. "I read it somewhere" spends credibility; "it's the durability path — fsync plus replica ack, milliseconds each, serialized" earns it.

What follows walks the canon's families and attaches the whys. Read it once for the arguments; drill it later for the values.

## The anchors

Every value below is quoted from [Appendix A](../appendices/a-cheat-sheet.md) — the one page this book asks you to own.

### The latency ladder

| Operation | Time | The physics |
|---|---|---|
| L1 cache hit | 1 ns | on the core itself |
| Main-memory reference | 100 ns | off-chip: centimeters of board, then a DRAM row charges |
| Read 1 MB from RAM | 50 µs | sequential streaming at ~20 GB/s |
| NVMe random read | 100 µs | a NAND page read, plus controller queueing |
| Read 1 MB from SSD | 1 ms | pipelined page reads — bandwidth, not seeking |
| Same-datacenter round trip | 0.5 ms | ~5 µs of fiber; the rest is switches and two kernels |
| Redis GET (in-DC, incl. network) | 0.5 ms | = the round trip; the hash lookup is noise |
| Indexed SQL query | 5 ms | B-tree descent in a warm buffer pool, plus parse and protocol |
| HDD seek | 10 ms | an arm sweeps, a platter rotates underneath |
| Read 1 MB over 1 Gbps | 10 ms | 1 MB ÷ 125 MB/s = 8 ms of wire time |
| Same-continent round trip | 50 ms | a few thousand km of fiber, a dozen router hops |
| Cross-continent round trip (India ↔ US East) | 250 ms | ~25,000 km round trip at two-thirds of c, plus detours |
| Human "instant" | 100 ms | perception's threshold — the budget everything above must fit inside |
| Human "I'll wait" limit | 1 s | where attention leaves |

Five rungs carry most design arguments; their whys deserve a sentence each.

**RAM, 100 ns.** The datum is centimeters away across board traces, and DRAM must charge a row of capacitors and sense it before answering. No moving parts — just electrons negotiating distance and capacitance, a hundred times slower than the desk-distance L1.

**NVMe, 100 µs.** Reading flash means waiting for a NAND page — tens of microseconds of cell physics — plus the controller's queue. Still no motion, but it's electrochemistry now: 1,000× the RAM touch.

**Same datacenter, 0.5 ms.** The kilometer of fiber costs ~5 µs; switching hops and two operating systems' network stacks cost the other 99%. Inside a building, latency is bureaucracy, not distance.

**Cross-continent, 250 ms.** The one rung you can derive from a globe:

```
India ↔ US East, great circle  ≈ 12,500 km → ~25,000 km round trip
light in fiber                 ≈ 200,000 km/s   (two-thirds of c)
propagation floor              = 25,000 km ÷ 200,000 km/s ≈ 125 ms
real cables detour             ≈ ×1.5            → ~190 ms
routers and queueing           → ≈ 250 ms observed
```

This rung is physics wearing a network's clothes. No vendor roadmap shortens the Earth.

**HDD seek, 10 ms.** A metal arm physically sweeps across the platter, then waits for the sector to rotate underneath — ~5 ms of motion plus ~4 ms of rotation at 7,200 rpm. The only number on the ladder you could once *hear*: the crunch from an old server room was 10 ms, on loop.

The canon's anchor-thoughts hand you a frame for the whole column: L1 is the desk in front of you, RAM a shelf across the room, the in-DC hop is across the building — extend it: same continent is across town, cross-continent is another continent, literally. The city frame holds the *order*. For magnitude, the canon's law: **each storage tier is ~3 orders of magnitude slower than the one above it** (RAM ns → SSD µs–ms → network/disk ms) — and its corollary, which is most of the job: *designs are arguments about which tier your hot path touches.*

One reread of the table pays immediately: the Redis row equals the network row. A cache hit is a *network operation* — the microseconds of hashing vanish inside the 0.5 ms round trip. [Memory & cache](../part-2-core-estimations/08-memory-and-cache.md) builds on exactly this.

> ⚡ **Instinct check** — Hot path: one Redis GET, then one indexed SQL query, same DC. The latency floor? … 0.5 + 5 ≈ 6 ms — the "fast cache" is under 10% of it. Cache the query's *result* and the floor drops ~10×.

### One server: the 100 / 1k / 10k rule

The canon's reference machine is a commodity box: 32 vCPU, 128 GB RAM, 10 Gbps. What it sustains depends only on what one request costs:

| Work per request | Looks like | Per server |
|---|---|---|
| ~1 ms CPU — trivial | proxy, cache hit | ~10,000 QPS |
| ~10 ms CPU — typical | business logic | ~1,000 QPS |
| ~100 ms CPU — heavy | ML inference, crypto, fan-out | ~100 QPS |

Most candidates carry the right-hand column as three facts. Carry it as **one fact and a division** — the worked example below rebuilds it in twenty seconds, which is the difference between citing a rule and owning it.

### Storage engines and sockets: the ceilings

| Engine / resource | Per node | Why it's that size |
|---|---|---|
| SQL reads (Postgres/MySQL) | ~5,000 QPS | warm B-tree reads cost a few core-ms each |
| SQL writes | **~1,000 TPS** | fsync + replica ack + B-tree updates — milliseconds, serialized |
| LSM writes (Cassandra-style) | ~10,000 TPS | sequential appends now, compaction later |
| Redis / in-memory KV | ~100,000 ops/s | no disk, no SQL parse — ~10 µs per op on one event-loop core |
| Concurrent WebSockets | plan ~100k/server | sockets cost RAM and file descriptors, not CPU |

Walk the SQL write path once and ~1k stops being arbitrary. A commit may not return until its WAL record is physically on disk — a millisecond-ish fsync on typical volumes — and, for durability worth having, acknowledged by a replica half a millisecond away; around that, B-tree pages and every index take their updates. Group commit shares one fsync among all waiting transactions, which is exactly why the ceiling lands in the low thousands instead of the hundreds. **Writes are the wall**: reads escape by copying; writes must land, in order, durably.

LSM stores reach ~10k by refusing to do that work at write time: a write is a log append plus a memtable insert, and the sorting and merging are deferred to background compaction. The expensive work isn't avoided — it's moved off the latency path.

Redis reaches ~100k because nothing is in the way: no disk in the path, no SQL to parse, a single-threaded event loop touching RAM. At ~10 µs per operation, one core does 100,000 a second — that is the entire derivation. The other 31 cores are spectators; the box's true limit is whether your working set fits 128 GB. RAM-bound, not CPU-bound.

WebSocket capacity isn't a rate at all — it's a stock. An idle connection costs a file descriptor and a few tens of KB of buffers; 100k of them is a few GB of a 128 GB box and almost no CPU. Tuned fleets hold 1M+, but plan 100k — heartbeats, TLS, and the reconnect stampede after a deploy eat the margin.

> 🎯 **In the room** — "About a thousand writes a second on one Postgres" is a flashcard. "About a thousand — every commit is an fsync plus a replica ack, and those serialize" is experience. Cite ceilings with the why attached: it pre-answers the challenge, and when the interviewer says *their* fleet does 10k, the why tells you what must differ — NVMe fsyncs, relaxed durability, batching — so you adopt their number without losing your method.

### Object sizes

| Object | Size |
|---|---|
| int64 / timestamp / pointer | 8 B |
| UUID | 16 B |
| URL | ~100 B |
| Short text post | ~300 B |
| **Typical DB row / JSON payload / log line** | **~1 KB** |
| Thumbnail image | ~20 KB |
| Feed-quality photo | ~200 KB |
| Original phone photo | ~2 MB |
| Web page, total transfer | ~2 MB |
| 1 min video, all renditions stored | ~100 MB |

Two derivations, to show the family is honest. A database row is a couple dozen fields at a few bytes each plus index overhead — call it 1 KB. A feed photo is a megapixel or two at 3 bytes per pixel, divided by ~20× of JPEG's mercy — ~200 KB. Video: 1080p streams at ~5 Mbps ≈ 40 MB per minute, call it 50 stored — and ~100 MB once every rendition is kept. Notice the table climbs in roughly decade steps, so the *class* matters more than the bytes: misfile a photo as a record and you're 200× out before any refinement can save you.

When you don't know, the canon's default: **1 KB for a record, 1 MB for a media object** — then refine. Saying "call it a kilobyte" and moving is a hire signal; stalling for the true value is not.

### People and behavior

The only family whose whys are about humans rather than silicon — so each rationale fits in a breath. ([Traffic](../part-2-core-estimations/05-traffic.md) derives the peak factors properly.)

| Ratio | Default | The why, in one line |
|---|---|---|
| DAU / MAU | **25%** | the median user shows up about one day in four; sticky messengers, every other day → 50% |
| Peak concurrent / DAU | 10% | each active user is present ~1.5 of the ~16 waking hours |
| Peak factor — global | **×3** | the sun bunches evenings together; the busiest hour runs ~3× the average second |
| Peak factor — single-region | ×5 | the whole day compresses into ~8 real hours |
| Peak factor — event-driven | ×10+ | habit spreads traffic; a flash sale or a final over fires a starting gun |
| Read:write — feeds, content | **100:1** | one author, a hundred lurkers — written once, read by crowds |
| Read:write — typical web app | 10:1 | most screens display; few submit |
| Read:write — chat, telemetry | ~1:1 | each event written once, read about once — then × fan-out |
| Hot content | 20% takes 80% of reads | popularity is a power law; the hot head is small enough to buy RAM for |

The last row is the cache-sizing law — it is why the canon sizes a cache at 20% of a day's read volume and trusts it to absorb most of the traffic.

### Money

| Item | Cost | Reflex |
|---|---|---|
| Compute | ~$30 per vCPU-month | **the 32-core box ≈ $1k/month** |
| Object storage (S3-class) | ~$20 per TB-month | storage is cheap |
| Egress to internet | ~$100 per TB | egress runs the bill |
| CDN delivery, at volume | ~$30 per TB | why CDNs exist, in one number |
| One engineer, fully loaded | ~$15k/month | the build-vs-buy unit |

Three reflexes order every cost conversation. **Storage is cheap**: at $20 per TB-month, keeping bytes is rarely the problem. **Egress is expensive**: the same terabyte costs $100 every time it leaves — five months of storage per exit — which is why architectures bend toward CDNs, and toward not moving bytes at all. **Engineers are the most expensive component**: $15k a month is fifteen 32-core boxes, so any build-vs-buy that trades a month of engineering for a few boxes of savings has already lost. The $1k/month box is the unit of compute thought: price designs in boxes first, dollars second. (Rounding out the canon: block SSD storage runs ~$100 per TB-month — 5× object storage — and managed databases ~2× their equivalent compute.)

## 🧮 Worked example — rebuilding the rule from cores

Minute 22. The interviewer asks how many API servers, and the 100/1k/10k rule has evaporated. Rebuild it:

```
one second on 32 cores   = 32 cores × 1,000 ms ≈ 32,000 core-ms
× 0.6 target utilization   (size to 60% — canon headroom rule)
× ~0.5 lost in-process     (locks, GC, syscalls, serialization)
usable budget            ≈ 32,000 core-ms × 0.3 ≈ 10,000 core-ms per second
```

Then divide by the price of one request:

```
trivial  ≈ 1 ms CPU/request    → 10,000 ÷ 1   ≈ 10,000 QPS
typical  ≈ 10 ms CPU/request   → 10,000 ÷ 10  ≈ 1,000 QPS
heavy    ≈ 100 ms CPU/request  → 10,000 ÷ 100 ≈ 100 QPS
```

Spoken: "A 32-core box gives me thirty-two thousand core-milliseconds every second. I size to 60% utilization, and real services lose about half the rest to locks, GC, and the kernel — call it ten thousand useful core-milliseconds a second. Typical business logic costs maybe 10 ms of CPU per request, so about a thousand requests a second per box."

The rule is one number — **~10,000 usable core-ms per second** — and a division. That also tells you what it is *not*: a promise about your code. Profile a request at 40 ms of CPU and yours is a 250-QPS box; the method absorbs the new fact without flinching.

## Making forty numbers permanent

Three mechanisms, in increasing order of value.

**Spaced repetition for the values.** The [Anki deck](../../drills/anki-anchor-numbers.csv) carries the anchors as flashcards — ten minutes a day while the kettle boils. Necessary, not sufficient: cards build recognition, and the interview tests recall, out loud.

**Blank-page reproduction for the structure.** Once a week, write the ladder and the ceilings from memory, then diff against [the cheat sheet](../appendices/a-cheat-sheet.md). [The 30-day program](../part-4-instinct/24-the-30-day-program.md) puts a blank page in front of you on day 7 and assumes the full sheet from memory by day 10. The diff is the lesson: the rung you misplace is the rung you never attached a why to.

**Stories for the whys.** Don't rehearse "250"; rehearse *the Earth is big and light is slow in glass* — the value precipitates. Don't rehearse "1,000"; rehearse *the commit waits for the disk and the replica, in order*. Lists decay under adrenaline; causes don't. This is the chess master's chunk again: you are not storing forty numbers, you are storing forty small machines that emit numbers on demand.

## When your numbers disagree with mine

They will. Your tuned Postgres on local NVMe serves 30k reads a second, with dashboards to prove it — six times this book's anchor. Nothing is broken. The canon's values are deliberately conservative, deliberately round, and current as of 2026; your fleet is specific. **Update the anchor; keep the method.** The strongest move in the room owns both: "I've run Postgres at 30k reads a second on NVMe — the textbook number is 5k — and either way, 200k peak reads means a cache in front." A physician carries 72 bpm and 120/80 as baselines and reads illness as deviation; when the patient is a marathoner resting at 50, she updates the baseline, never the discipline.

Anchors also rot, at very different speeds. The physics rungs barely rot: India ↔ US has a ~125 ms floor until the Earth shrinks, and RAM has answered in ~100 ns for twenty years. The hardware middle rots by generations — 2010's ladder had no NVMe rung at all, and the place where "disk" sits has moved 100× since. Prices rot fastest; re-check the money table yearly. But notice what has never rotted: the shape. Tiers separated by ~3 orders of magnitude survived tape, disk, and flash intact. When a remembered value and the shape disagree, trust the shape and re-derive the value.

## ⚠️ Traps

- **Memorizing the precise number instead of the usable one.** 86,400 is the trap; 10^5 is the tool. The canon already priced that rounding — ~15% under-count, swallowed by the peak factor — so the extra digits buy nothing and cost speed. Precision is not accuracy; in an interview it's drag.
- **Carrying a dead decade's hardware.** The 2010 lists were right *then*: "disk" meant a 10 ms arm. Quote that against a fleet on NVMe and you've misplaced the middle of the ladder by 100×. If your numbers come from a list older than your phone, re-learn the storage rows.
- **Citing a ceiling you can't justify.** "Where's the 1k from?" has two survivable answers: the why, or "let me derive it." "I read it somewhere" converts an anchor into a liability and taxes every number you say afterward.
- **Same numeral, different dimension.** Redis's 100k is a *rate* — operations per second. The WebSocket 100k is a *stock* — connections held open. Blur rates with stocks and you'll size an edge tier in QPS, which is the wrong wall entirely.

## Numbers to keep

- ~40 anchors plus derivation rules beat 400 facts — an anchor is a number fused to its why
- The ladder's spine: 100 ns RAM · 100 µs NVMe · 0.5 ms same-DC · 5 ms SQL read · 10 ms HDD seek · 50 ms same-continent · 250 ms cross-continent — each storage tier ~3 orders slower than the one above
- One server = ~10,000 usable core-ms/s → 100 / 1k / 10k QPS for heavy / typical / trivial work
- Ceilings: SQL ~1k write TPS (the wall), LSM ~10k, Redis ~100k ops/s, ~100k WebSockets held
- Defaults: 1 KB record, 1 MB media; DAU = 25% of MAU; peak ×3; content reads 100:1; hot 20% takes 80%
- Money: box $1k/month, storage $20/TB-month cheap, egress $100/TB expensive, engineer $15k/month most expensive
- When reality disagrees: update the anchor, keep the method — the ladder's shape outlives its values

## Drills

**Drill 3.1** — Blank page, five minutes: reproduce the latency ladder from the desk to another continent — every rung you can, with values. Then diff against [Appendix A](../appendices/a-cheat-sheet.md).

<details><summary>Answer</summary>

The spine to check against:

```
L1 1 ns → RAM 100 ns → NVMe random read 100 µs → same-DC RTT 0.5 ms
→ indexed SQL 5 ms → HDD seek ≈ 1 MB over 1 Gbps ≈ 10 ms
→ same continent 50 ms → cross-continent 250 ms
budgets: human "instant" 100 ms, "I'll wait" 1 s
```

Score the diff, not the attempt. Most people misplace NVMe — park it as "1,000× a RAM touch" and it stays. So-what: a rung you can't place from memory is a rung your next design will silently cross a thousand times too often.
</details>

**Drill 3.2** — Justify the anchor. The interviewer pushes: "You said a thousand writes a second, but a CPU does billions of operations a second. Where did six orders of magnitude go?" Answer in three sentences.

<details><summary>Answer</summary>

Durability and order, not compute. A commit can't return until its WAL record is physically on disk (~1 ms-ish fsync on typical volumes) and acknowledged by a replica (≥ 0.5 ms round trip), with B-tree and index pages updated around it — and that path serializes.

```
~1 ms per serialized commit unit → ~10^3 TPS
group commit shares the fsync    → the low thousands, no further
```

So-what: it's a durability ceiling, not a compute ceiling — which is why the escapes are *defer* (LSM) or *amortize* (batching, queues), and never "a faster CPU."
</details>

**Drill 3.3** — Spot the rotten number. A design doc asserts: "Random disk read ≈ 10 µs, so checking 100 random records costs ~1 ms — fine on the hot path." Find both errors.

<details><summary>Answer</summary>

```
NVMe random read = 100 µs → 100 reads ≈ 10 ms    (10× the claim)
HDD seek         = 10 ms  → 100 reads ≈ 1 s      (1,000× the claim)
```

First error: 10 µs is a phantom rung — between RAM at 100 ns and NVMe at 100 µs, nothing answers. Second: 100 *random* reads on a hot path should trigger "batch, index, or cache" before any latency figure is quoted. So-what: numbers that fall between rungs are the easiest fictions to catch — the ladder doubles as a fraud detector.
</details>

**Drill 3.4** — Your laptop has 8 performance cores. Derive its 100/1k/10k equivalents.

<details><summary>Answer</summary>

```
8 cores × 1,000 ms     = 8,000 core-ms per second
× ~30% usable          ≈ 2,500 core-ms per second
trivial  ~1 ms CPU     → ~2,500 QPS
typical  ~10 ms CPU    → ~250 QPS
heavy    ~100 ms CPU   → ~25 QPS
```

So-what: the rule is linear in cores, and the 30% is the part people drop — skip it and you promise a box three times what it delivers, then meet the difference at peak, in production.
</details>

**Drill 3.5** — A design stores 1 PB and sends 1 PB a month to the internet, raw. Which line dominates the bill, by how much, and what's the first architectural response?

<details><summary>Answer</summary>

```
storage: 1,000 TB × $20/TB-month = $20k/month
egress:  1,000 TB × $100/TB      = $100k/month   — 5× storage
via CDN: 1,000 TB × $30/TB       = $30k/month    — the dominant line, cut ~3×
```

Egress dominates 5:1; the first response is a CDN — and asking which bytes need to leave at all. So-what: the bill follows bytes in motion, not bytes at rest. That reflex decides the CDN conversation before a single box is drawn.
</details>

---
[← Previous: The arithmetic of scale](02-the-arithmetic-of-scale.md) · [Table of contents](../../README.md) · [Next: The Ladder →](04-the-ladder.md)
