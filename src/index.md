# The Estimation Instinct

*Back-of-the-envelope estimation for system design interviews — from first principles to reflex.*

> "How much storage will this need?" — the question that decides more system design rounds than any diagram.

There is a strange gap in our industry. You can ship software for ten or fifteen years — lead teams, design services, run production systems — and never once size a system from scratch. Capacity planning happened in another team, or the cloud autoscaled, or the system was already built when you arrived.

Then you sit down for a system design interview, and within ten minutes you're expected to say things like *"that's about 12,000 writes per second, so a single Postgres won't hold — we shard"* — casually, mid-sentence, the way you'd read a clock.

Interviewers call this **back-of-the-envelope estimation**. They are not testing arithmetic. They are testing whether numbers *drive* your design decisions or *decorate* them.

## This instinct is not talent

It is three learnable things, and this book trains all three:

1. **~40 anchor numbers** worth memorizing — and no more than that.
2. **One repeatable procedure** — every estimation, for any system, walks the same five rungs.
3. **Repetitions** — the same moves on different systems, until the moves disappear.

The reason people freeze on estimation despite "knowing the material" is almost always the same: they trained **recognition** — reading answers until they look right — and then got tested on **recall** — producing a number from nothing, out loud, under mild stress. This book is built to train recall. That is why it asks you, on nearly every page, to *say the number before you read it*.

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

We call it **the Ladder**. Part I teaches you to climb it. Part II deepens each rung. Parts III and V climb it seventeen times on real systems until you stop thinking about the rungs. Part IV — and the interactive **[Practice Arena](32-practice-arena.md)** — make it permanent.

## Choose your path

- **Interview in 3 days?** Read chapters 2–4, memorize the [cheat sheet](a-cheat-sheet.md), do three walkthroughs aloud, read [the interview script](22-the-interview-script.md).
- **Interview in a month?** Follow [the 30-day program](24-the-30-day-program.md) — fifteen minutes a day, no skipped days — and do five [Practice Arena](32-practice-arena.md) reps daily.
- **Want to keep it for life?** [The retention schedule](31-the-retention-schedule.md) turns the reflex into something you never fully lose.
- **Just want the numbers?** [Appendix A](a-cheat-sheet.md) and the [Anki deck](https://github.com/pgcurious/estimation-instinct/blob/main/drills/anki-anchor-numbers.csv).

One rule regardless of path: **say your estimates out loud**. Reading silently builds recognition; speaking builds recall — and the interview tests recall.

---

*Written by [Pradipta Gure](https://github.com/pgcurious), with Claude, as a working partnership. Free to read, teach from, and share under [CC BY-NC-SA 4.0](https://github.com/pgcurious/estimation-instinct/blob/main/LICENSE.md). A number becomes instinct only when it becomes physical.*
