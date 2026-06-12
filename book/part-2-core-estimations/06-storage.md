# 6 — Storage

*Traffic forgives — the spike passes. Storage compounds: every byte you accept tonight is still on the payroll five years from now.*

## The question this chapter answers

"How much storage?" unpacks into four questions: how fast writes arrive, how big each one is, how long you keep them, and which multiplier turns logical bytes into hardware somebody provisions. [Traffic](05-traffic.md) already answered the first — rung 3 of [the Ladder](../part-1-foundations/04-the-ladder.md) asks what each action *keeps* or *moves*, and it inherits its write rate straight from rung 2. This chapter is the keep half; [Bandwidth](07-bandwidth.md) is the move half. It answers the other three questions, plus the one most candidates never think to ask: *which of the two kinds of bytes are we counting?* Small hot records and big cold blobs are different species — different multipliers, ceilings, prices, designs — and folding them into one number is the structural error behind most failed storage estimates.

## From first principles

### The formula, derived

Storage is accumulation — a rate times a size times a time:

```
logical bytes = write rate × object size × retention
```

Keep the units honest: a per-day rate wants retention in days; a per-second rate wants the canon year of 3 × 10^7 s.

Logical bytes are what the application believes it stored. The disks hold more, for two compounding reasons.

**Replication — ×3.** Durability means copies, and the industry default is three: enough to lose one node while a second is down for patching and still hold a two-of-three quorum. Postgres replica pairs, Cassandra at RF = 3, HDFS — three, everywhere you look.

**Indexes and overhead — ×1.5.** Every secondary index is a sorted partial copy of the table, and two or three of them together rival the table itself. Add write-ahead logs, tombstones, fragmentation, and the free-space headroom you hold because a disk past 90% is an incident with a date on it — half again, in total.

```
provisioned = logical × 3 replication × 1.5 overhead = ×4.5  → say ×5
```

Hence the working formula — pocket formula 3 on the [cheat sheet](../appendices/a-cheat-sheet.md):

```
storage = write rate × object size × retention × 5
```

One exception, with a sharp boundary. **PB-scale blob stores don't triple.** Three full copies of 50 PB is 150 PB of disk, and at that scale the bill funds a cleverer trick: erasure coding — cut each object into data and parity shards spread across machines, let any sufficient subset reconstruct it, and three-copy durability costs ~×1.5 in bytes. So the rule: sizing a **database** — rows, indexes, low-latency point reads — take ×5. Sizing a **PB-scale object store** — write-once blobs fetched whole — take ×1.5. *Buying* storage as a managed service — take ×1, because the $20-per-TB-month S3-class sticker prices logical bytes with the redundancy already inside. The multiplier follows whoever owns the redundancy.

> ⚡ **Instinct check** — An IoT fleet writes 2,000 readings/s at 1 KB each, kept one year, on Cassandra nodes you operate. Provisioned bytes? … 2 MB/s × 3 × 10^7 s = 60 TB logical, × 5 = **300 TB**. Slower than ten seconds? Rebuild the year-is-3 × 10^7-seconds reflex before reading on.

### Sizing the object: the schema sketch

Candidates stall on "how big is a record?" as if it needed a DBA's sign-off. It needs four moves:

1. **List the fields** the feature implies — API shape, not full DDL.
2. **Price each from canon**: int64, timestamp, money amount — 8 B; UUID — 16 B; a name or URL — ~100 B; an address or short free-text — ~300 B.
3. **Sum, including child rows.** The unit you want is bytes per *user action*, so an order carries its items and its status events, not just its header.
4. **Round up to a friendly number** — 0.5 KB, 1 KB, 2 KB. Up, not to nearest: live schemas accrete audit columns, soft-delete flags, and the JSON blob somebody bolts on in year two. The ceiling is the honest estimate.

No time to sketch? Canon defaults: **~1 KB per record, ~1 MB per media object** — say "call it a kilobyte" and keep climbing; refine only if the number turns out to carry a decision. Media sizes you never invent, because canon §3 already did: 20 KB thumbnail, 200 KB feed photo, 2 MB original phone photo — ×2 once variants are stored — 5 MB per song, 100 MB per minute of video across renditions.

### Two species of bytes

Run that sketch on any real system and the objects split into two populations with almost nothing in common:

| | Records (metadata) | Blobs (media) |
|---|---|---|
| Size | ~100 B – a few KB | 100 KB – GBs |
| Temperature | hot, mutable, queried by predicate | cold, immutable, fetched whole by key |
| Home | database on SSD | object store, CDN in front |
| Multiplier | ×5 | ×1.5 at PB scale, or in the price |
| Price | ~$100/TB-month block SSD, provisioned | ~$20/TB-month S3-class, logical |
| Per-node ceiling | a few TB | none you'll hit |

A five-times price gap and a thousand-times ceiling gap. Hence the discipline: **every storage estimate is two lines, never one.** The database line carries the records plus a ~100 B URL pointing at each blob — the claim ticket, not the coat. The object-store line carries the blobs. Blend the species and both lines go wrong in opposite directions: the database looks impossibly large, and the media bill comes out 5× too high because blobs took the record multiplier.

### Storage is a stock; traffic is a flow

A QPS number expires every second; storage only ever sums. A family photo trunk behaves the same way — each addition is a tiny event, the trunk only grows, and nobody budgets for it until the lid won't close. Systems are no different: the storage curve has no owner until a shard fills.

Integrals need a horizon, so quote storage as **rate × horizon**, and when growth goes unstated, the canon assumption is **×2 per year, said out loud**. Doubling collapses the multi-year sum into a shortcut worth keeping:

```
yearly writes:   V, 2V, 4V, 8V, 16V         (years 1 → 5)
lifetime total:  31V ≈ 2 × 16V  ≈ 2 × the final year
```

**Lifetime ≈ twice the final year** — at any horizon, because a doubling series is one step short of its next term. The corollary has design teeth: under ×2 growth, half of everything you have ever stored was written in the last year. Age-tiering isn't a nice-to-have; it's structurally half your bytes.

> 🎯 **In the room** — Storage answers travel in threes: the number, its horizon, its kind. "Fifty gigabytes a day, provisioned." "Eighteen terabytes provisioned by end of year one." Drop the labels and the interviewer hears whichever number they were expecting — now one of you is off by 5× and neither knows it. Say the ×5's anatomy once, too: "times five — three-way replication, half again for indexes and headroom." A multiplier with visible parts reads as engineering; a bare one reads as superstition.

### Retention is the lever you choose

Rate and size are handed to you by the product. Retention is the input you *choose* — which makes it the lever. A grain silo in Punjab isn't sized by the harvest; the harvest is given. It's sized by how many seasons of carryover the keeper decides to hold. "Keep everything forever" is also a decision — just an unpriced one.

Three moves shrink kept bytes before any disk is bought:

- **TTLs.** Deletion as policy, designed on day one: sensor pings out at 30 days, sessions at 7. The delete you don't design becomes the migration you run in year three.
- **Compression.** Canon: text ÷3; logs ÷10 — logs are spectacularly repetitive: timestamps, levels, paths. Media ×1 — compressed at capture; gzipping a JPEG is a CPU tax with no refund.
- **Tiering.** Hot on SSD in the database or search cluster for days; warm in S3-class for months; cold in an archival class for years — ~5–10× cheaper than S3-class, paid for in restore latency measured in hours.

The three multiply. Worked example 2 stacks them, and the gap is ~300×.

### When storage forces a decision

Numbers exist to trigger decisions, and storage has two classic triggers.

**The few-TB wall.** A single SQL node carries a few TB before operations sour — backups, reindexes, and failovers stretch from minutes toward days. Past it you shard: pocket formula 7 divides total bytes by 2 TB, the conservative end of "a few," so index overhead rides free. But ask the cheaper question first: do the old bytes need to be *in* the database at all? Archiving cold rows to an object store is sharding's frugal cousin, and reaching for it first is a senior tell.

**Total vs working set.** Total bytes size the disks; the hot ~20% of objects that absorbs 80% of reads sizes the RAM. Different estimates, different owners — [Memory & cache](08-memory-and-cache.md) takes the working set; this chapter only sizes the trunk.

And one number that is *not* a storage decision: 10 TB/day arriving is also 100 MB/s crossing the wire — the same bytes answering two different questions. Disks care about the integral, NICs care about the rate, and [Bandwidth](07-bandwidth.md) prices the rate. Keep the bridge handy: **1 TB/day ≈ 10 MB/s**.

## The anchors

| Anchor | Value | Use it when |
|---|---|---|
| Database multiplier | ×5 = ×3 replication × ×1.5 indexes/overhead | any store you replicate yourself |
| Blob-store multiplier | ×1.5, erasure-coded | PB-scale object stores |
| Managed-storage pricing | redundancy included → ×1 | costing S3-class or managed DBs |
| Schema-sketch kit | int64/timestamp 8 B · UUID 16 B · name/URL ~100 B · short text ~300 B | sizing a record in 30 s |
| Object defaults | ~1 KB record · ~1 MB media | no schema sketched yet |
| Compression | text ÷3 · logs ÷10 · media ×1 | before sizing any store |
| Growth, unstated | ×2/year; lifetime ≈ 2 × final year | any multi-year horizon |
| SQL node ceiling | a few TB | the archive-or-shard trigger |
| Storage prices | $100/TB-mo SSD (provisioned) · $20/TB-mo S3-class (logical) · archival ~5–10× under S3-class | rung 5 |
| Rate ↔ volume bridge | 1 TB/day ≈ 10 MB/s | storage vs bandwidth questions |

All of it [cheat-sheet](../appendices/a-cheat-sheet.md) canon, or one derivation step from it.

## 🧮 Worked example 1 — e-commerce order history

Interviewer: *"Marketplace, 5M orders a day. Size the order-history storage."*

Spoken: "Let me sketch what an order is: a header, call it three items, and a trail of status events."

```
header:  order UUID 16 B + user id 8 B + 2 timestamps 16 B
         + totals (amount/tax/discount/currency) 32 B
         + shipping address ~300 B + payment ref UUID 16 B        ≈ 400 B
items:   3 × (ids 24 B + qty/price/discount 24 B + name ~100 B)   ≈ 450 B
events:  5 × (ids 32 B + timestamp 8 B + status 8 B + note ~50 B) ≈ 500 B
order:   ≈ 1.4 KB → round up: call an order 2 KB
```

"At five million a day:"

```
daily:    5 M × 2 KB = 10 GB/day logical → × 5 = 50 GB/day provisioned
year 1:   10 GB/day × 365 ≈ 3.5 TB logical   (≈ 18 TB provisioned)
5 years:  ×2/year → 3.5 + 7 + 14 + 28 + 56 ≈ 110 TB logical
          — the shortcut: ≈ 2 × year five
```

Interpret, still aloud: "Year one alone grazes the few-TB node ceiling, so kept whole, this table shards in year two. But order history is append-only, and 90 days covers support and returns. Keep a 90-day window hot — 90 × 10 GB ≈ 1 TB — and one node is comfortable; with doubling, the window itself reaches the ceiling around year three, and splitting a 4 TB window then is far smaller surgery than splitting 110 TB now. Everything older flows to the object store: the whole five-year archive at $20/TB-month runs ~$2k a month — noise. **Orders fit SQL for years, if we archive.**"

Then the turn that earns the points: "The orders aren't this system's storage story anyway. The catalog is — say 100M listings, five seller photos each, stored with variants at ~4 MB:"

```
images: 100 M × 5 × 4 MB = 2 PB logical
        → erasure-coded blob store: × 1.5 = 3 PB provisioned
```

"Two petabytes against year-one's 3.5 TB of rows — the images outweigh the orders five hundred to one. The order table is a correctness problem; the image store is the storage problem. Two species, two lines."

## 🧮 Worked example 2 — application logs

Interviewer: *"A 1,000-server fleet. What does centralized logging cost us?"*

Spoken: "A busy service logs about 100 lines a second, and a log line is the canonical 1 KB:"

```
rate:     1,000 servers × 100 lines/s × 1 KB = 100 MB/s
daily:    100 MB/s × 10^5 s = 10 TB/day raw
compress: logs ÷ 10 → 1 TB/day stored
```

"Read that rate twice. As bandwidth, 100 MB/s is one Kafka broker's worth of ingest — three for headroom; the pipeline is the easy part. As storage, raw would be ~3.5 PB a year, so the ÷10 isn't hygiene — it's the first big lever of the design."

"Now retention in tiers: 7 days hot and searchable, 90 days warm, one year cold:"

```
hot:    7 d × 1 TB/day = 7 TB logical in a search cluster → × 5 = 35 TB SSD
        35 TB × $100/TB-mo                                ≈ $3.5 k/mo
warm:   90 d × 1 TB/day = 90 TB S3-class (redundancy in the price)
        90 TB × $20/TB-mo                                 ≈ $1.8 k/mo
cold:   1 y ≈ 360 TB archival, ~5–10× under S3-class
        360 TB × ~$2–4/TB-mo                              ≈ $1 k/mo
total:                                                    ≈ $6 k/month
```

"The counterfactual prices the policy: keep that same compressed year all-hot and it's 360 TB × 5 × $100 ≈ **$180k a month** — 30× the bill for the same bytes and the same compliance story. Notice what bought what. The compression pipeline — real engineering, a quarter of someone's roadmap — bought ÷10. Three retention numbers in a config file bought ÷30. **Retention policy is the cost lever: you get cheaper by deleting and demoting, not by engineering harder.**"

## ⚠️ Traps

- **Forgetting the ×5.** The most common storage mistake in interviews, full stop. The logical number sails through rung 3, then every shard count and dollar downstream runs 5× low — and the interviewer who catches it starts re-auditing everything else you've said. The antidote costs one breath: "times five for replication and overhead," said the way you say "peak, times three."
- **Counting media into the database.** Fold 4 MB photos into "the DB" and you'll shard something that should have been a bucket and a URL column. The database stores the claim ticket; the object store stores the coat.
- **Quoting the cumulative when asked for the rate** — or year five when asked about year one. "110 TB" and "50 GB a day" describe the same system. Label every figure with horizon and kind — logical or provisioned — or the interviewer assigns it the meaning you didn't intend.
- **Double-counting replication on managed services.** S3-class and managed databases price per logical byte; durability is already in the sticker. Multiplying their bill by 5 invents a 5× overrun and quietly torpedoes your build-vs-buy judgment. The ×5 is for hardware *you* provision.
- **Answering a bandwidth question with a storage number** (or the reverse). 10 TB/day on disks and 100 MB/s on the wire are the same bytes under different questions — integral versus rate. Size disks by the day, NICs by the second, and cross with 1 TB/day ≈ 10 MB/s; [Bandwidth](07-bandwidth.md) owns the per-second half.

## Numbers to keep

- Storage = write rate × object size × retention × 5 — and say the parts: ×3 replication, ×1.5 indexes and headroom
- ×1.5, not ×5, for PB-scale erasure-coded blob stores; ×1 when a managed price already includes redundancy
- Schema sketch: 8 B ints and timestamps, 16 B UUIDs, ~100 B names, ~300 B text — sum per action, round **up** to friendly; defaults ~1 KB record, ~1 MB media
- Two species, two lines: records on ~$100/TB-month provisioned SSD; blobs on ~$20/TB-month logical S3-class
- Storage is a stock: under ×2/year, lifetime ≈ 2 × the final year — half of all bytes are under a year old
- Retention is the chosen input: text ÷3, logs ÷10, media ×1; hot / warm / cold, archival ~5–10× under S3-class
- A few TB ends a SQL node — archive first, shard second; and 1 TB/day ≈ 10 MB/s when the question turns to wires

## Drills

**Drill 6.1** — Schema-sketch the receipt for one completed ride in a ride-hailing app: ids for trip, rider, driver; three timestamps; pickup and drop locations with addresses; a four-field fare breakdown; a payment reference. Then: at 10M rides/day with 5-year retention and no growth, does the receipt table ever threaten a single SQL node?

<details><summary>Answer</summary>

```
ids:     trip UUID 16 B + rider 8 B + driver 8 B            ≈ 32 B
times:   3 × 8 B                                            = 24 B
places:  2 lat-lng pairs 4 × 8 B + 2 addresses 2 × ~300 B   ≈ 630 B
money:   4 × 8 B + payment UUID 16 B                        ≈ 48 B
ride:    ≈ 730 B → round up: call it 1 KB

daily:   10 M × 1 KB = 10 GB/day logical
5 years: 10 GB/day × 365 × 5 ≈ 18 TB logical
```

Yes — it reaches the few-TB ceiling during year one and sits well past it by year five, so archive or shard even for humble receipts. And the receipt isn't this system's big species anyway: a 30-minute GPS trail at one ping per 5 s is ~360 points × 16 B ≈ 6 KB — six receipts' worth per ride, before counting anything heavier. Small objects at big rates still integrate into storage problems; they just take longer to get there.
</details>

**Drill 6.2** — 200 servers log 50 lines/s each at 1 KB per line; compliance requires 90 days searchable. Bill it two ways: (a) all 90 days hot in a search cluster; (b) 7 days hot, 83 days in S3-class. Log compression applies to both.

<details><summary>Answer</summary>

```
rate:   200 × 50 = 10 k lines/s × 1 KB = 10 MB/s
        → 1 TB/day raw → ÷10 = 100 GB/day stored

(a) 90 d hot:  9 TB logical × 5 = 45 TB SSD × $100/TB-mo ≈ $4.5 k/mo
(b) 7 d hot:   0.7 TB × 5 = 3.5 TB × $100/TB-mo ≈ $350/mo
    83 d S3:   8.3 TB × $20/TB-mo                ≈ $170/mo
    total:                                       ≈ $500/mo
```

Same bytes, same compliance window, ~9× apart — the hot/warm boundary did all of it. "Searchable" rarely means "searchable in 200 ms" past the first week, and asking what the requirement actually means is itself an estimation skill.
</details>

**Drill 6.3** — In year one you write 20 TB provisioned, and volume doubles yearly. How much disk by the end of year four — and what fraction of it arrived during year four?

<details><summary>Answer</summary>

```
years:   20 + 40 + 80 + 160 = 300 TB     (the shortcut: ≈ 2 × 160 = 320 ✓)
year 4:  160 ÷ 300 ≈ half
```

~300 TB, half of it written in the final year — the doubling corollary, not a coincidence. Under ×2 growth, half of everything you store is always under a year old, which is why age-tiering pays structurally, not situationally.
</details>

**Drill 6.4** — Pick the multiplier — ×5, ×1.5, or ×1 — and defend each in one sentence: (a) user profiles on self-managed Postgres with two replicas; (b) 20 PB of video renditions in a blob store your team operates; (c) the same 20 PB bought at $20/TB-month S3-class.

<details><summary>Answer</summary>

```
(a) ×5    — you own the replication (×3) and the indexes/headroom (×1.5)
(b) ×1.5  — at PB scale you erasure-code; tripling 20 PB is 60 PB of regret
(c) ×1    — the sticker prices logical bytes; redundancy is the provider's problem
```

The multiplier follows whoever owns the redundancy. Apply ×5 to (c) and you invent a 5× cost overrun; apply ×1 to (a) and your shard plan is fiction.
</details>

**Drill 6.5** — Your envelope for a telemetry platform reads, in full: "storage: 2 PB." The interviewer frowns. Which two labels are missing, and what would the corrected line say?

<details><summary>Answer</summary>

Missing: the **horizon** (a rate, or a total as-of-when?) and the **kind** (logical or provisioned). One honest version:

```
1 TB/day logical → 5 TB/day provisioned → ≈ 1.8 PB provisioned by end of year 1
```

Unlabeled, the same "2 PB" could be a provisioned first year or a logical multi-year archive — readings 5× apart that point at different designs. A storage answer is a rate and a horizon wearing labels; a bare number invites the interviewer to choose the meaning you didn't intend.
</details>

---
[← Previous: Traffic](05-traffic.md) · [Table of contents](../../README.md) · [Next: Bandwidth →](07-bandwidth.md)
