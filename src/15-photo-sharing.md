# 15 — Photo sharing

*Two systems wearing one product: a database that grows by gigabytes and a blob store that grows by petabytes — held together by a 20 KB decision worth millions a month.*

## The prompt

> "Design Instagram. What do the numbers look like?"

Candidates hear "Instagram" and reach for feed ranking, follower graphs, the celebrity problem. The numbers point somewhere else. This is a media system with a social product attached, and the estimation's job is to prove that to you — fast — before you spend forty minutes designing the wrong half.

## Scope it in 60 seconds

Three questions, because each one moves a rung:

1. **Photos only, or video too?** Video multiplies every byte by ~25 — a minute of stored renditions is ~100 MB against a photo's 4 MB — and owns its own walkthrough: [chapter 14](14-video-platform.md). Assume photos.
2. **Is feed ranking in scope?** Fan-out and the follower graph are [chapter 12](12-news-feed.md)'s math. Assume the feed service hands back lists of photo ids; this walkthrough owns what happens next.
3. **Do photos ever leave?** No — retention is forever, deletion is negligible. Storage is pure accumulation.

So this walkthrough owns the **media path** — upload, variant generation, storage, delivery — plus the metadata that indexes it. That split, media versus metadata, is the chapter.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| DAU | 500 M | Instagram-scale; at the canon 25% DAU/MAU that's ~2 B MAU — propose it, get the nod |
| Uploads | 100 M photos/day | 1 in 5 DAU posts daily; most users lurk |
| Original photo | ~2 MB | the canon phone-camera anchor |
| Stored per photo, all variants | ~4 MB (×2 original) | canon: 20 KB thumbnail + 200 KB feed rendition + original, with headroom |
| Views | ~100 image-loads per DAU/day | ~50 feed items × ~2 images each, carousels averaged in |
| Served size | 200 KB feed-quality dominates; 20 KB thumbnails on grids | what the screen actually needs |
| CDN offload | ~90% | immutable objects plus the 80/20 hot-content law; stated, never silent |

## Rung 1 — Users

500 M DAU, global, diurnal — peak ×3, the canon default. The split that matters isn't geography, it's role: everyone views, few post. 100 M uploads against 500 M DAU means the write side belongs to a fifth of the users while the read side belongs to all of them — the first hint that this system's two halves live at different scales. Get the nod on both numbers before multiplying; a wrong base poisons every rung below.

## Rung 2 — Actions (traffic)

```
uploads: 100 M/day ÷ 10^5 s              = 1,000/s average    × 3 ≈ 3,000/s peak
views:   500 M DAU × 100 image-loads/day = 5 × 10^10 loads/day
         5 × 10^10 ÷ 10^5 s              = 500,000/s average  × 3 ≈ 1.5 M/s peak
ratio:   5 × 10^10 reads : 10^8 writes   = 500 : 1
```

Interpret before moving. The upload path — the thing everyone draws first — is a thousand requests a second. Modest. The feed API itself, call it 5 fetches per DAU per day, runs ~25,000/s. And then there is the image path: **half a million loads a second on average, 1.5 million at peak** — twenty times the feed API, nearly three orders of magnitude above the write path. Image-serving QPS is the silent giant of this design.

> 🎯 **In the room** — Say the giant out loud: "The biggest QPS number in this system never appears on the architecture diagram — it lands on the CDN." Most candidates estimate the API tier and stop; naming image delivery as the real traffic is the moment the interviewer starts trusting your numbers.

## Rung 3 — Bytes (storage & bandwidth)

**Variants first**, because every byte below depends on them. From each 2 MB original the pipeline cuts a 20 KB thumbnail and a 200 KB feed rendition, keeps the original, and the canon rounds the whole bundle to ~2× the original: 4 MB stored per photo. The one-hour photo lab worked exactly this way — wallet prints, 4×6s, and the negative in a sleeve — because handing a tourist the negative was absurd. Variants are not a software idea; they are what delivery has always looked like.

**Storage.**

```
media:    100 M/day × 4 MB              = 400 TB/day logical
          × 1.5 (erasure-coded blob)    = 600 TB/day provisioned
          × 365 days                    ≈ 220 PB/year
metadata: 100 M rows/day × 1 KB         = 100 GB/day logical
          × 5 (replication + overhead)  = 500 GB/day provisioned
```

Two different multipliers, both canon: a database pays ×5 for replicas and indexes; a PB-scale blob store cannot afford three full copies, so it erasure-codes at ×1.5. Now look at the gap: 600 TB a day against half a TB a day. **The blob store grows a thousand times faster than the database that indexes it.** Media and metadata are two systems wearing one product — different growth rates, different access patterns, different teams — and the worst available design move is pretending one storage system can be both. That asymmetry is this chapter's first so-what.

**Bandwidth.** Ingress is uploads: 100 M × 2 MB = 200 TB/day ≈ 2 GB/s average, 6 GB/s peak — a handful of NICs, said and done. Egress is the other thing.

> ⚡ **Instinct check** — 5 × 10^10 views × 200 KB: how many PB per day? Answer before reading on.

```
egress, raw:   5 × 10^10 views × 200 KB = 10^16 B = 10 PB/day
CDN at ~90%:   origin serves ~1 PB/day
```

Ten petabytes out against two hundred terabytes in: the system is fifty times more about delivery than acceptance.

**The thumbnail lever.** Those 10 PB assumed every view is a 200 KB feed photo. But grids — profiles, explore, search — only need 20 KB thumbnails. If half of all views land on grids:

```
average served: 0.5 × 200 KB + 0.5 × 20 KB = 110 KB
egress:         110 KB × 5 × 10^10         ≈ 5.5 PB/day
```

Serving the *right* variant nearly halves the largest flow in the company. Hold that — rung 5 prices it.

One cache note while we're here: the canon working set — 20% of a day's reads — is 20% of 10 PB = **2 PB**. No Redis fleet you'd build holds that, which is why the "cache" for this system is the CDN itself: thousands of rented edge boxes, paid by the delivered terabyte.

## Rung 4 — Machines (cache, servers, shards)

**Variant workers.** Each upload costs ~1 second of CPU — decode, resize twice, re-encode, strip EXIF. Size the fleet with the queueing identity, in-flight = arrival rate × residence time:

```
3,000/s peak × ~1 s of work = 3,000 jobs in flight
÷ 32 cores per box          ≈ 100 boxes at peak
```

A hundred boxes that exist to cut photos down to size. Autoscale them — uploads queue gracefully, and a photo appearing three seconds late is invisible.

**Serving.** The CDN delivers; origin's job is the ~10% miss stream:

```
1 PB/day ÷ 10^5 s           = 10 GB/s average    × 3 ≈ 30 GB/s peak
÷ 1.25 GB/s per 10 Gbps NIC = 24 NICs    ÷ 0.6 ≈ 40 boxes' worth
```

Origin is a NIC problem, not a CPU problem — forty boxes of network streaming bytes off the blob store.

> ⚠️ **Trap** — Routing image GETs through the application tier "for auth". At peak that's 1.5 M/s × 200 KB = 300 GB/s flowing through servers that do nothing but copy bytes — hundreds of boxes that shouldn't exist. Signed URLs pointing straight at the CDN and blob store delete the entire fleet.

**Metadata shards.** The shard formula is a max of two pressures, and here — unusually — both fire:

```
by writes: 1,000/s average = one SQL node's entire write ceiling
           3,000/s peak ÷ 1,000 TPS = 3 primaries — needed on day one
by size:   500 GB/day provisioned   = a new 2 TB node every 4 days
```

This database is **born sharded**: write rate forces the split before the first byte accumulates — the inverse of the URL shortener, where size forced it after years. So shard by photo id from day one, and over-provision the logical count — 8–16 logical shards mapped onto a few physical primaries — because the size line says new nodes keep arriving, and you want growth to be a remap, not a migration.

## Rung 5 — Money

```
CDN delivery: 10 PB/day × 30 × $30/TB         ≈ $9 M/month   ← the bill
storage:      year-one average ~100 PB × $20  ≈ $2 M/month   (stock grows 0 → 220 PB)
compute:      ~200 boxes × $1k                ≈ $0.2 M/month — noise
sanity check: 10 PB/day at raw egress, $100/TB ≈ $30 M/month
```

The CDN line dominates — call it 5× storage in year one — and the $30 M counterfactual is why the CDN is structural, not an optimization. Two consequences worth saying out loud:

- The thumbnail lever from rung 3 — 10 PB down to 5.5 PB/day — is the difference between $9 M and $5 M a month. Variant discipline is worth ~$4 M/month, forever. A 20 KB object just moved the bill by millions.
- If origin fills are billed as egress, the 10% miss stream is ~1 PB/day ≈ $3 M/month — each point of CDN hit rate moves ~$300 k/month. Hit rate is the single most valuable percentage in the company.

When one line item is $9 M and ordinary engineering — variant pipelines, cache-key design, hit-rate work — can move it by 40%, that line is what pays for the engineers.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 600 TB/day blob vs 0.5 TB/day DB | two storage systems, never one: erasure-coded blob store for media, sharded SQL for metadata |
| 1.5 M/s peak image loads, 20× the feed API | the hot path is the CDN — make URLs immutable and variant-addressed so edges cache forever |
| 200 KB vs 20 KB served → 10 vs 5.5 PB/day | variants are a cost feature, not a UX nicety; build the pipeline before launch, not after the first invoice |
| ~90% offload, each point ≈ $300 k/month | cache hit rate gets an owner, a dashboard, and an alert — treat it like revenue |
| 1 k writes/s = one SQL node's ceiling | metadata is born sharded by photo id; over-provision logical shards on day one |

## The pushback round

**Interviewer:** "100 million uploads but 50 billion views — your read:write is 500:1, not the canon's 100:1 for content systems. Does anything change?"

**You:** "Let's test it. At 100:1, views would be 10^10 a day — 100 k/s average instead of 500 k/s. What would I build at 100 k/s? A CDN-first delivery path, variants, immutable URLs — exactly what I built. The ratio's job is to classify the system, and both values classify it the same way: extremely cache-shaped. Moving from 100:1 to 500:1 changes no box on the diagram — it multiplies the counts. Five times the egress, five times the CDN bill, and the case for hit-rate engineering gets five times stronger."

**Interviewer:** "So your assumption was off by 5× and it cost you nothing?"

**You:** "It cost nothing *because* it was on the table — you corrected it for free, and only counts moved. Ratios pick the architecture family; exact values size the fleet. The expensive version of this mistake is the silent one, where the 500:1 surfaces a quarter late in the CDN invoice instead of in the design review."

## Say it in 60 seconds

> "Numbers first, because they'll pick the design. 500 million DAU, 100 million uploads a day — a thousand a second, three thousand peak: modest. Each user loads about a hundred images a day, so reads are 50 billion a day — half a million a second, 1.5 million peak. That 500-to-1 ratio is the system: this is a delivery problem. Bytes: a photo with variants stores at 4 megabytes, so 400 terabytes a day logical, 600 provisioned on an erasure-coded blob store — about 220 petabytes a year — while the metadata database grows half a terabyte a day. A thousand times slower: two different systems. Egress: 50 billion views at 200 kilobytes is 10 petabytes a day; a CDN at 90% leaves origin one. Machines: a hundred boxes cutting variants, forty boxes' worth of origin NICs, and the metadata is born sharded — writes hit one node's ceiling on day one. Money: the CDN is 9 million a month, five times storage; serving thumbnails where grids need thumbnails takes it toward five. The numbers that worry me are the served-variant mix and the CDN hit rate — each moves millions a month — so the design should make variants impossible to skip and hit rate a first-class metric."

## Numbers to keep

- Uploads 100 M/day = 1 k/s; views 5 × 10^10/day = 500 k/s — 500:1, the image path is the system
- Media 400 TB/day logical, ×1.5 erasure = 600 TB/day ≈ 220 PB/year; metadata 0.5 TB/day — a 1,000× growth gap
- Egress 10 PB/day at 200 KB; honest thumbnails (110 KB average) ≈ 5.5 PB/day
- CDN ≈ $9 M/month ≈ 5× storage ($2 M); raw egress would be $30 M — the CDN is structural
- In-flight = rate × residence: 3 k/s × 1 s ÷ 32 cores ≈ 100 variant workers at peak
- Origin at 90% offload: 1 PB/day = 10 GB/s ≈ 40 boxes' worth of 10 Gbps NICs
- Metadata is born sharded: 3 primaries by writes on day one, a node every 4 days by size — over-provision logical shards

## Drills

**Drill 15.1** — Product adds Stories: 200 M additional photos/day that expire after 24 hours. Which numbers move, and which don't?

<details><summary>Answer</summary>

```
uploads:  300 M/day total = 3 k/s average, 9 k/s peak → worker fleet ×3 (~300 boxes)
metadata: 9 k/s peak ÷ 1 k TPS = 9 primaries — your 16 logical shards absorb it; 8 would not have
storage:  200 M × 4 MB × 1.5 = 1.2 PB standing pool — constant, not growth
          (the whole pool ≈ 2 days of the feed's 600 TB/day accumulation)
egress:   if each DAU watches ~20 stories/day: + 10^10 × 200 KB = +2 PB/day → CDN ≈ $11 M/month
```

The write path triples; storage barely notices. A 24-hour TTL turns 200 M uploads/day into a flat 1.2 PB pool instead of +300 PB/year — retention is the strongest storage lever there is. So-what: ephemerality is cheap in bytes and expensive in QPS — size Stories by its write rate, not its storage, and note that the day-one logical-shard over-provision is what let the database absorb a 3× write surge with a remap instead of a re-architecture.
</details>

**Drill 15.2** — A deploy bug serves originals (2 MB) instead of feed-quality (200 KB), and nobody reads the egress dashboard for a week. What did the week cost?

<details><summary>Answer</summary>

```
egress: 5 × 10^10 × 2 MB = 100 PB/day — 10× normal
week:   700 PB × $30/TB ≈ $21 M; a normal week ≈ $2 M → ~$19 M excess
```

About $19 M — at the canon's $15 k/month per engineer, roughly a hundred engineer-years burned by one variant-selection bug. And the bill is the gentle half: phones pulled 2 MB into 200 KB slots all week, so the product also got slower worldwide. So-what: when one code path controls a $9 M/month flow, bytes-per-view belongs on the deploy gate, not just a dashboard. Variant discipline is a guardrail, not a preference.
</details>

**Drill 15.3** — A national festival doubles uploads for one day. Which tier feels it first?

<details><summary>Answer</summary>

Walk the tiers. CDN and egress barely move — the surge is writes. Blob ingest doubles to 1.2 PB for the day; an S3-class store shrugs. The tiers sized against write rate are the candidates, and a national festival is single-region — canon peak ×5 — on a doubled base:

```
200 M/day = 2 k/s average × 5 regional peak = 10 k/s
workers:  10 k in-flight ÷ 32 cores ≈ 300 boxes needed vs ~100  ← feels it first
metadata: 10 k/s ÷ 1 k TPS = 10 primaries — the 16 logical shards just paid out
```

The CPU-bound variant workers hit the wall first — they were utilization-sized. The absorber is already in the design: the upload queue. Lag rises by seconds, autoscaling catches up, nobody notices a photo posting late. So-what: event spikes land on the write path's slowest stage; when that stage is queueable, elasticity beats standing fleet — provision the database, autoscale the workers.
</details>
