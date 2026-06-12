# 23 — Drills

*The chapters taught you the moves. This is the floor where you repeat them until they disappear.*

Reading this book builds recognition — "yes, that chain looks right." The interview tests recall — producing the chain from nothing, mid-sentence, with someone watching. These drills close that gap, and they work only under four conditions. **Speed targets are part of the drill**: a reflex you have to think about is not a reflex yet, so when you blow the target, that's the drill telling you which anchor to re-memorize. **Out loud, always** — every answer spoken, even alone in a room, because the instinct you're building is verbal and silent practice trains the wrong muscle. **Calibration over correctness**: being 2× off and knowing exactly which step caused it is a better result than being right by luck, which is why this chapter ends with a log, not a score. A tabla player's daily riyaz is the same tedious ten minutes of strokes for years — and it is the entire difference between knowing a composition and being unable to play it wrong. This floor is your riyaz. Every answer below traces to [the cheat sheet](../appendices/a-cheat-sheet.md); when you disagree with one, the sheet wins.

> ⚠️ **Trap** — Reading an answer feels identical to producing one and is worth almost nothing. Say your number first, *then* open the collapse. If you peeked, log it as a miss — nobody is watching, which is exactly why it counts.

## Tier 1 — Arithmetic reflexes

Target: **10 seconds each**, no paper. These are the strokes; everything else in the book is compositions.

**T1.1** — 10^6 × 10^3 = ?

<details><summary>Answer</summary>

10^9. A million KB-sized things is a GB — the canon calls that sentence, as reflex, half this book.
</details>

**T1.2** — 10^12 ÷ 10^7 = ?

<details><summary>Answer</summary>

10^5. Division at scale is exponent subtraction — the same move every rung-2 QPS line makes.
</details>

**T1.3** — (4 × 10^8) × (3 × 10^4) = ?

<details><summary>Answer</summary>

12 × 10^12 ≈ 1.2 × 10^13. Mantissas multiply, exponents add, renormalize — three steps, one breath.
</details>

**T1.4** — 600 M actions a day. Average QPS?

<details><summary>Answer</summary>

```
6 × 10^8 ÷ 10^5 = 6,000 QPS
```

Dividing by 10^5 should feel like deleting five zeros, not doing division.
</details>

**T1.5** — A service holds 2 k QPS average around the clock. How many actions a day?

<details><summary>Answer</summary>

```
2 × 10^3 × 10^5 = 2 × 10^8 = 200 M/day
```

The ladder runs uphill too — interviewers love handing you the bottom rung.
</details>

**T1.6** — 150 M uploads a month. Per second?

<details><summary>Answer</summary>

```
150 M ÷ 2.5 × 10^6 s = 60/s
```

Months divide by 2.5 × 10^6 — if you reached for 30 × 86,400 you've already lost the ten seconds.
</details>

**T1.7** — A sensor fleet writes 50 records/s. Records per year?

<details><summary>Answer</summary>

```
50 × 3 × 10^7 s = 1.5 × 10^9 = 1.5 B/year
```

The year multiplier 3 × 10^7 turns any rate into a retention conversation.
</details>

**T1.8** — 500 GB/day, kept 90 days. Total in TB?

<details><summary>Answer</summary>

```
500 GB × 90 = 45,000 GB = 45 TB
```

GB→TB is ÷10^3 — climb the unit ladder before the number gets quoted in the wrong unit.
</details>

**T1.9** — 2 × 10^11 records at 1 KB each. Total, in a unit you'd say aloud?

<details><summary>Answer</summary>

```
2 × 10^11 KB = 2 × 10^14 B = 200 TB
```

KB to bytes is +3 on the exponent; 10^14 B has a name — say "200 terabytes," never "2 times 10 to the 14."
</details>

**T1.10** — 30% of 4 × 10^7?

<details><summary>Answer</summary>

1.2 × 10^7 = 12 M. Percentage cuts are mantissa work — the exponent just watches.
</details>

**T1.11** — Daily read volume is 600 GB. The cache rule's 20%?

<details><summary>Answer</summary>

120 GB — which *just* fits a 128 GB box, and noticing that fit is the entire point of the cut.
</details>

**T1.12** — Your NIC says 1 Gbps. How many MB/s of payload?

<details><summary>Answer</summary>

125 MB/s — bits divide by 8 before they become bytes. Answering "1,000" is the single most common unit trap in bandwidth math.
</details>

**T1.13** — A press release claims 30 crore users. How many million?

<details><summary>Answer</summary>

300 M. One crore = 10^7, one lakh = 10^5 — converting between the Indian and Western ladders without pausing is a real interview skill on both sides of the ocean.
</details>

**T1.14** — 300 writes/s, peak ×3, replication ×3. Peak row-writes/s, one significant figure?

<details><summary>Answer</summary>

```
300 × 3 × 3 = 300 × 9 ≈ 300 × 10 = 3,000/s
```

3 × 3 ≈ 10 — the +11% error is beneath estimation noise, and the shortcut keeps you talking instead of multiplying.
</details>

**T1.15** — You use 10^5 s/day instead of 86,400. Does your QPS come out high or low, and by how much?

<details><summary>Answer</summary>

Low, by ~15% — you divided by a bigger number. Name it once ("known under-count, the peak factor swallows it") and never apologize for it again.
</details>

## Tier 2 — Single-rung drills

Target: **30 seconds each**. Each drill exercises exactly one pocket formula from [the cheat sheet §10](../appendices/a-cheat-sheet.md). The routine: say the formula first, then push the numbers through it — formula, compute, interpret.

**T2.1** — A global news app has 40 M DAU; each opens it 5 times a day. Peak QPS?

<details><summary>Answer</summary>

```
40 M × 5 = 200 M/day ÷ 10^5 = 2 k QPS average
global → ×3              ≈ 6 k QPS peak
```

6k peak of typical logic is a ~10-server tier — say that, or the number was decoration.
</details>

**T2.2** — An India-only quiz app: 8 M DAU × 25 actions/day. Peak QPS?

<details><summary>Answer</summary>

```
8 M × 25 = 200 M/day ÷ 10^5 = 2 k QPS average
single region → ×5           = 10 k QPS peak
```

Same average as T2.1, 70% more peak — the peak factor is a judgment, and ×3 on a one-country app is the judgment interviewers catch.
</details>

**T2.3** — A notes app writes 20 M notes/day at ~1 KB each, kept 5 years. Provisioned storage?

<details><summary>Answer</summary>

```
rate:  20 M ÷ 10^5 = 200 writes/s × 1 KB = 200 KB/s
year:  200 KB/s × 3 × 10^7 s = 6 TB/year logical
× 5 (replication + overhead) = 30 TB/year → 150 TB over 5 years
```

150 TB says "sharded by year three" — without the ×5 you'd have said 30 TB and "one node forever," and been wrong in production, not just in the room.
</details>

**T2.4** — A photo app ingests 10 M feed-quality photos a day. Provisioned storage per year?

<details><summary>Answer</summary>

```
10 M × 200 KB = 2 TB/day logical
× 5           = 10 TB/day → ≈ 3.5 PB/year
```

At PB scale the senior move is to renegotiate the multiplier: blob stores are erasure-coded, ×1.5 not ×5 — call it ~1 PB/year — and saying *why* the multiplier changed is worth more than either number.
</details>

**T2.5** — An API serves 20 k QPS peak with ~1 KB responses. Egress in Mbps, and does one 1 Gbps port hold it?

<details><summary>Answer</summary>

```
20 k QPS × 1 KB = 20 MB/s × 8 = 160 Mbps
port: 20 ÷ 125 MB/s ≈ 16% of 1 Gbps
```

Comfortably one port. The ×8 is where bandwidth answers go to die — do it out loud.
</details>

**T2.6** — A catalog service does 800 M reads/day at ~1 KB. Cache size, and how many boxes?

<details><summary>Answer</summary>

```
read volume: 800 M × 1 KB = 800 GB/day
hot 20%:                  = 160 GB → 2 × 128 GB nodes
```

160 GB is 25% over one box — the answer is "two nodes, or trim the working set," and noticing the *just-misses* is what the formula is for.
</details>

**T2.7** — 30 k peak QPS of cache-hit redirects. Servers?

<details><summary>Answer</summary>

```
trivial work → 10 k/server:  30 k ÷ 10 k ÷ 0.6 = 5 servers
```

The work classification did all the thinking; the division is clerical.
</details>

**T2.8** — 3 k peak QPS of ML inference. Servers?

<details><summary>Answer</summary>

```
heavy work → 100/server:  3 k ÷ 100 ÷ 0.6 = 50 servers
```

One-tenth the QPS of T2.7, ten times the fleet — the 100/1k/10k judgment moves answers by 100×, which is why it's the one divisor you must say out loud.
</details>

**T2.9** — A SQL dataset is 30 TB and takes 500 writes/s. Shards, and which trigger bound?

<details><summary>Answer</summary>

```
by size:   30 TB ÷ 2 TB = 15 shards
by writes: 500 ÷ 1,000 TPS = under one node
```

Size binds — 15 shards. Naming the binding trigger is the answer; the count is just its consequence.
</details>

**T2.10** — A Cassandra-style store holds 1 TB but takes 25 k write TPS. Nodes, and which trigger bound?

<details><summary>Answer</summary>

```
by size:   1 TB ÷ 2 TB = under one node
by writes: 25 k ÷ 10 k TPS = 2.5 → 3 nodes
```

Writes bind — the mirror image of T2.9. Run both arms of the max() every time; the wrong arm is a silent 10× error.
</details>

**T2.11** — 10 servers, 200 TB stored, 300 TB egress/month. Monthly bill, and the dominant term?

<details><summary>Answer</summary>

```
compute: 10 × $1 k        = $10 k
storage: 200 TB × $20     = $4 k
egress:  300 TB × $100    = $30 k     ← ~70% of $44 k
```

Egress dominates 3:1 over compute — which is the cheat sheet's "egress runs the bill" reflex wearing real numbers, and the argument for a CDN in one line.
</details>

**T2.12** — A telemetry collector ingests 50 k events/s at ~1 KB. Ingress in Gbps — is one port enough?

<details><summary>Answer</summary>

```
50 k × 1 KB = 50 MB/s ≈ 0.4 Gbps
```

Under half a 1 Gbps port — ingress is rarely the wall, and proving it in one line buys you the right to ignore it.
</details>

**T2.13** — Inversion: you have exactly one 128 GB cache node. What daily read volume can it front?

<details><summary>Answer</summary>

```
128 GB = 20% of X → X = 640 GB/day ≈ 600 GB
≈ 6 MB/s ÷ 1 KB ≈ 6 k QPS of 1 KB reads, sustained
```

Formulas run backwards: given the hardware, derive the load it implies — the same trick T1.5 did with time.
</details>

## Tier 3 — Full-ladder sprints

Target: **5 minutes each, spoken end to end** — that is roughly the time a real round gives you, including the talking. None of these systems appear in Part III, deliberately: repeating familiar walkthroughs tests memory, and a new system tests the method. At every rung: state, compute, interpret.

> 🎯 **In the room** — In a sprint, the rung you *skip* is part of the answer. "Bandwidth is trivial here, moving on" said in two seconds reads as mastery; computing a number nobody needs reads as a candidate on rails.

**T3.1** — *The exam-results portal.* 10 M students' board results go live at exactly 10 AM. Assume each student (or their parents) checks ~3 times within the first hour; a result record is ~1 KB; the page shell is a ~2 MB web page.

<details><summary>Answer</summary>

```
users:    10 M, all inside one hour — a synchronized cohort; peak factors don't apply, derive from the window
actions:  10 M × 3 checks = 30 M requests ÷ 3,600 s ≈ 8 k QPS mean in-window
          front-loaded first minutes → ×3 ≈ 25 k QPS peak, ~100% reads
bytes:    dataset: 10 M × 1 KB = 10 GB — the entire country's results fit in one box's RAM
          egress:  30 M × 2 MB shell = 60 TB in an hour ← the real number
          origin JSON: 30 M × 1 KB = 30 GB — trivial
machines: cached JSON = trivial work: 25 k ÷ 10 k ÷ 0.6 ≈ 4 → 5 servers; shards: none (10 GB)
money:    60 TB × $30 CDN ≈ $2 k for the morning ($6 k raw egress)
```

The whole dataset fits in RAM and every request is a read — so this is a CDN-plus-cache problem, pre-warmed before 10 AM. Size it like a normal day (10 M ÷ 10^5 = 100 QPS) and you are 250× under: this system exists *only* at its peak.
</details>

**T3.2** — *A national e-toll system.* 50 M registered vehicles; on a given day 20% cross 2 toll plazas each. A transaction record is ~1 KB, kept 7 years for audit; every crossing checks balance and blacklist.

<details><summary>Answer</summary>

```
users:    50 M vehicles → 20% × 2 = 20 M crossings/day
actions:  20 M ÷ 10^5 = 200 TPS average; one country, highway rush → ×5 ≈ 1 k TPS peak
          + ~2 reads per crossing (balance, blacklist) ≈ 2 k read QPS peak
bytes:    20 M × 1 KB = 20 GB/day logical × 5 = 100 GB/day ≈ 35 TB/year → ~250 TB over 7 years
machines: full account + blacklist state: 50 M × 1 KB = 50 GB → the entire fleet fits one cache node
          API: 3 k peak QPS typical → 3 k ÷ 1 k ÷ 0.6 = 5 servers
          writes: 1 k TPS peak = exactly one SQL node's ceiling → queue at the plaza, or shard by region
money:    ~10 boxes ≈ $10 k + 250 TB × $20 ≈ $5 k → ~$15 k/month — noise
```

Scale is small — the country's whole account state is one Redis node. The estimate's real finding: peak writes sit *at* the SQL wall, and plazas tolerate seconds of lag, so a queue in front of the ledger turns a throughput problem into the correctness problem (idempotent debits) it actually is.
</details>

**T3.3** — *Smart electricity meters.* 200 M meters report a ~100 B reading (id, timestamp, kWh) every 15 minutes. Keep 90 days hot, archive the rest.

<details><summary>Answer</summary>

```
users:    200 M meters — machines, not humans: no evenings, no weekends
actions:  ~100 readings/meter/day → 2 × 10^10 writes/day ÷ 10^5 = 200 k writes/s, flat
          unless firmware syncs to the quarter-hour: 200 M ÷ 10 s window = 20 M/s — 100× the mean
bytes:    2 × 10^10 × 100 B = 2 TB/day raw; telemetry logs compress ÷10 → 200 GB/day
          × 5 → 1 TB/day provisioned; 90-day hot set ≈ 90 TB
machines: by writes: 200 k ÷ 10 k LSM TPS = 20 nodes
          by size:   90 TB ÷ 2 TB = 45 nodes ← size binds: a ~45-node cluster
money:    ~45 boxes ≈ $45 k/month + archive (~100 TB/year × $20 ≈ $2 k) → ~$50 k/month, compute-dominated
```

A machine fleet has no peak factor — its danger is synchronization: if every meter reports on the clock tick, a calm 200 k/s becomes a 20 M/s spike, so jitter the schedule and the problem never exists. And note *size*, not write rate, forced the cluster — meaning the node count is really a retention argument.
</details>

**T3.4** — *A stock broker's live price fanout.* 10 M DAU during market hours; 1 k tickers, each updating ~10×/s while trading; the average watchlist holds 20 tickers. Prices are pushed live.

<details><summary>Answer</summary>

```
users:    peak concurrent = 10% × 10 M = 1 M open sockets at the opening bell
actions:  raw ticks: 1 k tickers × 10/s = 10 k updates/s — tiny ingest
          naive fanout: 1 M × 20 = 20 M subscriptions → 20 k subscribers/ticker
          deliveries = 10 k × 20 k = 2 × 10^8 msgs/s ← non-starter, say so immediately
          conflate to 1 snapshot/client/s → 1 M msgs/s — a 200× cut from one product decision
bytes:    1 M/s × 1 KB snapshot = 1 GB/s ≈ 8 Gbps egress; ~6 h session (2 × 10^4 s) ≈ 20 TB/day
          tick history: 10 k/s × 100 B × ~10^7 trading-s/year = 10 TB/year — modest
machines: sockets size the edge: 1 M ÷ 100 k = 10 boxes — but each then pushes 100 k msg/s,
          at the in-memory ceiling → ÷ 0.6 ≈ 17, run 20
money:    egress 600 TB/month × $100 = $60 k/month + ~$20 k of boxes — no CDN rescue: every stream is personal
```

The load-bearing number is fanout, and it is set by a product knob — update frequency — not by hardware: 2 × 10^8/s is impossible, 10^6/s is twenty boxes. This estimation exists to force the conflation conversation before anyone draws a diagram.
</details>

**T3.5** — *Parcel tracking in festival sale week.* 100 M parcels in flight; each produces ~20 scan events over the week and gets its tracking page checked ~5×/day. A scan record is ~1 KB; the rendered tracking summary is ~2 KB.

<details><summary>Answer</summary>

```
users:    demand arrives per parcel, not per user — 100 M in flight is the base
actions:  writes: 100 M × 20 ÷ 7 days ≈ 300 M scans/day ÷ 10^5 = 3 k/s; machine-paced → ×3 ≈ 10 k peak
          reads:  100 M × 5 = 500 M/day ÷ 10^5 = 5 k QPS; one country, evening anxiety → ×5 = 25 k peak
bytes:    300 M × 1 KB = 300 GB/day logical × 5 = 1.5 TB/day; 30-day hot ≈ 45 TB
machines: cache = 20% × (500 M × 2 KB = 1 TB/day) = 200 GB → 2 nodes
          (cache raw 20-event lists instead and it's 10× that — cache the rendered object)
          API: 25 k cached reads ÷ 10 k ÷ 0.6 ≈ 4 → 5 boxes
          shards: 45 TB ÷ 2 TB ≈ 20 vs writes 10 k ÷ 10 k = 1 → size binds, ~20-node event store
money:    ~30 boxes ≈ $30 k/month; egress ~1 TB/day is noise
```

Two peak factors live in one system: scanners are machine-paced (×3 at most), customers are evening-paced (×5) — splitting them is the insight. And the cache decision — rendered summary versus raw events — moves the cache 10×: *what* you cache matters more than how much.
</details>

**T3.6** — *A dating app.* 20 M DAU, global. Each active user swipes ~100×/day, ~30% right-swipes. A swipe row is ~100 B; each swipe renders the next profile card (~20 KB photo + 1 KB bio). "Did they right-swipe me?" must be answered instantly.

<details><summary>Answer</summary>

```
users:    20 M DAU, global → ×3
actions:  swipes (writes): 20 M × 100 = 2 B/day ÷ 10^5 = 20 k/s → 60 k/s peak
          card loads (reads): the same 2 B/day — read:write ≈ 1:1, a feed that writes back
bytes:    swipe log: 2 B × 100 B = 200 GB/day × 5 = 1 TB/day; 30-day operational window ≈ 30 TB
          card egress: 60 k/s × 20 KB ≈ 1.2 GB/s ≈ 10 Gbps peak → photos live on the CDN
machines: match check in RAM: right-swipes 600 M/day × 30 d = 18 B edges
          as 100 B rows ≈ 2 TB; as packed id-pairs (2 × 8 B) ≈ 300 GB → 3 cache nodes
          shards: 30 TB ÷ 2 TB = 15 vs writes 60 k ÷ 10 k = 6 → size binds, ~15 nodes; API ~10
money:    ~30 boxes ≈ $30 k + CDN 40 TB/day × 30 × $30 ≈ $36 k → ~$70 k/month, egress ≈ half
```

Swipes make this a write-heavy firehose wearing a consumer-app costume — 1:1 at 60 k peak TPS. And the match working set compresses 7× by storing the 16 B *fact* instead of the 1 KB *row* — the cheapest architecture decision in this whole tier.
</details>

**T3.7** — *A multiplex chain on blockbuster Friday.* 800 screens × 5 shows/day; ~2 M tickets sell on Friday, 70% inside the 6–9 PM window, and seat-map browsing runs ~100× bookings. A seat map is ~1 KB; a booking row ~1 KB.

<details><summary>Answer</summary>

```
users:    demand = bookings on a clock: the 6–9 PM window ≈ 10^4 s
actions:  bookings: 2 M × 70% = 1.4 M ÷ 10^4 s ≈ 150 TPS sustained
          a hyped opening is a synchronized event: ×10 floor → ~1.5 k TPS for minutes
          seat-map reads: ×100 → 15 k QPS sustained, ~150 k QPS in the burst
bytes:    inventory: 800 × 5 × 1 KB = 4 MB ← the chain's entire stock fits in L2 cache
          bookings: 2 M × 1 KB = 2 GB/day × 5 = 10 GB/day — one SQL node holds years
machines: maps from cache at ~1 s TTL: origin sees 4 k shows × 1 QPS = 4 k QPS → one box; the edge eats the burst
          burst tier if origin-served: 150 k ÷ 10 k ÷ 0.6 = 25 boxes — the TTL is cheaper
          writes: 1.5 k TPS vs 1 k SQL ceiling — and all of it converges on a few hot shows → queue per show
money:    noise — tens of boxes for three hours; the bill is an engineer, not hardware
```

Four megabytes of inventory under 150 k QPS of synchronized attention: the purest cache-shaped system on this floor — a 1-second TTL deletes the read problem entirely. The write side is small but *contended*: the ceiling that matters is the row lock on one hot show, not node TPS — the sneaker drop of [drill 5.4](../part-2-core-estimations/05-traffic.md), in cinema clothes.
</details>

**T3.8** — *A city's bike-share telemetry.* 50 k bikes, ~30% on a trip during the ~8 active hours; riding bikes ping GPS every 10 s (~100 B). The riders' "bikes near me" map: 200 k DAU × 10 opens/day.

<details><summary>Answer</summary>

```
users:    50 k devices + 200 k humans — both small numbers; suspect a small system early
actions:  pings: 15 k active × 0.1/s = 1.5 k writes/s daytime
          daily: 1.5 k × 3 × 10^4 active-s ≈ 50 M pings/day
          map reads: 2 M/day ÷ 10^5 = 20 QPS — invisible
bytes:    50 M × 100 B = 5 GB/day × 5 = 25 GB/day → ~10 TB/year
          live state: 50 k × 100 B = 5 MB ← the whole fleet in one process's heap
machines: 1.5 k writes/s > 1 k SQL ceiling → one LSM node, or batch 10 pings/insert → 150/s and SQL is fine
          API: 1.5 k ÷ 1 k ÷ 0.6 ≈ 3 boxes; geo-search runs against the 5 MB in-memory index
money:    ~5 boxes ≈ $5 k/month — noise
```

Everything lands in single digits — boxes, gigabytes, thousands of QPS. Saying "nothing here stresses hardware; the only real choice is batching the write path" *fast and with confidence* is as strong a signal as taming a giant: most candidates inflate small systems because admitting smallness feels like failing the question.
</details>

## Tier 4 — Fermi curveballs

Target: **3 minutes, structure over precision.** These are for the moment the interviewer goes off-script — no DAU given, no system to design, just a quantity in the wild. The graded artifact is the **decomposition**: name the factors before touching any number, because a sane structure with rough inputs beats a precise number nobody can audit. Population-scale inputs here are calibration points, not canon — say them with a "~" in your voice.

**T4.1** — How many messages are sent in India during the New Year midnight minute?

<details><summary>Answer</summary>

Decompose: population → messaging users → fraction who fire inside *the* minute → messages each.

```
~1.4 B people → ~60% on messaging apps ≈ 800 M
inside the midnight minute: say ~10% fire one greeting
800 M × 10% × 1 ≈ 80 M messages ÷ 60 s ≈ 1.3 M/s ≈ 10^6/s
```

Call it ~100 M messages in the minute, ~10^6/s peak. Verify against the canon ceiling: the largest synchronized consumer events on Earth peak at ~10^5–10^6 writes/s — the biggest messaging moment on Earth *should* sit at that line, and it does. Anything within 3× (30 M–300 M) is a pass.
</details>

**T4.2** — Storage for one year of a metro city's CCTV — say 100 k cameras.

<details><summary>Answer</summary>

Decompose: cameras × bitrate × seconds, then let retention policy attack the result.

```
1 min of 1080p, single rendition ≈ 50 MB; CCTV runs ~5× leaner → ~10 MB/min
10 MB/min × 1,440 min ≈ 15 GB/day/camera → ~5 TB/year/camera
× 10^5 cameras = 5 × 10^5 TB = 500 PB/year
```

Half an exabyte — so nobody stores a year raw: a 30-day rolling window is ~50 PB, motion-triggered capture cuts another ~10×, and at this scale provisioning is erasure-coded ×1.5, not ×5. The decomposition's real output is that *retention policy, not disk, is the design*. Within 3× (150 PB–1.5 EB raw) is a pass.
</details>

**T4.3** — A packed cricket stadium all uploading stories at the winning six. Bandwidth?

<details><summary>Answer</summary>

Decompose: seats × bytes per story ÷ upload window.

```
~100 k phones; a 30 s story at 50 MB/min ≈ 25 MB
100 k × 25 MB = 2.5 TB, squeezed into ~5 min (300 s)
≈ 8 GB/s ≈ 60+ Gbps through one venue
```

Sixty-plus gigabits through one building's radio infrastructure — roughly seven 10 Gbps server NICs' worth, except the wall is cell spectrum, not servers. This is why operators park cell-on-wheels trucks at finals, and why your story "fails to upload" from the stands. Within 3× (20–200 Gbps) is a pass.
</details>

**T4.4** — How much RAM to "remember every Indian's last 10 UPI transactions"?

<details><summary>Answer</summary>

Decompose: users × transactions × bytes per transaction.

```
~500 M UPI users × 10 txns × ~100 B (a handful of 8 B fields + ids)
= 5 × 10^11 B = 500 GB logical
× 3 in-RAM replication = 1.5 TB ÷ 128 GB/box ≈ 12 boxes
```

A country's recent payment memory is one rack — that is the calibration to keep: 100-byte facts about half a billion people are RAM-scale, not warehouse-scale. Within 3× (170 GB–1.5 TB logical) is a pass.
</details>

**T4.5** — How much did YouTube's storage grow while you watched one 10-minute video?

<details><summary>Answer</summary>

Decompose: upload rate × your watch time × bytes per content-minute.

```
~500 hours uploaded per minute × 10 min = 5,000 h = 3 × 10^5 min of new video
× 100 MB/min (all renditions) = 3 × 10^7 MB = 30 TB
× 1.5 erasure-coded ≈ ~50 TB
```

A rack of disks per coffee break — about 5 TB of provisioned growth *per minute*, which is why "store everything forever" is an engineering discipline and not a default. Within 3× (~15–150 TB) is a pass.
</details>

**T4.6** — Could one server host every Wikipedia text edit ever made?

<details><summary>Answer</summary>

Decompose: total edits × bytes per edit (text only — that qualifier is the whole question).

```
~2 B edits across all languages × ~1 KB (delta + metadata) = 2 TB raw
text compresses ÷3 → ~700 GB; even provisioned ×5 ≈ 3.5 TB
vs one node's practical ceiling: a few TB → yes, one server
```

Yes — comfortably, and an NVMe drive at 3 GB/s reads the whole corpus in ~4 minutes. The instinct to keep: all of human encyclopedic edit history is laptop-class, because **text is never the storage problem — media is**. Pass if your structure separated text from media; fail if you reflexively said "petabytes."
</details>

**T4.7** — Daily egress of a national newspaper's site on election-results day?

<details><summary>Answer</summary>

Decompose: visitors × page views × page weight.

```
~50 M visitors × ~10 views (live-blog refreshing) × 2 MB/page
= 10^15 B = 1 PB that day  →  ÷ 10^5 s = 10 GB/s ≈ 80 Gbps sustained
CDN: 1,000 TB × $30 ≈ $30 k for the day
```

One petabyte for one news day. The so-what is product-shaped: a 10 KB JSON poll for the live counter instead of 2 MB page reloads is a 200× egress cut — on days like this, front-end design *is* bandwidth design. Within 3× (0.3–3 PB) is a pass.
</details>

**T4.8** — Sanity check, one line: a startup claims their 50 k-DAU app needs 200 servers. Plausible?

<details><summary>Answer</summary>

Decompose: claimed fleet vs derived need.

```
50 k DAU × ~100 actions/day = 5 M/day ÷ 10^5 = 50 QPS → peak ≈ 150
even all-heavy work: 150 ÷ 100 ÷ 0.6 ≈ 3 servers; typical work: 1
```

Not plausible — off by ~70× even on the most generous reading, so either every request is GPU inference with the math still not closing, or the number is theater. The skill: any capacity claim can be audited in 30 seconds by running the Ladder downhill — this drill is the entire chapter in one line.
</details>

## The calibration log

Drilling without a log is practice without a coach. After every timed drill, record one row — the whole habit costs a minute a day:

```markdown
| Date | Drill | Your answer | Reference | Ratio off | The anchor or step that caused the gap |
|---|---|---|---|---|---|
| 2026-06-12 | T3.3 | 20 k writes/s | 200 k/s | 10× low | dropped an exponent in 2 × 10^10 ÷ 10^5 |
| 2026-06-13 | T2.4 | 700 PB/yr | 3.5 PB/yr | 200× high | used 2 MB phone photo, not 200 KB feed photo |
```

The standard: **within 10× from day one** (you have the structure), **within 3× by week two** (you have the anchors), **within 2× consistently — and able to name the cause when you're not — is interview-ready.** The [30-day program](24-the-30-day-program.md) schedules exactly when each tier enters the rotation.

Log the *ratio*, never "right/wrong" — because estimation errors are multiplicative, and the ratio is a diagnosis where a checkmark is a verdict. A 1.5× miss is rounding noise: ignore it, that's the precision this discipline runs at. A 3× miss is a soft assumption — your peak factor, your actions-per-user — worth one sentence of reflection. A 10× miss is structural: a wrong anchor or a dropped exponent, and the last column tells you *which one*, turning tomorrow's drill into targeted repair instead of another lap. And after two weeks the log shows you something no single drill can: your bias. If storage misses always land low, you are forgetting the ×5; if traffic always lands high, you're double-counting peak. Calibration is not being right — it is knowing the size and the direction of your own error bars, which is precisely what an interviewer means by "good judgment with numbers."

---
[← Previous: The interview script](22-the-interview-script.md) · [Table of contents](../../README.md) · [Next: The 30-day program →](24-the-30-day-program.md)
