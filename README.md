# The Estimation Instinct

**Back-of-the-envelope calculations for system design interviews — from first principles to reflex.**

> "How much storage will this need?" — the question that decides more system design rounds than any diagram.

---

## Why this book exists

There is a strange gap in our industry. You can ship software for ten or fifteen years — lead teams, design services, run production systems — and never once size a system from scratch. Capacity planning happened in another team, or the cloud autoscaled, or the system was already built when you arrived.

Then you sit down for a system design interview, and within ten minutes you're expected to say things like *"that's about 12,000 writes per second, so a single Postgres won't hold — we shard"* — casually, mid-sentence, the way you'd read a clock.

Interviewers call this **back-of-the-envelope estimation**. They are not testing arithmetic. They are testing whether you have *quantitative instinct* — whether numbers drive your design decisions or decorate them.

The good news: this instinct is not talent. It is three learnable things:

1. **~40 anchor numbers** worth memorizing (and no more than that).
2. **One repeatable procedure** — every estimation, for any system, walks the same five rungs.
3. **Repetitions** — the same moves on different systems, until the moves disappear.

This book trains all three. By the end, you will be able to estimate traffic, storage, bandwidth, memory, machine counts, shard counts, latency budgets, and cost — for *any* system an interviewer throws at you — in under five minutes, out loud, with confidence.

## The one idea

Every estimation question is the same question wearing different clothes:

```
USERS      how many people, how active, how peaky?
  ↓
ACTIONS    what do they do, how often?            → traffic (QPS)
  ↓
BYTES      what does each action move or keep?    → storage, bandwidth
  ↓
MACHINES   what hardware does that volume demand? → caches, servers, shards
  ↓
MONEY      what does that hardware cost?          → feasibility, trade-offs
```

We call this **the Ladder**. Part I teaches you to climb it. Part II deepens each rung. Part III climbs it eleven times on real systems until you stop thinking about the rungs. Part IV makes it permanent.

## Table of contents

**Start here:** [How to read this book](book/00-how-to-read-this-book.md)

### Part I — Foundations

| # | Chapter | In one line |
|---|---------|-------------|
| 1 | [The skill that decides the round](book/part-1-foundations/01-the-skill-that-decides-the-round.md) | What interviewers actually grade when you estimate |
| 2 | [The arithmetic of scale](book/part-1-foundations/02-the-arithmetic-of-scale.md) | Powers of ten as a reflex; rounding as a discipline |
| 3 | [The numbers that matter](book/part-1-foundations/03-the-numbers-that-matter.md) | The ~40 anchors worth memorizing, and why each one |
| 4 | [The Ladder](book/part-1-foundations/04-the-ladder.md) | The five-rung method behind every estimation you'll ever do |

### Part II — The core estimations

| # | Chapter | In one line |
|---|---------|-------------|
| 5 | [Traffic](book/part-2-core-estimations/05-traffic.md) | DAU → QPS → peak QPS, read/write splits |
| 6 | [Storage](book/part-2-core-estimations/06-storage.md) | Object sizes, retention, replication, growth |
| 7 | [Bandwidth](book/part-2-core-estimations/07-bandwidth.md) | Ingress, egress, and why egress runs the bill |
| 8 | [Memory & cache](book/part-2-core-estimations/08-memory-and-cache.md) | Working sets, the 80/20 rule, sizing Redis |
| 9 | [Machines & shards](book/part-2-core-estimations/09-machines-and-shards.md) | From QPS to server counts; when and how much to shard |
| 10 | [Latency, availability & cost](book/part-2-core-estimations/10-latency-availability-cost.md) | Latency budgets, the arithmetic of nines, cloud cost reflexes |

### Part III — Walkthroughs (the reps)

Every walkthrough climbs the same Ladder, ends with the estimation **spoken aloud in 60 seconds**, and includes the pushback an interviewer would give you.

| # | System | What it stresses |
|---|--------|------------------|
| 11 | [URL shortener](book/part-3-walkthroughs/11-url-shortener.md) | The classic opener; read-heavy ratios, tiny objects |
| 12 | [News feed](book/part-3-walkthroughs/12-news-feed.md) | Fan-out math, celebrity problem, cache sizing |
| 13 | [Chat (WhatsApp-scale)](book/part-3-walkthroughs/13-chat.md) | Concurrent connections, message throughput |
| 14 | [Video platform](book/part-3-walkthroughs/14-video-platform.md) | The biggest bytes you'll ever estimate |
| 15 | [Photo sharing](book/part-3-walkthroughs/15-photo-sharing.md) | Media variants, CDN offload |
| 16 | [Ride hailing](book/part-3-walkthroughs/16-ride-hailing.md) | Location update streams, geo queries |
| 17 | [Cloud storage (Drive/Dropbox)](book/part-3-walkthroughs/17-cloud-storage.md) | Dedup, sync traffic, cold vs hot data |
| 18 | [Typeahead](book/part-3-walkthroughs/18-typeahead.md) | Requests that multiply per keystroke |
| 19 | [Rate limiter](book/part-3-walkthroughs/19-rate-limiter.md) | Estimating an infrastructure component, not a product |
| 20 | [Payments (UPI/Visa-scale)](book/part-3-walkthroughs/20-payments.md) | Write-heavy, audit trails, zero data loss |
| 21 | [Metrics aggregator](book/part-3-walkthroughs/21-metrics-aggregator.md) | Big-data pipeline: ingestion, rollups, retention |

### Part IV — Making it instinct

| # | Chapter | In one line |
|---|---------|-------------|
| 22 | [The interview script](book/part-4-instinct/22-the-interview-script.md) | When to estimate, what to say, how to survive pushback |
| 23 | [Drills](book/part-4-instinct/23-drills.md) | Graded drills, Fermi curveballs, self-calibration |
| 24 | [The 30-day program](book/part-4-instinct/24-the-30-day-program.md) | Fifteen minutes a day from zero to reflex |

### Appendices

- [A — The cheat sheet](book/appendices/a-cheat-sheet.md) — every number and formula in the book, on one page. **The canon.**
- [B — Reference tables](book/appendices/b-reference-tables.md) — extended latency, size, time, availability and cost tables
- [C — Real-world scale gallery](book/appendices/c-real-world-scale-gallery.md) — what actual systems (and crowds, kitchens, and railways) really handle
- [Anki deck](drills/anki-anchor-numbers.csv) — the anchor numbers as importable flashcards

## How to use this book

- **Interview in 3 days?** Read chapters 2–4, memorize [the cheat sheet](book/appendices/a-cheat-sheet.md), do three walkthroughs (11, 12, 14), read chapter 22.
- **Interview in a month?** Follow [the 30-day program](book/part-4-instinct/24-the-30-day-program.md) — 15 minutes a day, no skipped days.
- **Just want the numbers?** [Appendix A](book/appendices/a-cheat-sheet.md) and the [Anki deck](drills/anki-anchor-numbers.csv).

One rule regardless of path: **say your estimates out loud**. The instinct you're building is verbal. Reading silently builds recognition; speaking builds recall — and the interview tests recall.

## A note on precision

Every number in this book is deliberately rounded and deliberately current-as-of-2026. Hardware gets faster, prices drop, and none of it matters: estimation lives in orders of magnitude, and the *method* is permanent. If a number here is 2× off from your reality, adjust the anchor and keep the reflex.

## Authors

Written in collaboration between **Pradipta Gure** — technical architect with 14+ years across banking, insurance and airline systems — and **Claude** (Anthropic), as a working partnership: the practitioner's gap, questions and judgment; the model's breadth, drafting and synthesis; argued into shape together.

The pedagogy throughout — first-principles derivations anchored by physical, human-scale analogies — reflects a shared belief: **a number becomes instinct only when it becomes physical.**

## Contributing

Numbers drift, hardware improves, and good drills are scarce — corrections and contributions are welcome. Read the [contribution guide](CONTRIBUTING.md) first; this book has a strict internal canon so that every chapter agrees with every other.

## License

[CC BY-NC-SA 4.0](LICENSE.md) — share it, teach from it, translate it, improve it. Just attribute, keep it non-commercial, and share alike.

---

*If this book helped you walk into a system design round and reach for numbers without flinching — star the repo so it finds the next person.*
