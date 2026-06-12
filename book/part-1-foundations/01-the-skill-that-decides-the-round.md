# 1 — The skill that decides the round

*You can be off by 10× and pass. You can be exactly right and fail. What's being graded is not the number.*

## The question this chapter answers

Around minute eight of a system design round, the interviewer says some version of "let's put rough numbers on this before we design." What you do in the next five minutes shapes their opinion of you more than any diagram you'll draw later — and most candidates prepare for those minutes as if they were an arithmetic quiz.

They are not. This chapter answers the question that should organize your whole preparation: **when you estimate, what is the interviewer actually writing down?**

> ⚡ **Instinct check** — A service handles 1 B requests a day. Average QPS? If ten seconds just passed in silence, you are holding the right book.

The answer is ~10,000 — a day is 10^5 seconds, so divide by 10^5 — and by the end of [The Ladder](04-the-ladder.md) it will leave your mouth in two seconds. But speed isn't the point. *How* a number is produced, out loud, is what gets graded — settle that first, and the arithmetic chapters pay off double.

## From first principles

Derive the grading rubric from the interviewer's constraints — it explains everything candidates find confusing about this part of the round.

After your interview, the interviewer writes a recommendation that has to survive a debrief, where every claim gets challenged by people who weren't in the room. "The candidate's QPS figure was correct" is not a claim they can even make: the system you designed doesn't exist. Nobody knows its true QPS. There is no answer key in the building. The only artifact your forty-five minutes produces is **your audible chain of reasoning** — so the chain is the only thing that can be graded:

- Did assumptions get stated before they were used, or discovered later, broken, inside a conclusion?
- Were the numbers round enough to follow in real time?
- Did each number change what the candidate did next, or just sit there?
- When a number was challenged, did the chain repair itself — or did the candidate defend it, deflect, or unravel?

Four dimensions: **process legibility, comfort with approximation, whether numbers drive decisions, recovery under challenge.** Arithmetic accuracy is not on the list — not because interviewers are generous, but because it's the one dimension they cannot verify.

This is the logic of a driving test. The examiner doesn't grade whether you parked within a centimeter of the curb; they grade mirror, signal, shoulder check — the observable procedure — because procedure predicts the next ten thousand drives, and one parking job predicts nothing. Your estimation chain predicts the next hundred capacity questions you'll face on the job; one lucky QPS figure predicts nothing.

Which gives you this book's core trust argument: **off by 10× but auditable beats exactly right but silent.** Speak the chain and a wrong assumption gets caught at the rung where it happened — "I'd assume two feed opens a day, not ten" — one sentence, cheap, and the round continues with you looking *more* credible for absorbing it. Compute silently and the same error surfaces three rungs later, inside a conclusion the interviewer can't trace; now every number you've said is suspect. The interviewer can only correct what they can hear. Production runs on the same physics: when reality disagrees with a capacity estimate — it always disagrees — the estimate with stated assumptions tells you which assumption broke; the bare number pasted in a Slack thread tells you nothing.

Concretely, the two columns of the scorecard:

| Hire signal — what they hope to write down | Red flag — what they're afraid to write down |
|---|---|
| States each assumption and gets a nod before multiplying | Multiplies in silence, announces a conclusion |
| Round numbers, one significant figure, units on everything | "11,574.07 QPS" — precision theater |
| "Call it a kilobyte" — picks a defensible value and moves | Stalls hunting for the *right* value |
| Numbers steer the design: "so this is a caching problem" | Numbers decorate it: "…anyway, as I was saying" |
| Challenged → re-derives the rung with the new value, cheerfully | Challenged → defends the old number, or collapses |
| Splits reads from writes unprompted | One undifferentiated "QPS" |
| Says "this is small — hardware won't notice" when true | Shards a system one Postgres could hold |

Every entry in the left column is observable behavior. None of them requires the number to be right.

## Where estimation sits in the round

The phase travels under several names — "back-of-the-envelope," "capacity estimation," sometimes just "let's talk scale." In a typical 45-minute round:

| Minutes (~) | What's happening | What it tests |
|---|---|---|
| 0–3 | Introductions, problem statement | — |
| 3–8 | Functional requirements, scoping | Can you cut scope? |
| **8–13** | **Back-of-the-envelope estimation** | **This book** |
| 13–35 | High-level design, then deep dives | Whether your numbers show up here |
| 35–45 | Bottlenecks, pushback, wrap-up | Recovery under challenge |

Two warnings about that tidy map.

First, **the five minutes are a budget, not a target.** Estimating for twelve minutes is its own red flag — it says you can't tell which numbers matter. [The interview script](../part-4-instinct/22-the-interview-script.md) covers the room-craft of entering and exiting the phase cleanly.

Second, and more important: **estimation is not actually a phase.** Plenty of interviewers skip the slot ("assume large scale, let's design") and then probe mid-design — "Will this fit in memory?" "What happens to this queue during a ten-minute outage?" "What does fan-out cost when a celebrity posts?" These are estimation questions fired at minute 27 with no warning, and they are often the real test: the scheduled phase can be rehearsed, the ambush can't. The instinct has to be on-call for all forty-five minutes, not performed once at minute eight.

> 🎯 **In the room** — "Let's skip the math" means deferred, never waived. Interviewers who wave off the phase still notice whether your design sentences contain numbers. "Shard by user ID" is an opinion; "at ~12 k writes/s we're an order of magnitude past the ~1 k a single Postgres sustains, so shard by user ID" is engineering. Drop one load-bearing number into each major design choice and you're doing estimation invisibly, the whole round.

## Why ten years of shipping didn't build this

If you have a decade of experience and the instinct check above met silence, nothing is wrong with you. The freeze has a boring, structural explanation — modern careers are engineered to remove this exact skill:

- **The systems were already sized when you arrived.** You extended them, hardened them, debugged them. The load-bearing multiplication happened years before your first commit.
- **Autoscaling absorbed the rest.** The cloud's entire pitch is that capacity is someone else's arithmetic, performed before you ever see a dashboard.
- **Capacity planning lived elsewhere** — an SRE org, a capacity team, a finance-facing spreadsheet you never had reason to open.

So you can lead teams and run production systems for fifteen years and accumulate, honestly, zero reps of sizing a system from a blank page out loud. A Mumbai commuter can ride the local trains for twenty years and never learn to drive — not a deficiency, just a life that never demanded it. Then the new city has no trains, and the driving test is Tuesday. Learning the skill at that point isn't remedial. It's new terrain — and unusually small terrain:

```
instinct = ~40 anchor numbers + 1 procedure + reps
```

That's the book's thesis, and the next three chapters cash it out. The anchors are [chapter 3](03-the-numbers-that-matter.md) and fit on [one page](../appendices/a-cheat-sheet.md). The procedure is [the Ladder](04-the-ladder.md) — users → actions → bytes → machines → money, the same five rungs for every system anyone has ever been asked to design. The reps are Part III plus [fifteen minutes a day](../part-4-instinct/24-the-30-day-program.md). There is no fourth ingredient, and none of the three is talent.

## 🧮 Worked example — the same estimate, twice

The interviewer says: *"Design a photo feed. Say 100 million DAU. Walk me through the scale."* Two candidates, the same arithmetic, opposite grades.

**Candidate A:**

> "Okay, a hundred million users… so requests would be… *(long pause, eyes down)* …people open it a lot, so maybe a billion-ish requests? Divided by 86,400 seconds… *(forty silent seconds)* …roughly 11,574 QPS. Though honestly it could be more, or less — hard to say without production data. Anyway — for the design I'm thinking microservices: a feed service, a media service…"

**Candidate B:**

> "Before drawing boxes, let me put rough numbers on this — they'll tell us where the hard part is. Assume each of the 100 M DAU opens the feed ~10 times a day — fair? That's 1 B reads a day, and a day is 10^5 seconds, so ~10 k QPS average; I'll take ×3 for peak — call it 30 k. Feeds run about 100-to-1 read-to-write, so writes are only ~100 a second. Reads are the whole game: this is a caching problem, not a database problem, and I'd like to spend our depth on the cache and CDN. Sound right?"

Same inputs, same order of magnitude out. Now read them the way the interviewer does:

- **A's "billion-ish" was never ratified.** If real users open the feed twice a day, not ten times, A's entire round is built on a silent 5× error that nobody can locate. B's "— fair?" cost one second and bought a checkpoint.
- **11,574 versus 10 k.** Five significant figures announces *I think this is an arithmetic test*. One announces *I know this is an approximation and I know what it's for*. (Dividing by 10^5 instead of 86,400 under-counts by ~15%; the peak factor swallows it. B knows that — so will you, by [chapter 2](02-the-arithmetic-of-scale.md).)
- **A never found peak.** Averages don't crash systems; the 9 PM spike does. B's ×3 is one word.
- **A's number terminates.** "Anyway" is the saddest word in estimation — the number changed nothing, so it was decoration. B's number *chose the next twenty minutes* of the interview (the cache deep-dive). That is the so-what, and it is the single highest-value habit this book trains.
- **B split reads from writes,** so the bottleneck has a name before the design starts.

Also notice: B's version is *faster*. Spoken at interview pace it runs about forty seconds. Legible isn't slower — silence is slower.

## ⚠️ Traps

- **Preparing for the wrong test.** Drilling mental arithmetic to get closer to exact optimizes the one variable nobody grades. Train narration, ruthless rounding, and so-whats — the things on the scorecard.
- **Treating estimation as a phase.** If the instinct switches off at minute 13, the minute-27 ambush finds you unarmed. It's a posture, not a checkpoint.
- **Defending a challenged number.** "I'm fairly confident in that" is the worst available sentence. A challenge is an invitation to re-walk the rung out loud with the interviewer's value — and recovery is graded above the original answer, because it's rarer.
- **Hedging instead of assuming.** "Maybe, possibly, around, I'd guess" — a fog no one can correct. One stated assumption beats three hedges: pick a value, offer it for ratification, move.
- **Estimating to impress.** Climbing every rung on autopilot when nothing downstream depends on it. An estimate that doesn't change a decision is decoration — the rule that closes [chapter 4](04-the-ladder.md) starts here.

## Numbers to keep

- Estimation owns ~5 minutes (≈ minutes 8–13 of 45) — but it is graded for all 45
- The scorecard: legible process, easy approximation, numbers that drive decisions, graceful recovery
- **Off by 10× but auditable beats exactly right but silent** — the interviewer can only correct what they can hear
- Accuracy is the one dimension they can't verify; process is the only one they can
- 1 B actions/day ≈ 10 k QPS — the first reflex this book installs
- Instinct = ~40 anchors + 1 procedure + reps; there is no fourth ingredient
- A number followed by "anyway" was decoration

## Drills

No heavy math yet — these drills train your ear. Answer out loud before expanding anything.

**Drill 1.1** — Spot the three estimation mistakes in this transcript:

> "For storage — posts are small, maybe a kilobyte, I'd guess, possibly less. We're getting 50 million a day, so a year is 50 M × 1 KB × 365 = 18.25 TB. So, 18.25 TB. Okay, moving on to the API — I'd go with REST…"

<details><summary>Answer</summary>

1. **The 50 M/day appeared from nowhere** — never proposed, never ratified. If it's wrong, every downstream number is wrong invisibly.
2. **18.25 TB is precision theater on logical bytes.** Round it, then provision it:

```
50 M/day × 1 KB × 365 days      ≈ 20 TB/year logical
× 5 (replication + overhead)    ≈ 100 TB/year provisioned
```

3. **The number led nowhere.** "Moving on" skipped the payoff: at a practical ceiling of a few TB per SQL node, ~100 TB/year forces a sharding conversation in year one. The candidate computed the evidence and walked past the verdict. (The hedge-stack — "maybe… I'd guess… possibly" — is a free fourth.)

So-what: handled honestly, this number wasn't trivia — it was the design's first fork, and he drove straight through it.
</details>

**Drill 1.2** — A candidate scribbles this for a single-country food-delivery app and says none of it aloud:

```
5 M × 40 = 200 M
200 M / 86,400 ≈ 2,315
× 3 ≈ 7,000
```

Rewrite it as you would *say* it: state, compute, interpret.

<details><summary>Answer</summary>

> "Assume 5 M DAU, each touching the app ~40 times a day across browsing, ordering, and tracking — fair? That's 200 M calls a day, and a day is 10^5 seconds, so ~2 k QPS average. This is single-country traffic compressed into mealtimes, so ×5 rather than ×3 — call it 10 k QPS peak. At ~1 k QPS per server for typical logic, sized to 60% utilization: 10 k ÷ 1 k ÷ 0.6 ≈ 17 — call it ~20 servers. A modest tier; traffic is not this system's hard part."

Notice what surfaced only because it was spoken: the ×3 became ×5 the moment "single-country, mealtime spikes" was said out loud. A stated assumption corrected itself.

So-what: narrating the chain doesn't just let the interviewer fix your numbers — it lets *you* fix them.
</details>

**Drill 1.3** — The interviewer waved off estimation at minute 10 ("assume it's big"). At minute 25, mid-design, they ask: "Would the user table fit in memory?" You know there are ~200 M registered users at ~1 KB per profile row. Say your next twenty seconds.

<details><summary>Answer</summary>

> "200 M users × 1 KB ≈ 200 GB — bigger than the 128 GB of RAM on a commodity box, so the whole table, no. But hot users dominate: 20% of objects take ~80% of reads, and 20% of 200 GB is ~40 GB — that fits in one box with headroom. So: full table in Postgres, hot set in a cache, no exotic in-memory store needed."

Twenty seconds, three anchor numbers (1 KB row, 128 GB box, 80/20), and the question is answered *and* designed.

So-what: "skip the math" was never a waiver — the ambush was the real estimation round, and it was a design fork dressed as arithmetic.
</details>

---
[← Previous: How to read this book](../00-how-to-read-this-book.md) · [Table of contents](../../README.md) · [Next: The arithmetic of scale →](02-the-arithmetic-of-scale.md)
