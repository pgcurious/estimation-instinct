# 17 — Cloud storage (Drive/Dropbox)

*The walkthrough where the bytes are boring and the bookkeeping is the system — an inversion most candidates never find.*

## The prompt

> "Design Google Drive. Size it first."

Candidates hear "Drive" and reach for the blobs: chunking, hashing, upload pipelines, replication diagrams. The numbers say the opposite. The blobs are the solved half of this system — you will end up buying that layer, not building it — while the part everyone hand-waves, the metadata, turns out to be a thousand-shard transactional database. The whole point of sizing this system first is to find that inversion before you spend twenty minutes designing the wrong half.

## Scope it in 60 seconds

Three questions change the numbers.

1. **Sync and share are the product — is collaborative editing in scope?** Docs-style co-editing is a different system (presence, operational transforms — trivial bytes, brutal semantics). Scope it out, and say you did.
2. **Consumer or enterprise?** Consumer: hundreds of millions of users on a free tier. Enterprise shrinks every total and almost no per-user number — that's drill 17.1.
3. **Do files live forever?** Effectively yes. Deletion is rare; accounts accrete for a decade. Retention — the strongest lever in chapter 11 — is off the table here, which makes the levers that remain matter more.

Assume the nod: sync + share, consumer scale, files effectively forever, co-editing out.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| Users | 200 M MAU | consumer-Drive scale; propose it, get the nod |
| DAU | 50 M | canon 25% of MAU |
| Stored per user | ~10 GB | of a "15 GB free" tier: most store far less, the tail stores terabytes; the mean lands near 10 |
| Files per user | ~10 k | a decade of photos, docs, and attachments |
| One file record | ~1 KB | the canon row default |
| Changes per active user | ~10/day | saves, camera-roll uploads, sync-downs |
| Average changed file | ~1 MB | canon media default for a mixed docs-and-photos diet |

## Rung 1 — Users

```
DAU             = 200 M × 25%  = 50 M
peak concurrent = 50 M × 10%   = 5 M devices syncing at once
```

Nothing exotic — file the 5 M away for the gateway fleet on rung 4. The interesting move is what comes next, and it is not rung 2. In every walkthrough so far, bytes were a consequence of actions: traffic happened, storage accumulated. Here storage is a *stock*, piled up over years of accounts, and today's actions barely move it. The headline lives on rung 3, so climb there first and come back for traffic. Chapter 11 bent the ladder's top rung; this system swaps the middle two.

## Rung 3 — Bytes (storage & bandwidth)

The canon's unit table stops at petabytes. This chapter needs one more prefix: an exabyte — EB, 10^18 — is a thousand petabytes. You'll see why immediately:

```
200 M users × 10 GB     = 2 × 10^8 × 10^10 B = 2 × 10^18 B
                        = 2 EB logical    (2,000 PB)
× 1.5 erasure coding    = 3 EB provisioned
```

> ⚠️ **Trap** — reaching for the database ×5. The ×5 bundles ×3 replication, and exabyte blob stores don't replicate — they erasure-code: the canon's ×1.5. Apply ×5 to 2 EB and you provision 10 EB instead of 3, a 7 EB phantom that prices at 7 million TB × $20 ≈ $140 M/month of imaginary spend. Multiplier hygiene is real money at this scale.

Three exabytes provisioned. Storage is "cheap" at $20 per TB-month — but 3 EB is 3 million TB, $60 M a month just to *hold*. No consumer product survives that at sticker price, so the next two paragraphs are not optimizations; they are the levers the business stands on.

**Lever one: cross-user dedup.** The same movies, installers, lecture PDFs, and forwarded attachments live in millions of accounts. Content-address the chunks — name each block by its hash — and identical bytes are stored once, whoever uploads them. On a consumer corpus this cuts ~30–50%; take 40%:

```
saved:  0.4 × 2 EB                 = 800 PB
        800,000 TB × $20/TB-month  ≈ $16 M/month
        × 12                       ≈ $190 M/year
```

Dedup is a nine-figure-a-year feature. Say that sentence in the room — it reframes a hashing detail as a P&L line.

**Lever two: cold tiering.** This is the canon's 80/20 law wearing storage clothes: if 20% of objects take 80% of reads, the other 80% of your bytes are barely read at all — measure a real drive estate and ~80% of bytes haven't been touched in 90 days. Archival tiers price ~5–10× below standard; call cold $2–4 per TB-month:

```
after dedup:  2 EB − 800 PB = 1.2 EB logical × 1.5 ≈ 1.8 EB provisioned
hot 20%:      360 PB   × $20/TB-month   ≈ $7 M/month
cold 80%:     1,440 PB × $2–4/TB-month  ≈ $3–6 M/month
blended                                 ≈ $10–13 M/month   (vs $36 M all-hot)
```

Tiering at least halves the bill again. The two levers together take it from $60 M naive to roughly $10–15 M a month — hold that for rung 5. (Bandwidth is a flow, not a stock; it comes back with traffic on rung 2.)

### The signature sub-question — how big is the metadata?

> ⚡ **Instinct check** — 10 k files at ~1 KB of record each: how much metadata per user? Across 200 M users? Answer before reading on.

```
per user:  10,000 files × 1 KB       = 10 MB of rows
total:     200 M × 10 MB             = 2 × 10^15 B = 2 PB
rows:      200 M × 10 k              = 2 × 10^12 — two trillion rows
shards:    2 PB ÷ 2 TB per SQL node  ≈ 1,000 shards
```

Two petabytes — 0.1% of the blob estate — and it is the hard 0.1%. Blobs are immutable, write-once, read-rarely: exactly what off-the-shelf object stores are built for. The metadata is the opposite on every axis: mutable (every rename, move, share, delete), transactional (a move must not half-happen), and queried by every device on every sync. Against the canon's few-TB practical ceiling per SQL node, 2 PB is a ~1,000-shard system — a thousand-shard database that must answer "list this folder" inside the human 100 ms budget.

Walk into a bank's locker room. The vault is standardized steel, bought from the same three manufacturers as every other bank's. What makes the branch a *bank* is the ledger — who owns which locker, who may open it, who opened it when, under whose counter-signature. Drive's blobs are the vault; Drive's metadata is the ledger. Vaults are purchased. Ledgers are the institution.

The consequences, in one breath: shard the ledger by user or namespace, so that a folder listing — the query every client runs on every sync — stays on one shard; keep paths as parent pointers, not strings, because rename and move must update a subtree transactionally and string paths turn one rename into a million-row rewrite; and respect listing as the query that hurts, because it sits on every hot path.

> 🎯 **In the room** — the level-separating sentence: "The blob store I'd buy; the namespace database I'd build." Most candidates spend the interview designing chunk replication — the part that ships as a product — and never notice the thousand-shard transactional system hiding behind 0.1% of the bytes.

## Rung 2 — Actions (traffic)

Now the flow, deliberately second.

```
changes:   50 M DAU × 10/day   = 500 M changes/day
           500 M ÷ 10^5 s      = 5,000 changes/s average
           × 3 peak            ≈ 15,000 changes/s
metadata:  each change touches 3–5 rows (file row, version row,
           change-journal entry, quota counter, share/ACL touch)
           15 k × 3–5          ≈ 50–75 k metadata writes/s peak
```

Hold 75 k writes/s against the canon's 1 k TPS SQL ceiling: write rate alone demands ~75 nodes, while size demanded ~1,000. Both canon shard triggers fire independently — rare, and worth saying out loud, because it means the metadata layer is sharded in any engine at any size. Note the shape, too: sync is chat-like, not feed-like — each change fans out to the user's other devices and share members, so reads ride the same change journal at a few times the write rate, heavy but cursor-friendly.

Bandwidth, now that there is a flow to measure:

```
ingress:  500 M × 1 MB             = 500 TB/day  ≈ 5 GB/s average, 15 GB/s peak
egress:   downloads + shares ~20%  ≈ 100 TB/day  → CDN for hot shares
```

Fifteen GB/s of peak ingress is a dozen saturated 10 Gbps ports before replication — real, but a fleet-sizing fact, not a redesign. The redesign lever sits one layer up, in the sync protocol; it's named in the so-what.

## Rung 4 — Machines (cache, servers, shards)

**Metadata fleet.** Say which trigger binds.

```
SQL:  by size    2 PB ÷ 2 TB                 ≈ 1,000 shards   ← binds
      by writes  75 k/s ÷ 1 k TPS            ≈ 75
LSM:  by writes  75 k/s ÷ 10 k TPS           ≈ 8
      by size    2 PB × 1.5 index ÷ 2 TB     ≈ 1,500          ← binds
```

Either engine, size binds. An LSM store buys back the write pressure — eight nodes' worth — but not the byte count, so you run on the order of a thousand metadata nodes regardless. Naming *which* pressure set the shard count is exactly the interpretation interviewers listen for.

**Cache.** The hot 20% of 2 PB is 400 TB — no cache tier holds that. So don't cache the namespace globally; scope it per active session, and better, stop asking the question: clients hold a cursor into the change journal and ask "what changed since X" instead of re-listing the world.

**Sync gateways.** 5 M concurrent connections (rung 1) ÷ canon 100 k per box = 50 boxes.

**Chunk/dedup workers.** Hashing and dedup-index lookups are heavy work; budget ~0.5 s of worker time per change (chunk, hash, index probes, store write):

```
in flight:  15 k changes/s × 0.5 s  = 7,500 concurrent jobs
boxes:      7,500 ÷ 32 cores        ≈ 250 at peak
```

## Rung 5 — Money

```
blobs (after both levers)              ≈ $10–15 M/month   (was $60 M naive)
metadata: 1,000 shards × 3 replicas    ≈ 3,000 boxes ≈ $3 M/month raw, ~2× managed
egress:   100 TB/day × 30 × $30 (CDN)  ≈ $90 k/month — noise
gateways + workers + API, ~400 boxes   ≈ $0.4 M/month — noise
```

Three readings. The ledger costs the same order as the vault — the inversion shows up on the invoice, not just the architecture. This is the rare consumer system where storage out-bills egress ~100× — the exact opposite of a streaming service. And the staffing line: a dedup team of ten costs 10 × $15 k = $150 k a month and returns $16 M a month — the easiest ROI sentence in this book. It is also why free tiers are 15 GB and not 1 TB: at the blended ~$5–7 per logical TB-month, 15 GB costs ~10¢ per user — a 1 TB free tier would cost ~$6 per user, and no ad model pays for that.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 2 EB of immutable, read-rarely blobs | **buy** the blob layer (S3-class object store); don't design it in the room |
| 2 PB of mutable metadata vs 2 TB/node | **build** the namespace DB — ~1,000 shards, keyed by user/namespace |
| both shard triggers fire (75 k w/s *and* 2 PB) | design rename, move, and listing before drawing any blob diagram |
| 800 PB deduped = $16 M/month | content-addressed chunk store; dedup is a staffed P&L feature, not an optimization |
| ~80% of bytes cold in 90 days | lifecycle tiering; the blended rate, not the sticker rate, is the business model |
| 500 TB/day ingress, mostly edits | delta sync — ship changed blocks, not whole files; ~10× off edit ingress |
| 100 TB/day egress, viral public links | CDN-front the share path; origin only validates tokens |

The sync-protocol row deserves its name said aloud: rsync-style block deltas. Without them, a one-cell edit re-uploads the whole 100 MB spreadsheet; with them, edits ship only changed blocks — ~10× off edit ingress — and your 500 TB/day is mostly true new bytes.

## The pushback round

**Interviewer:** "Your 2 EB leaned on 10 GB per user. Most users store 200 MB; a few store 2 TB. Doesn't the skew break the estimate?"

**You:** "It breaks one assumption — not the total. The total is an integral, and a power law's integral is owned by its tail: if just 1% of the 200 M average 1 TB, that's 2 M × 1 TB = 2 EB from the tail alone. The 10 GB mean was never a typical user — it's the tail smeared across everyone — so exabyte scale stands. What the skew does break is a quieter assumption on rung 4: that one user's namespace fits one shard. A 2 TB hoarder with a million files, or a shared team folder with a hundred thousand members, is a namespace that must be able to split across shards, and a hot spot the placement layer must be able to move. I'd keep the capacity math and change the sharding key — namespace-level and range-splittable, not a flat hash of user id. Averages size the warehouse; tails design the shelves."

**Interviewer:** "So the average was useless?"

**You:** "The average produced the 2 EB and the $10–15 M bill — build-versus-buy came from it. The tail produced the shard-key decision. Different rungs consume different statistics; the mistake is feeding the same number to both."

## Say it in 60 seconds

> "Numbers first. 200 million MAU at ten gigabytes each is two exabytes logical — three provisioned with erasure coding, sixty million dollars a month at sticker price. Two levers make it a business: cross-user dedup cuts about forty percent — 800 petabytes, sixteen million a month, a nine-figure-a-year feature — and 80% of bytes go cold, so tiering lands the blend near ten to fifteen million. The twist is the metadata: ten thousand files per user at a kilobyte a row is two petabytes of mutable, transactional rows — against a two-terabyte node ceiling, a thousand-shard namespace database. That's the build; the blobs I'd buy. Traffic: 50 million DAU times ten changes is five thousand a second, fifteen thousand peak, three-to-five rows each — fifty to seventy-five thousand metadata writes a second, so both shard triggers fire. Ingress 500 terabytes a day, egress about a hundred — CDN on the share path. Fifty gateway boxes, two hundred fifty chunk workers. The number that worries me is the metadata write rate, so I'd design the namespace database first and treat the blob store as a product I buy."

## Numbers to keep

- 200 M × 10 GB = **2 EB logical**; ×1.5 erasure = 3 EB — blob stores take ×1.5, never the database ×5
- Dedup ~40% of 2 EB = 800 PB = **$16 M/month** at $20/TB — a nine-figure-a-year feature
- ~80% of bytes untouched in 90 days → tiering blends the bill to **$10–15 M/month** (from $60 M naive)
- Metadata: 200 M × 10 k × 1 KB = **2 PB ÷ 2 TB ≈ 1,000 shards** — the build is the ledger, not the vault
- 50 M × 10 = 5 k changes/s, 15 k peak; ×3–5 rows = **50–75 k metadata writes/s** — both shard triggers fire
- Ingress 500 TB/day, egress ~100 TB/day — storage out-bills egress ~100× here
- 5 M concurrent ÷ 100 k = 50 gateways; 15 k/s × 0.5 s ÷ 32 ≈ 250 chunk workers

## Drills

**Drill 17.1** — Same product, sold inward: a "company Drive" for one 10,000-employee enterprise. Which numbers shrink ~1,000×, which shrink even more, and which don't shrink at all?

<details><summary>Answer</summary>

```
storage:   10 k × 10 GB              = 100 TB logical — a bucket, not an estate
metadata:  10 k × 10 k files × 1 KB  = 100 GB — one SQL node, half empty
traffic:   10 k × ~30 changes/day    = 300 k/day ≈ 3/s, ×5 office-hours peak ≈ 15/s
```

Totals collapse by the user ratio, ~20,000×. Traffic falls a softer ~1,000–2,000×, because per-user behavior *rises*: office workers churn more files per day, and DAU/MAU is ~100% on weekdays. What doesn't shrink at all: the per-user numbers — file counts, stored GB, the shape of the listing query, the rename problem — and dedup improves (the same deck and installer in every department). The so-what: enterprise Drive is a one-Postgres system wearing exabyte clothes; importing the thousand-shard design is chapter 11's over-provisioning trap at enterprise prices.
</details>

**Drill 17.2** — Legal ships client-side encryption, and cross-user dedup falls from 40% to 10% — identical files now encrypt to different bytes. Recompute the bill and name the product trade-off.

<details><summary>Answer</summary>

```
after dedup:  0.9 × 2 EB = 1.8 EB logical × 1.5  ≈ 2.7 EB provisioned
hot 20%:      540 PB   × $20/TB-month            ≈ $11 M/month
cold 80%:     2,160 PB × $2–4/TB-month           ≈ $4–9 M/month
blended                                          ≈ $15–20 M/month   (was $10–13 M)
```

Call it +$5 M a month — ~$60 M a year — for the same bytes. The trade-off has a name: end-to-end privacy versus storage economics. Convergent encryption (key derived from the content hash) restores dedup but leaks membership — anyone holding a file can confirm you store it too. So the honest options are to charge for E2E as a feature priced above its COGS, or accept and document the leak. The estimate's job is to show that an encryption checkbox is a $60 M/year P&L decision — which is why the cryptographers and the CFO end up in the same meeting.
</details>

**Drill 17.3** — A public share link goes viral: one 100 MB clip, 50 M downloads in a day. Which path absorbs it, and what does it cost with vs without a CDN?

<details><summary>Answer</summary>

```
bytes:     50 M × 100 MB     = 5 PB in a day → 5 PB ÷ 10^5 s = 50 GB/s sustained
requests:  50 M ÷ 10^5 s     = 500/s, ×3 ≈ 1.5 k/s — trivial
raw:       5,000 TB × $100/TB ≈ $500 k for the day
CDN:       5,000 TB × $30/TB  ≈ $150 k
```

The public-share path absorbs it — unauthenticated link, immutable object — which is exactly the CDN's shape: one hot key becomes roughly one origin fetch per edge, and the sync fleet and metadata shards never feel it. Without a CDN it's 50 GB/s — forty saturated 10 Gbps boxes of pure egress — a hot key hammering one object-store partition, and a 3× bigger bill. The only origin-side work is link validation, so make share tokens cacheable with a short TTL and accept that revocation lags by minutes. The so-what: public shares are CDN-fronted *by design*; if the viral plan is "scale the origin," there is no plan.
</details>
