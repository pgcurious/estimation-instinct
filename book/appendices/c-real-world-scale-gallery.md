# Appendix C — Real-World Scale Gallery

*What actual systems — and crowds, kitchens, and railways — really handle. Calibration points, not canon.*

Every figure here is written with `~` because every figure here is a snapshot: a press release, an engineering blog, a number that was true the year it was reported. They are **not** for memorizing and **not** for citing as design inputs. They are for one job: when your envelope produces a number, you hold it against the largest real example on Earth and ask *"am I in a sane decade?"*

The rule from [Traffic](../part-2-core-estimations/05-traffic.md): the largest synchronized consumer events on the planet produce write peaks around 10^5–10^6 per second. If your envelope for a regional grocery app says 2M writes/s, you haven't discovered a big system — you've dropped an exponent.

---

## 1. Write peaks — the ceilings of human synchronization

The most extreme write rates ever reported are all the same event in different clothes: an entire country pressing the same button at the same moment.

| System / event | Figure | As of | Source |
|---|---|---|---|
| Alibaba, Singles' Day order peak | ~583k orders/s | 2020 | Alibaba press |
| WeChat, New Year red-envelope peak | ~760k envelopes/s | 2017 | Tencent press |
| Visa, engineered global capacity | ~65k TPS | publicized capability | Visa fact sheet |
| Visa, actual daily average | ~700 M txns/day ≈ ~8k TPS | ~2024 | Visa annual report |
| UPI (India), daily volume | ~600 M txns/day ≈ ~7k TPS avg | ~2025 | NPCI monthly data |
| UPI, festival-day peaks | several × the daily average | recurring | NPCI / press |

What it calibrates: a national payment rail *averages* single-digit thousands of TPS; the most synchronized shopping event in history peaked under a million writes/s. Between those two lies essentially every write-heavy system you will ever be asked to design. The [payments walkthrough](../part-3-walkthroughs/20-payments.md) uses exactly this shelf: "my event design point is 50k; Visa engineers for ~65k — right decade."

## 2. Concurrency — the numbers with no "per second" in them

| System / event | Figure | As of | Source |
|---|---|---|---|
| Hotstar, cricket concurrency record | ~59 M concurrent viewers | 2023 World Cup | Disney/JioHotstar press |
| WhatsApp, connections per server | ~2 M+ TCP connections on one box | 2012 | WhatsApp engineering blog |
| Steam, concurrent online users | ~35 M+ concurrent | ~2024 | Steam public stats |

What it calibrates: concurrency is a *stock*, not a rate ([chapter 3's](../part-1-foundations/03-the-numbers-that-matter.md) rates-vs-stocks trap). Hotstar's ~50–60M concurrent is the extreme of the canon's `peak concurrent ≈ 10% of DAU` family — and WhatsApp's 2M-sockets-per-box (heroically tuned Erlang/FreeBSD) is why the canon tells you to *plan* 100k/server and treat anything beyond as earned, not assumed.

## 3. Daily volumes — the big steady rivers

| System | Figure | As of | Source |
|---|---|---|---|
| WhatsApp, messages | ~100 B messages/day ≈ ~1 M/s average | 2020 | Meta press |
| Google Search, queries | ~8.5 B/day ≈ ~100k QPS average | ~2023 | public estimates |
| YouTube, video uploaded | ~500 hours/minute ≈ ~3 PB/day stored with renditions | ~2022 | YouTube press |
| Netflix, share of world downstream traffic | ~15% | ~2023 | Sandvine report |
| Wikipedia (all projects), page views | ~20 B/month ≈ ~8k views/s | ~2024 | Wikimedia stats |

Cross-check the YouTube row yourself — it's the canon working on a real system:

```
500 h/min × 1,440 min/day        = 720k hours/day = ~43 M minutes/day
× ~100 MB/min (all renditions)   ≈ 4 × 10^15 B/day  ≈ a few PB/day stored
```

What it calibrates: "planet-scale" steady traffic is ~10^5–10^6 events/s *average*, and the biggest byte-movers on Earth ingest single-digit petabytes a day. The [video walkthrough](../part-3-walkthroughs/14-video-platform.md) shows what those bytes do to a bill — and why Netflix Open Connect and Google Global Cache exist: at that scale you stop renting delivery and build it.

## 4. Storage corpora — how big "everything" actually is

| Corpus | Figure | As of | Source |
|---|---|---|---|
| English Wikipedia, current article text, compressed | ~25 GB | ~2024 | Wikimedia dumps |
| All Wikipedia edits ever, all languages (text) | ~TB-class, single server | ~2024 | Wikimedia dumps; [drill T4.6](../part-4-instinct/23-drills.md) |
| Library of Congress, digitized print text | ~10s of TB | oft-cited estimate | LoC |
| Common Crawl, one monthly web snapshot | ~100 TB compressed | ~2024 | Common Crawl |
| A bank's 10-year regulatory ledger ([walkthrough 20](../part-3-walkthroughs/20-payments.md)) | ~20 PB raw, ~6 PB archived | derived | this book |

What it calibrates: **text is never the storage problem — media is.** All of human encyclopedic knowledge is a laptop; one day of YouTube is a thousand laptops. When an estimate says "petabytes of text," an exponent has slipped somewhere.

## 5. Machine counts — fewer than you think

| System | Figure | As of | Source |
|---|---|---|---|
| Stack Overflow, web tier | ~9 web servers (at ~1.3 B page views/month) | 2016 | SO engineering blog |
| WhatsApp, total servers | ~550 servers for ~900 M users | 2015 | WhatsApp engineering |
| Instagram at acquisition | ~13 M users, ~12 engineers, AWS-only | 2012 | press |

What it calibrates: the canon's per-box ceilings are conservative, and well-built systems run *close to* the arithmetic this book teaches. When your envelope says 40 servers and your instinct whispers "surely thousands," trust the envelope — the burden of proof sits on the whisper.

## 6. Crowds, kitchens, and railways — the human-scale gallery

The analogies this book leans on are real systems with real throughput. They make the abstract numbers physical — which is, per [chapter 3](../part-1-foundations/03-the-numbers-that-matter.md), how a number becomes instinct.

| Human system | Figure | The systems lesson |
|---|---|---|
| Golden Temple langar, Amritsar | ~100k free meals/day, every day | horizontal scaling: more serving lines, never a bigger pot ([chapter 9](../part-2-core-estimations/09-machines-and-shards.md)) |
| Mumbai dabbawalas | ~200k lunchboxes/day, near-zero misdelivery, no computers | a sharded, hierarchical routing system; reliability from simple invariants, not technology |
| Indian Railways | ~23 M passengers/day | steady planet-scale throughput: ~250 boardings/s averaged, vastly peakier in reality |
| IRCTC Tatkal opening | ~25k+ tickets booked/minute in the first minutes | the event-driven ×10+ peak factor, live, every morning at 10:00 |
| Kumbh Mela, peak bathing day | ~50 M people through one riverbank in a day | ~600 people/s sustained — crowd-flow as capacity planning, with fault domains (sectors, corridors) |
| Shinjuku Station, Tokyo | ~3.5 M passengers/day through one station | what 40 QPS-equivalent of *humans* needs: 200 exits — fan-out at the edge |
| McDonald's, worldwide | ~70 M customers/day ≈ ~800 orders/s global average | a 10^2-scale "global QPS" — most businesses are smaller than your envelope assumes |
| A Delhi wedding caterer ([chapter 4](../part-1-foundations/04-the-ladder.md)) | 2,000 guests → 1,000 thalis/hour → 4 lines, 2 kitchens | the Ladder itself: users → actions → capacity → price, quoted in a minute on the phone |

These rows are deliberately not precise — some are folklore-adjacent (the dabbawalas' fabled error rate has been studied more by admiration than audit). That's acceptable here: they are mnemonic scaffolding, not design inputs. The langar teaches horizontal scaling whether it serves 80k or 120k.

## 7. Using the gallery in the room

One sentence, after your envelope and before your design:

> "My peak lands at ~50k writes/s — for calibration, Visa engineers for about 65k and Singles' Day peaked near 600k, so I'm in a believable decade for a national-scale system."

That sentence does three things: it shows your number comes with a reality check bolted on, it pre-empts the "does that seem high?" challenge, and it tells the interviewer you carry a model of the real world, not just a formula sheet. One calibration per interview is a senior tell; three is a party trick — the [interview script](../part-4-instinct/22-the-interview-script.md) covers the difference.

## Keeping this page honest

Figures here rot fastest of anything in the book. If you arrive with fresher public numbers — a new concurrency record, UPI's latest monthly volume — PRs are welcome: every row needs a figure, a year, and a public source, written with `~`. See the [contribution guide](../../CONTRIBUTING.md).

---
[← Previous: Reference tables](b-reference-tables.md) · [Table of contents](../../README.md)
