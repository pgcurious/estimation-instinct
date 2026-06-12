# 14 — Video platform

*The biggest bytes in the book: an archive growing petabytes a day, an egress stream you sanity-check against the internet itself — and the first cheat-sheet price that breaks.*

## The prompt

> "Design YouTube. Storage and bandwidth first, please."

Notice what the interviewer just did. Candidates love video *metadata* — IDs, titles, view counts — because it estimates like a URL shortener and feels safe. The prompt closes that exit. On a video platform the bytes are the system, and the interviewer wants to watch you reason about numbers three or four orders of magnitude past anything you operate. That is today's real test: the Ladder has to hold where gut feel has nothing left to grab.

## Scope it in 60 seconds

Three questions change today's numbers.

1. **Upload and watch only — no ads, no recommendations?** Strips out the ML fleets and leaves the bytes, which is where the interviewer pointed anyway.
2. **Is live in scope?** Live re-synchronizes the audience and deletes every averaging trick you own — drill 14.2 shows how violently. Get it excluded or get it priced.
3. **Same order of magnitude as the real thing?** Ask explicitly, because YouTube is the rare system whose load is public knowledge — two famous figures, and reaching for them is expected, not cheating.

Answers: upload and watch, video-on-demand only, real-world scale. Numbers on the table.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| Video uploaded | ~500 hours per minute | the famous public figure; propose it, get the nod |
| Video watched | ~1 B watch-hours per day | the other famous public figure |
| Stored size | 100 MB per video-minute, all renditions | canon anchor; defended in the pushback round |
| Delivered size | 50 MB per watch-minute | canon: one 1080p-class rendition goes down the wire |
| Renditions | ~5 per video | 1080p at the top, a ladder of smaller ones below |
| Transcode speed | ~realtime per rendition per core | round, stated so it can be attacked |
| Peak factor | ×3 | global service, diurnal canon |
| Average sitting | ~30 watch-minutes | autoplay-era sessions; only metadata QPS leans on it |

## Rung 1 — Users

Like the URL shortener, this system bends the top rung: demand doesn't arrive as DAU, it arrives as *hours of video* — uploaded and watched. The two public anchors *are* the rung. Earn them anyway with a cross-check, because an anchor you can triangulate is an anchor you can defend:

```
people:   ~2.5 B MAU × 25% canon       ≈ 600 M DAU
behavior: 10^9 watch-hours ÷ 600 M     ≈ 1.7 hours/day per DAU — the order of television time
presence: 10^9 watch-hours ÷ 24 h      ≈ 42 M watching at the average instant → ×3 ≈ ~125 M peak concurrent
```

Two independent roads — the public figure, and DAU × a believable habit — meet at the same number, which is what makes these anchors load-bearing rather than trivia. State both, get the nod, climb.

## Rung 2 — Actions (traffic)

Convert both anchors into this system's working unit — the video-minute — once, and stay there.

```
uploads:  ~500 h/min × 60 min/h          = 30,000 video-minutes arriving per wall-clock minute
          per second: 30,000 ÷ 60        = 500 video-minutes/s — eight hours of footage every second
          per day: 500 h × 1,440 min/day ≈ 720,000 hours of video per day ≈ 4.3 × 10^7 video-minutes/day
watches:  ~1 B watch-hours/day × 60      = 6 × 10^10 watch-minutes/day
          per second: 6 × 10^10 ÷ 10^5 s = 600,000 watch-minutes/s
ratio:    6 × 10^10 ÷ 4.3 × 10^7         ≈ 1,400 watch-minutes per uploaded minute
```

Interpret before touching bytes. Every second, a full workday of footage lands on the door — ingest never sleeps and never spikes much either; creators are diurnal but global. The watch:upload ratio is ~1,400:1, a full order past the canon 100:1 content default — and it is a *mean* hiding a vicious skew: a sliver of videos will absorb almost everything, an ocean will be watched near-never. Hold that; it becomes the storage strategy. Notice also that there is no QPS here yet — this rung 2 lives in minutes because the costs live in bytes. Requests get exactly one line, later, where they belong.

> ⚡ **Instinct check** — 30,000 video-minutes arriving per minute, 100 MB per stored minute. TB per minute, before reading on.

## Rung 3 — Bytes (storage & bandwidth)

### Storage — the reservoir

```
intake:      30,000 video-min/min × 100 MB/min  = 3 × 10^6 MB/min = 3 TB/min
daily:       3 TB/min × 1,440 min/day           ≈ 4.3 PB/day — call it 4–5 PB/day logical
provisioned: × 1.5 (erasure-coded blob store)   ≈ 7 PB/day
yearly:      7 PB/day × 365                     ≈ 2,500 PB = 2.5 EB/year
```

Two things to say out loud while writing that. First, the multiplier: ×1.5, **not** the ×5 you'd use for a database. The ×5 bakes in three full replicas, and nobody keeps three copies of an exabyte — PB-scale blob stores erasure-code, ~1.5 physical bytes per logical byte spread across disks and zones. Knowing *which* canon overhead applies is worth more than the multiplication. Second, the unit: the cheat sheet's prefix table stops at P. Today needs one more step — E, exa, 10^18, a thousand petabytes.

Interpret: an exabyte-class archive growing petabytes a day, forever. The instinct "surely we delete old stuff" fails arithmetic: a ten-minute video is 1 GB across renditions — two cents a month at $20/TB — while *deciding* to delete it (review, appeal, creator trust) costs incomparably more. Deletion never pays for itself here. Tiering does: [chapter 8](../part-2-core-estimations/08-memory-and-cache.md) used "20% of objects take 80% of reads" to size a cache; read the same law from the other end and it says the cold majority of those 2.5 EB will be watched near-never. Sink it to the densest, cheapest shelves and the archive's per-GB cost falls every year even as the archive grows.

### Egress — the spillway

Delivery moves one rendition, not the stored ladder: 50 MB per watch-minute, canon.

```
volume:  6 × 10^10 watch-min/day × 50 MB/min  = 3 × 10^12 MB/day = 3 × 10^18 B = 3 EB/day
average: 3 EB/day ÷ 10^5 s                    = 30 TB/s
peak:    × 3                                  ≈ 100 TB/s
network: 30 TB/s ÷ 1.25 GB/s per 10 Gbps      = 24,000 ten-gig links ≈ 240 Tbps average
```

> ⚠️ **Trap** — Video is quoted in bits (a 5 Mbps stream) but stored in bytes, and this problem punishes ×8 slips more than any other. The canon bridge — 1 Gbps = 125 MB/s, 10 Gbps = 1.25 GB/s — exists so you never multiply by 8 under pressure.

A number like 30 TB/s is past all intuition, so borrow an external anchor and check — out loud:

> 🎯 **In the room** — "Sanity check: streaming video is famously ~15–20% of all internet traffic, and total internet traffic is estimated at order ~10^3 Tbps. My 240 Tbps average says the biggest video platform carries about a fifth of the internet — the envelope agrees with the platform's public reputation in order of magnitude, so I trust it and move on." At exabyte scale the only yardstick left is the internet itself, and *visibly* checking against it is the skill this estimate exists to demonstrate.

Hold the two rung-3 results side by side and you have a dam. The reservoir — the archive — rises forever, and you manage it with terraces: tiers. The spillway — 100 TB/s at peak — is what you actually engineer, because a reservoir rising slowly hurts no one, while a spillway sized 2× too small fails catastrophically on exactly the worst day.

## Rung 4 — Machines (cache, servers, shards)

### The upload path — a transcode farm

The rarely-estimated fleet. Candidates who nail storage and egress still skip the machines between them: every arriving minute must be transcoded into the rendition ladder before anyone can press play.

```
arriving:   30,000 video-minutes per minute
renditions: × 5                               = 150,000 rendition-minutes per minute
encode:     at ~realtime per rendition/core   = 150,000 core-minutes arriving per minute
steady:     ≈ 150,000 cores busy
boxes:      150,000 ÷ 32 cores/box            ≈ 4,700 → ~5,000 boxes for transcode alone
```

Five thousand boxes — against roughly one hundred for the entire API tier below. Compute, not storage, is the upload path's cost; the blob store merely receives what this farm emits. Two riders. The farm is queue-fed, so it absorbs the daily ×3 swell with minutes of queue delay instead of 3× the fleet — asynchronous work gets sized near average, a luxury no serving tier enjoys. And hardware encoders shift the realtime-per-core constant 5–10×; the *structure* — minutes × renditions ÷ encode speed — survives any constant the interviewer swaps in.

### The watch path — the edge

```
NICs:  100 TB/s peak ÷ 1.25 GB/s per 10 Gbps NIC  = 80,000 NICs' worth of edge
cache: hot 20% of a day's reads = 0.2 × 3 EB      ≈ 600 PB of edge cache, fleet-wide
```

Eighty thousand saturated ten-gig ports is not a cluster — no building's uplinks could drain it. It only exists as a fleet scattered across thousands of ISP facilities, each popular byte crossing the expensive backbone once per site and the cheap last mile millions of times. Serving is the CDN's job; rung 5 decides *whose* CDN.

Metadata — the system everyone wants to whiteboard — in one line: ~30-minute sittings → ~2 B watch-starts/day → 20k QPS average, 60k peak → 60k ÷ 1k ÷ 0.6 = 100 servers of typical logic, plus a few TB of rows a year, sharded by video id eventually, ordinarily. Even a 10× shorter sitting makes it 1,000 boxes — still a footnote to 80,000 NICs.

## Rung 5 — Money

[Chapter 7](../part-2-core-estimations/07-bandwidth.md) taught that egress runs the bill. This is the scale where it stops running the bill and breaks the price list instead. Buy delivery at the canon CDN rate:

```
volume: 3 EB/day × 30 days     = 90 EB/month = 9 × 10^7 TB/month
bought: 9 × 10^7 TB × $30/TB   ≈ $2.7 B/month       (at raw cloud egress $100/TB: $9 B)
```

$2.7 billion a month is not a bill; it's a verdict. Call a sane delivery line item single-digit millions a month — this sits three orders of magnitude past it. When an estimate lands three orders past sane, either the arithmetic broke or the model did; the arithmetic survived its internet-sized sanity check upstairs, so it's the model. **$30/TB is a price list for customers buying terabytes to petabytes a month. Nobody sells 90 exabytes.** At this volume you are not a customer — you're a peer. The conclusion the numbers force is vertical integration: build delivery. Cache boxes racked inside ISP networks, peering at exchanges, owned backbone — the per-TB price collapses into capex, power, and engineers. Even a 1,000-engineer delivery organization costs 1,000 × $15k = $15 M/month — half a percent of the rent. (Google Global Cache and Netflix Open Connect are precisely this conclusion, shipped as hardware.)

> 🎯 **In the room** — Every cheat-sheet price has a validity range, and here is the reflex to keep: **when one line item crosses ~$10 M/month — the rent of a several-hundred-engineer org, by the $15k canon unit — stop optimizing the purchase and ask what building looks like.** Saying "at this scale you don't buy delivery, you build it" is the senior move this question was fishing for. The interviewer isn't checking whether you know Google's costs; they're checking whether you notice when a price list stops applying.

The sane parts of the bill, for contrast:

```
storage:   year-1 archive 2.5 EB = 2.5 × 10^6 TB × $20/TB-month ≈ $50 M/month
transcode: ~5,000 boxes × $1k/month                             ≈ $5 M/month
```

Fifty million a month is big but sane — and falling per GB as tiering bites. Transcode is real, optimizable, not existential. The bill, in order: delivery (own it), storage (tier it), compute (a footnote that owns 5,000 machines).

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 3 TB/min intake, 150k cores busy | the upload path is a **compute** problem: a queue feeding a transcode farm, sized in core-minutes |
| 30 TB/s average, ~100 TB/s peak | the watch path is a **delivery** problem: edge fleet inside ISPs, peering — popular bytes must not cross the backbone twice |
| $2.7 B/month to rent 90 EB | build-vs-buy flips: own the CDN; cheat-sheet prices have validity ranges and this is past one |
| 2.5 EB/year, watched-never tail | storage is a **tiering** problem: deletion is not a strategy, shelves are |
| 20k QPS of metadata | the part everyone designs first is the easy 5% — spend whiteboard minutes where the bytes are |

One name, three different problems — and the data-modeling exercise candidates instinctively start with is none of them.

## The pushback round

**Interviewer:** "Everything leaned on 100 MB per minute. Defend it."

**You:** "Decompose it. Top rendition: 1080p at ~5 Mbps — about 0.6 MB/s, times 60 is ~40 MB per minute. (The cheat sheet rounds that single delivered rendition the other way, to 50 — same number, generous rounding.) Below it sits the ladder — 720p, 480p, 360p, audio — each roughly half the bitrate of the one above, and a halving series sums to about one more top rendition: ~40 again. So ~80 MB per stored minute; I round to 100 for container overhead, captions, thumbnails, and a slice of 1440p. One significant figure: 100."

**Interviewer:** "Creators start uploading 4K by default. Now what?"

**You:** "The top rendition jumps to ~15–20 Mbps, so the stored ladder roughly doubles: call it 200 MB per minute. Everything downstream of that constant scales linearly — 6 TB a minute, ~14 PB a day provisioned, ~5 EB a year, a storage bill toward $100 M a month. The transcode farm grows faster than linear, because encode work follows pixels. But notice what doesn't move: egress. Delivery scales with the rendition *watched*, and the screens didn't change — the 50 MB per watch-minute anchor, and the $2.7 B conclusion, stand. Storage tracks what creators upload; delivery tracks what viewers watch. The two constants are independent, which is why I kept them separate."

The recovery's structure is the lesson: decompose the constant into a bitrate, scale its dependents linearly, and show which numbers are coupled to it and which aren't. Constants are cheap; structure is the answer.

## Say it in 60 seconds

> "Numbers first — they'll tell us where the engineering lives. Uploads: ~500 hours a minute is 30,000 video-minutes a minute; at 100 MB per stored minute that's 3 TB a minute, 4 to 5 petabytes a day logical, about 7 provisioned with erasure coding — call it 2.5 exabytes a year. Watching: ~a billion watch-hours a day is 6 × 10^10 watch-minutes; at 50 MB delivered that's 3 exabytes a day — 30 TB a second average, 100 at peak, 240 terabits a second — which squares with video's famous fifth of the internet. Machines: 30,000 arriving minutes times five renditions at realtime is 150,000 busy cores — about 5,000 boxes, so the upload path is a compute problem. Serving 100 TB a second is 80,000 ten-gig NICs of edge. Money is the fork: 90 exabytes a month at the CDN's $30 a terabyte is $2.7 billion a month — three orders past sane, so at this scale you build delivery, not buy it: caches inside ISPs, peering. Storage is $50 million a month and tierable, because most videos are watched almost never. Metadata is 20k QPS — trivial. The number that runs this design is 100 TB a second of egress: own the edge."

## Numbers to keep

- The two public anchors: ~500 h uploaded/min → 30,000 video-min/min; ~1 B watch-hours/day → 6 × 10^10 watch-min/day
- Stored 100 MB per video-minute (all renditions); delivered 50 MB per watch-minute (one rendition) — independent constants
- Storage: 3 TB/min → 4–5 PB/day logical → ×1.5 erasure-coded ≈ 7 PB/day → ~2.5 EB/year
- Egress: 3 EB/day → 30 TB/s average = 240 Tbps, ~100 TB/s peak — sanity-checked against video's ~15–20% of the internet
- Transcode: ×5 renditions at ~realtime → 150k cores ≈ 5,000 boxes — upload is a compute problem
- Edge: 100 TB/s ÷ 1.25 GB/s = 80,000 ten-gig NICs; metadata 20k QPS — the easy 5%
- Money: 90 EB/month × $30 ≈ $2.7 B/month → past ~$10 M/month, build, don't buy; storage ~$50 M/month, tier it

## Drills

**Drill 14.1** — A "video résumé" platform runs at 1/1000th of this scale: ~0.5 hours uploaded per minute, ~1 M watch-hours/day. Which of this chapter's problems vanish entirely?

<details><summary>Answer</summary>

```
storage:   30 video-min/min × 100 MB = 3 GB/min ≈ 4.3 TB/day × 1.5 ≈ 6.5 TB/day ≈ 2.4 PB/year
egress:    6 × 10^7 watch-min × 50 MB = 3 PB/day ÷ 10^5 s = 30 GB/s average ≈ 240 Gbps
transcode: 30 × 5 = 150 cores ≈ 5 boxes
money:     egress 90 PB/month × $30/TB ≈ $2.7 M/month; storage 2,400 TB × $20 ≈ $50 k/month
```

Vanished outright: the build-vs-buy dilemma (a $2.7 M/month CDN bill is exactly what CDNs are for — buy), the transcode farm (five boxes is a closet), exabyte tiering (lifecycle rules on an object store), the 80,000-NIC edge (the vendor's problem now). What survives is the shape: bytes still dwarf metadata. The so-what: dividing scale by 1,000 didn't shrink the system — it changed its species. Every "build" flipped to "buy," and the engineering moved to the product layer. Scale isn't a dial; it's a phase change.
</details>

**Drill 14.2** — A live cricket final: 50 M concurrent streams at 5 Mbps each. What's the egress, and why is owned edge the only answer?

<details><summary>Answer</summary>

```
per viewer: 5 Mbps ÷ 8         = 0.625 MB/s
egress:     50 M × 0.625 MB/s  ≈ 3 × 10^7 MB/s ≈ 30 TB/s ≈ 250 Tbps — sustained for hours
```

One match generates the platform's entire global *average*, synchronized into one region — and with no ÷10^5 anywhere: live load is concurrency × bitrate, and the day-averaging that tamed VOD does not exist. No commercial CDN holds ~250 Tbps of spare capacity in one geography for one evening. Owned edge survives it almost by design: everyone wants the *same* bytes, so each ISP-embedded cache pulls one copy and fans it out locally — the origin serves thousands of streams, not 50 million. (Calibration: Hotstar has held ~50–60 M concurrent cricket viewers.) The so-what: VOD egress is enormous but diversified; live is the same magnitude synchronized — which is why "is live in scope?" was a scoping question, not small talk.
</details>

**Drill 14.3** — Average video length doubles; uploads per minute halve. What happens to storage?

<details><summary>Answer</summary>

```
video-minutes arriving: (uploads ÷ 2) × (length × 2) = unchanged → 30,000 video-min/min
storage intake:         unchanged — 3 TB/min, ~7 PB/day provisioned
what actually halves:   videos/day → metadata rows, thumbnails — the parts that were already trivial
```

Nothing happens. Storage never billed by "uploads" — it bills in video-minutes, and the product change cancels exactly in that unit. Transcode (tracks minutes) is untouched; egress (tracks *watch*-minutes) was never coupled to the upload mix at all. The so-what: keep every estimate in the unit the dominant cost scales in, and refuse to leave it — half this chapter's trick was choosing the video-minute on rung 2 and staying there.
</details>

---
[← Previous: Chat](13-chat.md) · [Table of contents](../../README.md) · [Next: Photo sharing →](15-photo-sharing.md)
