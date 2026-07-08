# 26 — Web crawler & search index

*The walkthrough where the request traffic is a trickle and the whole design collapses to one question — how big is the index, and can you afford to keep it hot.*

## The prompt

> "Design a web crawler and the search index behind it — a Google-lite. Size it before you draw anything."

Candidates hear "crawler" and reach for the fetch loop: robots.txt, frontier queues, DNS, retry logic. All real, all secondary. The numbers say the crawler is a handful of boxes sipping bandwidth, and the entire system — the reason this is a hard interview and not a weekend project — is the artifact the crawl produces: an inverted index for ten billion pages that is far too large to sit on one machine and far too latency-sensitive to sit on plain disk. Sizing first is what stops you from spending twenty minutes on the fetch loop and zero on the thing that actually costs a million dollars a month.

## Scope it in 60 seconds

Three questions change the numbers.

1. **How many pages must the index cover?** This is the headline and everything hangs off it — propose **10 billion (10^10)** and get the nod. A "Google-lite," an order of magnitude below the real thing.
2. **How fresh must results be — a fixed full recrawl, or continuous incremental refresh?** Say the interviewer answers "the popular web should be days-fresh, the tail can be months-stale." That one sentence decides the crawl budget and kills full recrawl. File it; it returns on rung 2.
3. **Ranked results, or raw lookup?** Learned ranking and PageRank computation are their own round — scope them out, keep the link graph as a stored signal, and design the spine: crawl → parse → invert → serve. Also settle here: we keep *parsed, compressed text*, not raw HTML snapshots. That single decision is worth ~60× on storage, as drill 26.2 shows.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| Corpus | 10^10 pages | Google-lite; the headline — propose it, get the nod |
| Domains | ~10^8 | ~100 pages/domain average; a power law hides the mega-sites |
| URLs discovered | ~10^11 | ~10× the crawled corpus — most links are seen, few are fetched |
| Page transfer (fetch) | ~2 MB | canon web-page total transfer |
| Raw text per page | ~100 KB | a generous slice of the 2 MB — the rest is images, JS, CSS we don't index |
| Refresh | full corpus ~monthly | each page ~12×/year baseline, then tiered by popularity |
| Searches | ~10^9/day | Google-lite query volume |
| Politeness | ≤1 fetch/s/domain | the courtesy every crawler owes a host it doesn't own |

## Rung 1 — Users

This system has two populations, and they meet only inside the index. There is the **web** — 10^10 pages across ~10^8 domains — which we ingest; and there are **searchers** — call it 10^9 people issuing ~10^9 queries a day — whom we serve. Neither is a classic DAU story, and the interesting thing is the shape, not the count.

Notice the inversion, the same one *Cloud storage* turned on: in a feed system, bytes are a *consequence* of today's actions. Here the corpus is a **stock** — ten billion pages piled up over years of crawling — and today's crawl budget only refreshes a slice of it. The headline number is not a QPS at all; it is the size of a thing that already exists. So we climb the traffic rung quickly and let it hand us off to the real question.

One shape to file now: crawling is the one system in this book with **no rush hour**. User traffic has a 9 PM spike; a crawler runs flat at its budget, 24/7, because the web doesn't care what time it is. The ×3 peak factor applies to queries, never to the crawl.

## Rung 2 — Actions (traffic)

**Crawl budget.** A full recrawl once a month is the naive baseline:

```
corpus / month:  10^10 pages ÷ (30 × 10^5 s)  = 10^10 ÷ 3×10^6  ≈ 3,000 pages/s sustained
```

Three thousand fetches a second, flat. As a QPS, that is *nothing* — a rounding error against the query side. But two constraints bend it before it leaves the rung.

The first is **politeness**. You may not hammer a stranger's server; cap it at ≤1 fetch/s/domain. In aggregate that is no throttle at all — 3,000/s spread over 10^8 domains is one fetch per domain every nine hours. But point it at a single mega-site:

```
mega-domain, 10^8 pages, at 1 fetch/s:  10^8 s ÷ 10^5 s/day  ≈ 1,000 days ≈ 3 years for ONE full pass
```

You physically cannot full-recrawl a giant domain under politeness. That forces prioritization *inside* a domain: crawl its changed and popular pages, let the tail rot. This is the crawler's version of the celebrity in *News feed* — the tail of the distribution breaks the naive policy.

The second is that **full recrawl is a treadmill you never finish.** Re-fetching 10^10 pages on a fixed cycle spends the same budget on a 2009 forum post that never changes as on a news homepage that changes hourly. The forced refinement: keep the ~3,000/s total, but *allocate* it by change-rate × popularity — the head recrawled daily, the tail quarterly. Freshness becomes a per-URL budget, not a global clock.

**Query traffic.** The read side:

```
searches:  10^9/day ÷ 10^5 s  = 10,000 queries/s average   × 3 peak ≈ 30,000/s
```

Thirty thousand peak queries a second looks tame — until you remember each one must consult *the whole index*, and the whole index is about to turn out to be a thousand machines. Hold that; it's the fan-out, and it needs the next number first.

At face value this rung is finished — 3,000 modest fetches, 30,000 modest queries. And it has told us almost nothing, because the system's headline is not a rate. It is the size of what all this crawling produces.

### The signature sub-question — how big is the index for 10 billion pages?

> ⚡ **Instinct check** — 10^10 pages, ~100 KB of extractable text each. How many bytes of text is that? After canon compression? And the inverted index built on top — bigger or smaller than the text? Answer before reading on.

Text first, saying the compression out loud:

```
raw text:      10^10 pages × 100 KB    = 10^15 B = 1 PB logical text
÷3 compression (canon, text)           ≈ 300 TB compressed text stored
```

Now the index. An inverted index maps every term to its posting list — the doc-ids that contain it, delta-encoded and compressed. The IR rule of thumb: a compressed docid-and-frequency index runs **~10% of the raw text** it covers (full positional postings would roughly double it; we tier positions separately):

```
inverted index:  ~10% × 1 PB raw text  ≈ 100 TB logical, one copy
                 (≈ one third of the 300 TB compressed text — the index is smaller than the corpus)
```

**One hundred terabytes.** That is the number the whole design bends around, so look hard at it.

> Walk into the catalog hall of a great old reference library — the one with a thousand oak drawers of index cards, whether you picture the Bodleian, the old Library of Congress, or a Timbuktu manuscript house. The books on the shelves are the web; the *cards* are the inverted index. Here is the humbling part: catalog ten billion books by every word that matters, and the cards outgrow the building that holds the books. You cannot keep them in one room — the drawers spread across floors (shards). You never reprint the hall — when a book changes you slip a few new cards into the right drawers (incremental refresh, not full recrawl). And the drawers the whole city opens every day — today's headlines, this week's names — stay on the reference desk within arm's reach (hot, in RAM), while the drawers nobody has touched in months wait in the basement (cold, on disk), pulled only when someone finally asks.

**Disk or RAM?** Neither, wholly — and that is the actual answer. 100 TB against the canon 128 GB box (~100 GB usable) is:

```
100 TB ÷ 100 GB/node  = 1,000 nodes just to hold ONE copy in RAM
```

So the index *shards ~1,000 ways no matter what* — it cannot live on one node, full stop. Whether those shards serve from RAM or SSD is the real question, and it is not decided by throughput. At 30,000 peak queries scatter-gathering across 1,000 shards, each shard sees only ~30,000 reads/s — trivial for either tier. It is decided by **tail latency**: a query waits for the *slowest* of its 1,000 parallel shard reads, so the 99.9th-percentile of one shard becomes the *typical* latency of the whole query. SSD p99 under load is milliseconds and jittery; RAM is microseconds and flat. To hold the 100 ms human budget across a 1,000-way fan-out, the hot shards live in RAM and the cold tail rides NVMe.

> 🎯 **In the room** — the level-separating sentence: "The 100 TB index can't fit one node, so it shards a thousand ways whether I like it or not — and the RAM-versus-disk call isn't about QPS, it's that a 1,000-way scatter-gather makes my latency the *max* of a thousand reads, so the hot shards have to be in RAM." Most candidates say "put the index in RAM" or "put it on SSD" as if it were one number and one tier. It is neither.

## Rung 3 — Bytes (storage & bandwidth)

**Fetch bandwidth — the firehose.** The crawl is modest as a QPS and enormous as a pipe:

```
ingress:  3,000 pages/s × 2 MB  = 6,000 MB/s = 6 GB/s sustained, 24/7
          6 GB/s ÷ 1.25 GB/s per 10 Gbps port  ≈ 5 saturated ports
```

But watch what we *keep*: we fetch 2 MB and store ~30 KB of compressed text.

```
kept:  30 KB ÷ 2,000 KB  ≈ 1.5%  →  the parser discards ~98% of everything it fetches
```

The crawler is a firehose that keeps a teacup. That is not waste — the images, scripts, and stylesheets in that 2 MB are not searchable text, and pulling them is the price of getting the 30 KB that is.

**Storage.** Three stores, and the multipliers differ — say which is which:

```
compressed text corpus:  10^10 × 30 KB  = 300 TB  × 1.5 erasure coding  ≈ 450 TB provisioned
inverted index:          100 TB  × 3 serving replicas                  ≈ 300 TB provisioned
link graph:              10^10 × 50 links × 8 B = 4 TB × 5              ≈ 20 TB — noise
URL-seen set (Bloom):    ~125 GB (below)                               — noise
total                                                                  ≈ 750 TB ≈ 1 PB
```

> ⚠️ **Trap** — reaching for the database ×5 on the text corpus. That corpus is large, immutable-per-crawl, and read mostly for reindexing — a blob store, which erasure-codes at the canon ×1.5, not ×5. Apply ×5 to 300 TB and you provision 1.5 PB instead of 450 TB — a phantom petabyte that prices at ~$20k/month of imaginary storage. Same multiplier-hygiene slip as *Cloud storage*, same real money.

And a second multiplier note worth saying aloud: the index gets ×3, but that ×3 is for **read throughput and availability, not durability** — the index is *derived*. It is a deterministic function of the text corpus, so you skip the ×1.5 durability padding entirely; if a shard's disks die you don't restore a backup, you re-index that slice. The durable source of truth is the erasure-coded text; the index replicas are a rebuildable serving cache.

**The URL-seen set.** Before the bytes above, one gnarly metadata problem: the crawler must remember which of ~10^11 discovered URLs it has already seen, or it re-crawls the web forever. Three sizings, each forcing the next:

```
exact URL strings:  10^11 × 100 B (canon URL)  = 10 TB   → absurd to keep hot
fingerprints:       10^11 × 8 B (int64 hash)    = 800 GB  → ~8 sharded boxes
Bloom filter:       10^11 × ~10 bits            = 1.25×10^11 B ≈ 125 GB  → ONE box
```

Ten bits per URL buys a ~1% false-positive rate — meaning ~1% of the time the filter says "seen it" about a genuinely new URL and we skip it. For a crawler that is a *fine* trade: the web has more URLs than anyone will ever crawl, and losing 1% of new discoveries costs nothing measurable. So the seen-set is a Bloom filter in one box's RAM — the classic forced move, and it falls straight out of the arithmetic.

**Query egress** is a rounding error: 30,000 responses/s × ~10 KB of blue links and snippets ≈ 0.3 GB/s of text. This system does not have an egress problem.

## Rung 4 — Machines (cache, servers, shards)

**Crawler fetchers.** Fetching is I/O-wait, not CPU — the box just holds thousands of slow connections. Bandwidth binds:

```
6 GB/s ÷ 1.25 GB/s per box  ≈ 5 boxes   (a dozen for redundancy and DNS/frontier headroom)
```

Crawling all of Google-lite takes about five machines. The bottleneck was never crawler count; it was the frontier scheduler enforcing politeness across 10^8 domains.

**Parser / indexers.** Parsing HTML, stripping boilerplate, tokenizing, and building postings is the canon's named *heavy* work (~100 QPS/server):

```
3,000 pages/s ÷ 100 ÷ 0.6  ≈ 50 boxes
```

**URL-seen set.** One Bloom box plus a replica ≈ 2 boxes.

**Index-serving fleet — the main event.** Size binds, and then tiering rescues the bill:

```
by size (all-RAM):   100 TB × 3 replicas ÷ 100 GB/node   ≈ 3,000 boxes   ← naive
by size (all-SSD):   100 TB ÷ 2 TB/node × 2 replicas      ≈ 100 boxes     ← too slow at the tail
tiered:  hot 20% (20 TB) in RAM  → 200 shards × 3 ≈ 600 boxes
         cold 80% (80 TB) on NVMe → 40 shards × 2 ≈  80 boxes
         total                                    ≈ 700 boxes  → call it ~1,000 index nodes
```

The 80/20 law does the work: keep the fifth of the index that appears in most results hot in RAM, let the rest serve from SSD, and the fleet drops from 3,000 boxes to ~1,000. Naming *which* pressure set the count — capacity, not QPS — is the interpretation the interviewer is listening for.

**Query mixers.** Each query fans to 1,000 shards and merges the returns — typical work:

```
30,000 peak ÷ 1,000/box ÷ 0.6  ≈ 50 boxes
```

Total: ~5 crawlers + 50 parsers + 2 Bloom + 50 mixers + ~1,000 index nodes ≈ **1,100 machines**, and the index serving fleet is 90% of it. Every other component is a footnote to the cost of keeping 100 TB queryable in 100 ms.

## Rung 5 — Money

```
index fleet:    ~1,000 boxes × $1k              ≈ $1M/month     ← the entire bill
crawl+parse+mixers: ~100 boxes × $1k            ≈ $100k/month
text storage:   450 TB × $20/TB-month (object)  ≈ $9k/month     — noise
index SSD tier: cold 80 TB × $100/TB-month      ≈ $8k/month     — noise
crawl ingress:  15 PB/month fetched             — ingress unbilled
query egress:   ~0.3 GB/s of text               — noise
```

Roughly **$1.1M a month, ~90% of it the index-serving fleet.** Read that inversion out loud, because it is the whole point: a streaming service's bill is egress, *Cloud storage's* bill is storage — but a search engine's bill is the **RAM and cores to keep a 100 TB index hot enough to answer in a human eyeblink.** Not bytes shipped, not bytes stored. Bytes kept *warm*. The engineering effort, and the invoice, both go to hot-index tiering.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 100 TB index vs 128 GB/node | it cannot fit one node — shard ~1,000 ways, no debate |
| 1,000-way scatter-gather; latency = max of 1,000 reads | hot shards in RAM (µs), cold on SSD — a **tail-latency** call, not throughput |
| tiering: hot 20% RAM, cold 80% SSD | fleet drops 3,000 → ~1,000 boxes; popularity, not size, sets what's hot |
| mega-domain = 3 years/full pass under politeness | can't full-recrawl big sites — prioritize by popularity × change-rate |
| full recrawl = a treadmill you never finish | incremental refresh, per-URL freshness budget — not a fixed cycle |
| 10^11 URLs → 125 GB Bloom vs 800 GB exact | URL-seen set is a Bloom filter, one box, ~1% false positives accepted |
| fetch 2 MB, keep 30 KB | discard ~98% at the parser — store parsed text, never raw pages |
| index is derived from the text corpus | replicate ×3 for QPS/availability, **not** durability — rebuild on loss |

## The pushback round

**Interviewer:** "Your thousand shards came from 100 TB of index — but most of that is a long tail nobody ever searches. Aren't you paying to keep junk hot?"

**You:** "No — the 1,000 shards is *capacity*, not *heat*. The 80/20 law says a fifth of the index shows up in most results, so only ~20 TB — 200 shards — ever needs RAM; the cold 80 TB rides SSD at fewer replicas, and the true never-touched tail can be pruned or archived off the serving path entirely. So the fleet is ~1,000 boxes for capacity but the RAM footprint is a fifth of that. Sizing the shard *count* and sizing the RAM *tier* are two different questions with two different answers."

**Interviewer:** "You full-recrawl monthly. A news homepage changes every hour — your index is a month stale on exactly the pages people care about most."

**You:** "Which is why refresh can't be uniform. I'd spend the same ~3,000/s crawl budget by change-rate × popularity: the hot head recrawled every few minutes, the dead tail every few months, and cheap change-detection — HTTP `If-Modified-Since` and sitemaps — so most re-fetches return '304 Not Modified' and cost almost nothing. Freshness is a per-URL budget, not a global cycle. And genuine breaking-news freshness needs more than fast crawling — it needs a real-time indexing lane, which is drill 26.3."

**Interviewer:** "You replicate the 100 TB index ×3 — 300 TB. Why not treat it like a database and make those durable copies?"

**You:** "Because the index isn't a source of truth — it's a *materialized view*. It's a deterministic function of the text corpus, the same way a database index is a deterministic function of its tables. You don't back up a database's indexes; you back up the tables and rebuild the indexes, because a derived structure you can regenerate doesn't need durability — it needs *availability*. So the ×3 buys read throughput and shard-failure tolerance, not safety: if a shard's disks die, I re-index that slice from the erasure-coded text corpus, which *is* the durable copy. Knowing which bytes are the source and which are a rebuildable cache is the whole game — it's what lets me spend replication dollars on serving instead of on protecting data I can always recompute."

That distinction — **source of truth is durable; a derived index is a cache you replicate for speed, not safety** — is the senior signal of the round.

## Say it in 60 seconds

> "Numbers first, because here they pick the whole architecture. Ten billion pages. The crawl is a trickle: full recrawl monthly is three thousand fetches a second — flat, no rush hour — but at two megabytes a page that's six gigabytes a second of bandwidth, and we keep only the thirty kilobytes of compressed text, throwing away ninety-eight percent. The headline isn't a QPS, it's the index: a hundred kilobytes of text a page is a petabyte raw, three hundred terabytes compressed, and the inverted index on top is about a hundred terabytes. That number decides everything — a hundred terabytes can't fit one hundred-and-twenty-eight-gig box, so the index shards a thousand ways no matter what, and because every query scatter-gathers across all thousand shards, my latency is the slowest of a thousand reads, so the hot fifth lives in RAM and the cold tail on SSD. Politeness means a giant domain takes three years to fully recrawl, so refresh has to be prioritized, not uniform. The URL-seen set is a Bloom filter — a hundred and twenty-five gigs in one box instead of eight hundred. Call it eleven hundred machines, storage and egress are noise, and the bill is a million a month — ninety percent of it just keeping the index hot. The number that worries me is that hundred-terabyte index against one node's RAM, so I'd design the sharded, popularity-tiered inverted index — hot in RAM, cold on disk, refreshed incrementally — first."

## Numbers to keep

- Corpus 10^10 pages; raw text ~100 KB/page = **1 PB**, ÷3 compression = **~300 TB** stored text
- Inverted index ≈ 10% of raw text = **~100 TB, one copy** — the number the design bends around
- 100 TB ÷ 100 GB/node = **~1,000 shards** — can't fit one node, so sharding is forced by *size*
- Query fan-out is 1,000-way → latency = max of 1,000 reads → **hot shards in RAM** (tail latency, not throughput)
- Crawl budget = 10^10/month = **~3,000 pages/s sustained, no peak**; ×2 MB = **6 GB/s ingress**, keep 1.5%
- Politeness: mega-domain = **~3 years/full pass** → refresh must be prioritized, not uniform
- URL-seen set: 10^11 URLs → **Bloom ~125 GB (one box)** vs 800 GB exact, ~1% false positives accepted
- Index is derived → replicate ×3 for **QPS, not durability**; the text corpus is the source of truth
- ~1,100 boxes, **~$1M/month — 90% the index fleet**; search's bill is warm bytes, not stored or shipped bytes

## Drills

**Drill 26.1** — The interviewer says: "Make it the full web — 10^11 pages, not 10^10." Which numbers move, which don't, and what breaks?

<details><summary>Answer</summary>

```
raw text:   10^11 × 100 KB   = 10^16 B = 10 PB → ÷3 ≈ 3 PB compressed text
index:      ~10% of raw      = 1 PB, one copy
shards:     1 PB ÷ 100 GB RAM/node  = 10,000 RAM nodes  ← impossible to keep all-RAM
            1 PB ÷ 2 TB SSD/node    = 500 SSD nodes     ← tiering is now mandatory, not optional
crawl:      10^11 / month ≈ 33,000 pages/s × 2 MB = 66 GB/s ingress → ~50 crawler boxes
politeness: per-domain rate unchanged — 1 fetch/s/domain doesn't scale with corpus size
```

So what: below ~10^10 the popularity tiering is an optimization; at 10^11 it becomes the only physically possible design — nobody keeps a petabyte index in RAM — and crawl bandwidth (60+ GB/s) graduates from a footnote to a real datacenter-uplink line item. The Bloom filter and politeness math, meanwhile, don't care about the extra zero.
</details>

**Drill 26.2** — Product adds a "view cached page" feature: store a full-fidelity snapshot of every crawled page, images and all. Recompute storage and name the trade-off.

<details><summary>Answer</summary>

```
snapshot store:  10^10 × 2 MB (full transfer)  = 2×10^16 B = 20 PB logical
                 × 1.5 erasure coding           = 30 PB provisioned
vs text-only:    ~450 TB provisioned            → ~65× more storage
cost:            30 PB = 30,000 TB × $20/TB-month  ≈ $600k/month  (was ~$20k)
```

So what: one checkbox flips search from a compute-bound system (the index fleet is the bill) into a *storage*-bound one (snapshots dwarf everything). The snapshot corpus belongs on the coldest object-storage tier, off the serving path entirely — and if you only need the *text* cached, compressed HTML at ~30 KB/page keeps it near the existing text store and the feature costs almost nothing. Full-fidelity archival is the expensive interpretation; say which one the product actually wants.
</details>

**Drill 26.3** — New SLA: "top news results must be less than 5 minutes stale." Which part of the system breaks, and what's the forced move?

<details><summary>Answer</summary>

```
crawl side:   ~10^4 hottest pages, every 5 min  = 10^4 ÷ 300 s ≈ 33 fetches/s  → trivial
index side:   the batch indexer rebuilds shards on an hours-to-days cycle
              → a page crawled at 12:00 doesn't appear in results until the next build  ← the break
```

So what: the crawl is easy; the *indexing latency* is what fails. Batch index builds are minutes-to-hours, so freshness forces a second, small **real-time index lane** — new documents indexed incrementally within minutes into a tiny in-RAM index, merged with the big batch index at query time. It's the identical head/tail split as everywhere in this book: a small hot structure serving the fresh few, a large cold structure serving the slow many, unioned at read time — *News feed's* push/pull and *Cloud storage's* build/buy wearing indexing clothes.
</details>
