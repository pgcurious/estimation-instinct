# 22 — The interview script

*Twenty-one chapters trained the arithmetic. This one choreographs it for the forty-five minutes where it counts.*

## The question this chapter answers

You can walk the Ladder half-asleep now — Part III made sure of that. The room adds three things the practice reps didn't: a clock, a live counterparty, and the obligation to think while speaking. So the questions left are stagecraft questions. When exactly do I start estimating? What do I literally say? Where do the numbers live on the board? And what do I do when one gets challenged — or when I get one wrong?

This chapter is the cheat sheet's [60-second skeleton](../appendices/a-cheat-sheet.md) expanded into full room-craft: a minute-map, an opening move, a phrase bank, a pushback playbook, and a recovery procedure.

## From first principles

Why should a *script* help at all? Because of what [chapter 1](../part-1-foundations/01-the-skill-that-decides-the-round.md) derived: the interviewer can only grade observable process — legibility, comfort with approximation, numbers that drive decisions, recovery under challenge. Observable process is behavior, and behavior can be rehearsed. This is not actor-memorization; it's a pilot's checklist. Pilots don't use checklists because they can't fly — they use them so that the routine consumes zero working memory and all of it goes to the actual emergency. Every line you've pre-decided is attention freed for the system you're designing.

The posture to rehearse is an expert witness under cross-examination. The witness who survives cross isn't the one with the boldest numbers — it's the one who calmly shows the methodology, gives ranges where ranges are honest, and corrects an error without flinching. Juries convict confidence-without-method. So do debriefs.

## The minute-map

A typical 45-minute round, with your estimation duty in each phase:

| Minutes (~) | Phase | Your estimation duty |
|---|---|---|
| 0–8 | Requirements & scoping | Collect the inputs. Every scoping question — retention? media? global? — is a future multiplier. Write them down as you get them. |
| **8–13** | **Estimation** | **Your initiative.** The full Ladder, out loud, ending with the worry line. Five minutes is a budget, not a target — twelve minutes of arithmetic says you can't tell which numbers matter. |
| 13–25 | High-level design | Every major box gets one load-bearing number: "cache, because 6 k peak reads against a 5 k SQL ceiling." |
| 25–40 | Deep dives | The ambush zone. "Will this fit in memory?" arrives here, unannounced. Answer in twenty seconds from numbers already on the board. |
| 40–45 | Wrap, bottlenecks | The 10× question lives here. The answer is which rung breaks first, not a fresh spreadsheet. |

The map shows phases; don't let it fool you about the skill. **Estimation is on-call for all forty-five minutes** — minute 8 is merely where you take the initiative instead of waiting for a question. "Will this fit in memory?" at minute 31 is still an estimation question, and it's often the real one, because the scheduled phase can be rehearsed and the ambush can't.

> ⚡ **Instinct check** — Minute 31, mid-dive: "Would the session store fit in memory?" You hold 50 M concurrent sessions at ~1 KB each. Say the answer out loud before reading on. (50 GB — inside one 128 GB box, with headroom. Ten seconds, from two anchors.)

## The opening move — get the nod

Every estimation starts the same way, with one question:

> "Do you have a scale in mind, or shall I assume something reasonable?"

Half the time they hand you a number — now it's *their* number, and every rung you build on it is co-signed. The other half they say "whatever's reasonable," and you propose one **loudly**: "Say 10 million DAU — reasonable?" Wait for the nod. Then, and only then, multiply.

Never multiply from a base the interviewer hasn't blessed. [Chapter 4's](../part-1-foundations/04-the-ladder.md) argument, in one line: a wrong blessed base costs nothing — one sentence fixes it at the rung where it happened — while a wrong silent base costs trust, the only currency the round trades in.

## Board craft

Numbers need a home, or they die where they were spoken.

- **Keep a numbers corner** — top-right of the whiteboard, or a pinned table at the top of the shared doc. Every settled figure moves there: DAU, peak QPS, storage/year, shard count. At minute 31 you answer ambushes by *pointing*.
- **Write the assumption above the arithmetic**, never below, never not at all:

```
assume: 10 M DAU × 20 searches/day        ← the line they can challenge
200 M reads/day ÷ 10^5 s = 2 k QPS avg
× 3 peak                 ≈ 6 k QPS
```

- **Units on every line.** A bare "200" mid-design is a bug you'll ship to yourself twenty minutes later.
- **Never erase an estimate.** You will need it at minute 31, and erasing reads as hiding. If a number changes, strike it through and write the new one beside it — a visible correction is evidence of process, which is the thing being graded.

## The phrase bank

Other chapters contribute numbers; this one contributes lines. These are tested, boring, and they work — say them as written until your own versions emerge.

| Moment | The line |
|---|---|
| Entering the phase | "Let me put rough numbers on this before we draw boxes — it'll tell us where the hard parts are." |
| Getting the base | "Do you have a scale in mind, or shall I assume something reasonable?" |
| Ratifying the base | "Say 10 million DAU — reasonable?" |
| Rounding out loud | "I'll take a day as 10^5 seconds — under-counts ~15%, the peak factor swallows it." |
| Peak | "Global consumer app — peak at 3× average. Single-region, I'd say 5×." |
| Splitting traffic | "Reads and writes live different lives here — let me split them before going on." |
| Picking a size | "Call it a kilobyte; I'll refine it only if a decision turns on it." |
| Interpreting | "That's inside one node's ceiling, so no sharding yet." |
| Flagging dominance | "Egress dominates everything else here — that number runs the design." |
| Deferring a rung | "Cost only matters here if we're egress-heavy — I'll check that at the end." |
| Exiting the phase | "The number that worries me is X, so the design should Y." |
| Checkpointing a poker face | "Comfortable with these as working numbers?" |
| Taking a correction | "Good — taking your number and walking it down the ladder to see what changes." |
| Recovering | "Hold on — that's off by 10³. Let me redo it from the bytes rung." |
| The minute-31 ambush | "Quick number first: 200 M rows × 1 KB ≈ 200 GB — bigger than RAM, so no." |

## The pushback playbook

Interviewers challenge numbers on purpose — recovery under challenge is a quarter of the rubric, and they can't grade what they never trigger. Five challenge types cover nearly everything you'll face.

**1. "That number seems off — by 10×."** Don't defend it; re-derive it from the nearest anchor, out loud. If they're right, propagate the fix *down* the ladder and show which decisions survive: "Let me re-derive rather than argue. 30 M writes/day × 1 KB is 30 GB/day — if it's 300 GB, storage crosses a node ceiling this year instead of year three, so sharding moves up. The read path and the cache don't move." Often every decision survives — and that robustness is the flex. A design that shrugs off a 10× swing was built right.

**2. "Where did that come from?"** Cite the anchor and its physical why — [chapter 3's](../part-1-foundations/03-the-numbers-that-matter.md) training pays out here. "From the ~1 KB row anchor: a few hundred bytes of fields, plus index and row overhead, rounds to a kilobyte." An anchor with a reason sounds like knowledge; a number alone sounds like a guess.

**3. "Make it 10× bigger."** They are not asking for new totals — anyone can multiply by ten. They're asking **which rung breaks first**. Walk it: "Traffic stays inside a bigger stateless tier — that's money, not architecture. Writes cross the single-primary 1 k TPS ceiling at about 4× — that's the break: at 10× we shard, and we shard on the write path."

**4. "Are you sure?"** Never answer this with confidence; answer it with calibration. "Between 50 and 200 TB; I'd plan for 200. The design is the same anywhere in that range — which is why I'm comfortable." A range with a planning posture beats certainty, because certainty about an estimate is a contradiction.

**5. The poker face.** No nods, no reactions, just writing. Don't fish for approval — every "right? …right?" spends credibility. Checkpoint once — "comfortable with these as working numbers?" — and proceed on the nod or the silence alike. Silence is a style, not a verdict.

## Recovering from a real mistake

You will, at some point, drop a factor of 1,000 in front of someone deciding your level. The procedure is three steps:

1. **Own it in five words.** "That's wrong — factor of 1,000." No preamble, no blush.
2. **Fix forward from the wrong rung** — not from scratch. The ladder above the error is still good; re-walking it wastes a minute and looks like panic.
3. **Re-land the so-what.** The corrected number usually changes a decision. Say the new decision — that's what closes the wound.

In dialogue, on a metrics pipeline ([chapter 21's](../part-3-walkthroughs/21-metrics-aggregator.md) territory):

**You:** "1 M events a second at ~100 B each is 100 KB/s of ingest, so bandwidth is — hold on. That's wrong — factor of 1,000. 10^6 × 10^2 is 10^8 B/s: 100 **MB**/s. And that changes the conclusion: 100 MB/s is a full Kafka broker's ceiling on day one, so ingest needs a small broker cluster and partitioning from the start — it's not the afterthought I was about to make it."

**Interviewer:** "Good catch."

Ten seconds, and the error *produced* the design insight. The meta-point: interviewers watch candidates slip constantly — slips are Tuesday. What they grade is the recovery, and a clean recovery is worth more than an error-free run that wobbles under the first question, because recovery is the rarer behavior and the one production actually demands.

> 🎯 **In the room** — After a correction, resist the urge to apologize twice or re-verify the whole board. One fix, one so-what, move. Lingering on an error converts a ten-second event into a five-minute impression.

## 🧮 The same room, twice — hotel-booking platform

[Chapter 1](../part-1-foundations/01-the-skill-that-decides-the-round.md) showed two candidates for forty seconds. Here is the full version, at room length, on a system none of Part III's eleven walkthroughs touched. Same arithmetic in both rooms; watch what everything *around* the arithmetic does.

### The good room

**Interviewer:** "Design a hotel-booking platform — think Booking.com. Where would you like to start?"

**You:** "Two scoping questions, then numbers. Search and book only — payments and reviews out of scope? And do you have a scale in mind, or shall I assume something reasonable?"

**Interviewer:** "Search and book is fine. Assume something reasonable."

*[→ noted: asked for the base instead of inventing one — everything that follows is auditable]*

**You:** "Then say 10 million DAU browsing across 2 million bookable properties — big, not quite Booking-big. Comfortable with those as the base?"

**Interviewer:** "Works."

*[→ noted: the base is blessed; a correction here would have cost one sentence]*

**You:** "Let me put rough numbers on this before we draw boxes — it'll tell us where the hard parts are. Travel is browse-heavy: assume each active does ~20 searches and property views a day. 10 M × 20 is 200 M reads a day; a day is 10^5 seconds, so 2 k QPS average — global app, peak ×3, call it 6 k. Bookings: say 1 active in 10 books on a given day — 1 M bookings a day, which is 10 writes a second, 30 at peak. So roughly 200-to-1 read-to-write — even more lopsided than the canon's 100-to-1 for content systems."

*[→ noted: state, compute, interpret — assumption first, round arithmetic, ratio named before leaving the rung]*

**Interviewer:** "Okay."

**You:** "Bytes next — I suspect they're small, but I want it on the board. A booking is a record: call it a kilobyte. 1 M a day × 1 KB = 1 GB a day logical, ×5 for replication and overhead is 5 GB a day — about 2 TB a year provisioned. One SQL primary holds years of bookings. The catalog: 2 M properties × 1 KB = 2 GB. Even a full year of availability — 2 M properties × 365 days at ~10 bytes a cell — is ~7 GB. The entire searchable universe fits in one box's RAM with room to spare."

*[→ noted: units on every line; every result interpreted against a node ceiling, none left hanging]*

**Interviewer:** *(writes; says nothing)*

**You:** "Comfortable with these as working numbers? Then here's the so-what: nothing here stresses hardware. 6 k peak search QPS is ten typical servers; the hot data fits in memory; 30 writes a second against a 1,000-TPS ceiling is nothing. The number that worries me is actually a small one — those 30 bookings a second concentrate on the same few hot properties on peak nights, and two people will grab the last room. So the design should spend its depth on the booking transaction — inventory correctness under contention — not on sharding. Want me to design that path?"

*[→ noted: one checkpoint at the poker face, then proceeded; the worry line just chose the deep dive]*

**Interviewer:** "Before that — your 20 searches a day. Where did that come from?"

**You:** "Session behavior: planning a trip is a few sessions of five-to-ten result pages each, and only a fraction of actives are mid-planning on any given day — that nets out around 20 touches across the base. Could be 10, could be 40; either way it's 1–4 k QPS average, same order of magnitude, and the read path keeps its shape. If you have a real figure, I'll take it."

*[→ noted: cited the reasoning, gave a calibrated range, showed the conclusion survives the swing — zero defensiveness]*

**Interviewer:** "Make it Diwali week — searches triple, bookings spike 10×."

**You:** "Walking the ladder down. Searches: 18 k peak — the stateless tier goes from ten boxes to thirty; that's money, not architecture. Bookings: 10× on 10 a second is 100 a second — still a tenth of one primary's write ceiling, so the database survives. What breaks first isn't on the capacity ladder at all — it's the contention I flagged: ten times the people fighting for the same hot rooms. The bottleneck is the per-property write conflict, and the fix is design — serialize per property, queue the attempts — not provisioning."

*[→ noted: named which rung breaks first instead of reciting new totals — the 10× question answered as a bottleneck question]*

### The bad room

Same prompt. Same system. Watch the same arithmetic fail.

**Interviewer:** "Design a hotel-booking platform — think Booking.com. Where would you like to start?"

**You:** "Let me work out the scale. *(forty seconds of silent typing)* Okay — traffic comes to about 2,314 QPS, peaking around 6,944."

*[→ missed: the 10 M DAU and 20 searches/day exist only in the candidate's head — the first audible numbers are conclusions, so nothing can be corrected]*
*[→ missed: 2,314 is precision theater — five significant figures announce that 86,400 got memorized and the point got missed]*

**Interviewer:** "Where is that coming from?"

**You:** "Standard assumptions — DAU times sessions. It's pretty typical for travel platforms."

*[→ missed: challenged, cites authority instead of an anchor; "typical" cannot be cross-examined, which is exactly why it sounds like a guess]*

**Interviewer:** "Hm. What about storage?"

**You:** "Bookings come to 365 GB a year, so storage is fine. For the design I'd shard by hotel ID and use Cassandra for the bookings table, for write scalability."

*[→ missed: logical bytes, no ×5, no interpretation — and then a design that ignores its own numbers: 10 writes a second just got a distributed LSM store]*

**Interviewer:** "Do you need to shard at ten writes a second?"

**You:** "It's the standard approach at this scale. I'm fairly confident in the throughput numbers."

*[→ missed: defends instead of re-deriving — "fairly confident" is the worst sentence available; the interviewer offered a repair and got a wall]*

**Interviewer:** "Okay. Let's move to the design."

*[→ same arithmetic as the good room — 2 k average, 6 k peak, ~1 GB a day — and the debrief will say "couldn't justify numbers, over-engineered against own data"]*

The pair is the lesson: the numbers were never the product. The good room sold a *process* — blessed base, audible chain, interpreted results, graceful pushback — and the numbers were merely the receipts.

## When not to estimate

Three situations, and the script for each.

**The interviewer says skip it.** "Assume it's big — let's design." Believe them; launching into the Ladder anyway reads as a rehearsed bit you refuse to cut. But "skip" means deferred, never waived — drop one quantitative observation into the design later: "since we said ~10 k QPS earlier, a single cache tier covers this." One load-bearing number, mid-sentence, does more than the five-minute version they declined.

**Pure-depth rounds.** Some rounds are about consensus, transaction isolation, exactly-once delivery. Unprompted estimation there reads as stalling — the interviewer wants invariants, not QPS. Keep the instinct on-call for a genuine capacity fork ("does the log fit on one disk?"), and otherwise leave the calculator holstered.

**Estimating to avoid designing.** The failure mode nobody warns you about: arithmetic feels safe — it has right answers — so under stress, some candidates burrow into it, re-deriving storage to the third rung of precision while the design clock burns. Interviewers smell it within a minute. Estimation is the appetizer; if minute 16 arrives and there are no boxes on the board, you are hiding, and the numbers — however clean — are testifying against you.

## The remote round

Three adjustments for the call, none optional:

- **A shared doc beats a whiteboard for numbers.** Keep the numbers corner as a pinned table at the top; it scrolls with you into every deep dive.
- **Say the arithmetic while you type it.** The doc shows results; the *chain* has to be audible, or you've gone silent in the one medium where silence is loudest.
- **Silence feels 3× longer on a call.** Forty quiet seconds in a room is thinking; on a call it's a dropped connection. Narrate the pause itself: "multiplying out the storage — one second."

## ⚠️ Traps

- **The twelve-minute estimation.** The phase budget is ~5 minutes. Past that, you're not being thorough — you're demonstrating that you can't tell load-bearing numbers from decoration.
- **Erasing your tracks.** Wiping the numbers corner to make room for boxes deletes your own evidence, then forces a from-scratch re-derivation at minute 31. Strike through, never erase.
- **Fishing.** Glancing up after every line for approval. One checkpoint per phase; confidence between checkpoints.
- **Negotiating the correction.** When the interviewer offers a better number, take it and walk it down the ladder — gratitude plus propagation. "Well, it depends" in response to a gift is how rounds end early.

## Numbers to keep

- The map: requirements 0–8, estimation 8–13, design 13–25, deep dives 25–40, wrap 40–45 — and estimation on-call for all 45
- Never multiply from an unblessed base — the nod costs one second
- Assumption above the arithmetic, units on every line, strike through but never erase
- Five challenges, five moves: re-derive, cite the anchor, name what breaks first, give the range, checkpoint once
- Recovery: own it in five words, fix forward from the wrong rung, re-land the so-what
- A clean recovery outranks a clean run that wobbles under the first question
- Estimation is the appetizer — if minute 16 has no boxes on the board, you're hiding in it

## Drills

These drills train the mouth, not the math. Say every answer out loud before expanding.

**Drill 22.1** — Rewrite each silent-assumption line into state-compute-interpret form, as you would say it: (a) "QPS comes to about 23,000." (b) "Storage is maybe 50 TB a year." (c) "We'll need a Redis cluster."

<details><summary>Answer</summary>

(a) "Assume 200 M DAU, each touching the service ~10 times a day — fair? That's 2 B actions a day, over 10^5 seconds: 20 k QPS average, ×3 peak ≈ 60 k. Trivial reads, so a stateless tier of ten boxes covers it."

(b) "Records are ~1 KB at 30 M a day — 30 GB a day logical, ~10 TB a year, ×5 provisioned ≈ 50 TB. That crosses the few-TB-per-node line in year one, so we shard by then or shorten retention."

(c) "Daily reads are 500 M at ~1 KB — 500 GB a day; the hot 20% is ~100 GB, which fits one 128 GB box snugly. One Redis node plus a replica — a cluster when growth says so, not before."

So-what: each rewrite added one assumption, one unit-carrying chain, and one decision. That's the entire difference between a number the interviewer can grade and one they can only doubt.
</details>

**Drill 22.2** — You said the dataset is ~100 GB. The interviewer: "I think it's closer to 10 TB." Script your next thirty seconds.

<details><summary>Answer</summary>

> "Let me re-derive rather than defend it. I had 100 M records at ~1 KB — that's where 100 GB came from. For 10 TB, either it's 10 B records or rows are ~100 KB — and if rows carry documents or full history, 100 KB is plausible. Let's take your 10 TB. Walking it down: ×5 is 50 TB provisioned — that's ~25 shards by the 2-TB rule, so sharding moves from 'someday' to day one, and the hot 20% becomes ~2 TB — a cache cluster, not a cache box. The read path keeps its shape; the residency decisions flip. Good correction — that one number redraws the storage tier."

So-what: no defense, re-derivation from the anchor, the fix propagated down the ladder, and a named list of what flips versus what survives. The correction became a demonstration.
</details>

**Drill 22.3** — Minute 30, the hotel-booking design from this chapter is on the board. Interviewer: "Triple the DAU." Script the walk down the ladder, naming what breaks first.

<details><summary>Answer</summary>

> "30 M DAU. Searches: 600 M a day — 6 k average, 18 k peak; the search tier goes from ten boxes to thirty. Money, not architecture. Bookings: 3 M a day — 30 writes a second, ~90 peak; still under a tenth of one primary's ceiling. Storage: 3 GB a day logical, 15 provisioned — ~5–6 TB a year, which crosses the ~2 TB node line in about four months. So the first structural break is data residence on the bookings store, not throughput anywhere — and it breaks on a calendar, not a pager. I'd partition bookings by month now, and the hot-property contention I flagged earlier gets 3× worse, which strengthens the case for the per-property serialization we designed."

So-what: the tripling broke a *storage* rung even though every QPS number stayed comfortable — which is exactly why the answer to "make it bigger" is naming the first break, not reciting new totals.
</details>

---
[← Previous: Metrics aggregator](../part-3-walkthroughs/21-metrics-aggregator.md) · [Table of contents](../../README.md) · [Next: Drills →](23-drills.md)
