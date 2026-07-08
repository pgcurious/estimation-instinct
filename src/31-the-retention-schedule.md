# 31 — The retention schedule

*The thirty-day program builds the reflex. This chapter is the reason you still have it a year later — and the morning it finally counts.*

## The problem this chapter solves

The 30-day program is a construction schedule. Nothing this book has done survives on its own: a reflex is a physical trace in a brain, and every trace fades unless it is used. That is not a motivational flourish, it is the whole engineering problem. You will build the instinct in thirty days, pass a round, take the job — and then spend two or three years never sizing a system from scratch, because capacity planning happened in another team or the cloud autoscaled. The reflex decays precisely in the gap where you stop reaching for it. Then a recruiter calls.

*How to read this book* drew the line this chapter runs on: reading builds recognition, speaking builds recall, and the interview — like the architecture review where someone asks "will this fit in memory?" — tests recall. The 30-day program converts recognition into recall. This chapter keeps recall from sliding back into recognition. The good news is the cost:

```
weekly    ≈ 10 min × ~50 wk ≈ 500 min ≈ 8 h/yr
monthly   ≈ 15 min × 12     ≈ 180 min ≈ 3 h/yr
quarterly ≈ 15 min × 4      ≈  60 min ≈ 1 h/yr
                                      ─────────
full maintenance schedule            ≈ 12 h/yr
```

Twelve hours a year holds what thirty days built — cheaper than the flight to the onsite, if you spend them on the right twelve. The rest of the chapter is which twelve hours, and why they beat eighty spent wrong.

## Why speaking beats reading — the testing effect

Take the storage formula. You can reload it two ways: read the line `storage = rate × size × retention × 5` off the cheat sheet, or produce it from nothing with your mouth shut on the page and your voice open in the room. These feel almost identical. They are not the same act, and the difference is the entire chapter.

Re-reading strengthens *recognition* — the warm "yes, that's right" when the correct answer is already in front of your eyes. It does almost nothing for retrieval, because you never retrieved: the answer was supplied. Producing the formula from an empty page is a different operation. The brain has to reconstruct the trace under its own power, and that act of reconstruction — not the correctness of the result — is what thickens the trace for next time. A test is not a measurement of learning; the test *is* the learning. This is why the book's every drill collapses its answer: the collapse exists to force one retrieval before the supply arrives.

Speaking is the retrieval that sticks, for two physical reasons. It forbids the silent slide from recognition to "I basically know this" — a number either leaves your mouth or it doesn't, there is no half-credit. And it rehearses the exact channel the interview uses: verbal production, in real time, under a witness's gaze. That is the whole force of the speak-aloud rule. Silent reading trains a muscle you will never perform with.

> ⚡ **Instinct check** — When did you last *say* a storage estimate out loud, versus read one? If it has been a month of reading and nodding, your recognition feels intact while your recall has quietly rotted — and only one of the two gets tested.

## The forgetting curve and why spacing works

A retrieved memory does not stay retrieved. It fades along a curve, steep at first, then flattening. Each successful retrieval resets and flattens that curve — the next fade takes longer to arrive. So the maintenance question is purely one of timing: *when* do you schedule the next retrieval?

The counterintuitive answer is the load-bearing idea of this chapter. A recall performed just as the trace begins to fade strengthens it more than one performed while it is still fresh. The effort of the retrieval is the training stimulus; retrieve too soon, while the answer is still sitting on the surface of your mind, and there is no effort, so there is no gain. Spacing beats massing not despite the difficulty but because of it. Cognitive science calls it *desirable difficulty*. A dryland farmer calls it Tuesday.

Ask the millet growers of the Deccan, or the olive keepers of the Levant, why they don't water every morning. Water daily and the roots stay near the surface — fat, shallow, lazy, and the first dry week kills the plant. Let the topsoil bake between soakings and the thirsty root drives *downward*, hunting the moisture that has retreated just out of reach. The plant made to reach grows the deeper root. A memory watered every day stays shallow; a memory watered just as it goes dry sends its root down. Massing waters daily. Spacing makes the memory hunt. The whole retention schedule is deficit irrigation for anchors.

```
recall 1  -> next gap ~2 d
recall 2  -> next gap ~4 d       # each clean pull roughly doubles the gap
recall 3  -> next gap ~9 d       # the curve is flatter, the fade further out
lapse     -> gap collapses to ~1 d   # blank once and the root springs back up
```

The gap doubles because the curve you just flattened takes about twice as long to fade again — the expanding interval is the forgetting curve read backwards. Applied to the cheat-sheet anchors and to performing whole walkthroughs, the schedule is a small table of widening gaps:

| Retrieval | Gap since last | Lands on (day) | What you retrieve |
|---|---|---|---|
| 1st | — | 1 | fresh from the 30-day build |
| 2nd | 2 d | 3 | anchor / one full ladder aloud |
| 3rd | 4 d | 7 | anchor / one full ladder aloud |
| 4th | ~1.5 wk | 16 | anchor / one full ladder aloud |
| 5th | ~3 wk | 35 | anchor / one full ladder aloud |
| 6th+ | monthly | 65, 95, … | now maintenance-cheap |

A card you nail cold at day 35 you will not need again for a month. That widening gap *is* the payoff: the schedule asks less of you exactly as the memory needs less.

## The maintenance schedule — keeping the reflex warm between searches

Between job searches you are in the off-season, and the off-season is not rest — it is low, regular, unglamorous load. Three cadences carry it, none of them heavy.

**Weekly, ~10 minutes.** Whatever Anki reviews are due — spoken, not silently flipped (two minutes). Then two drills from the drills chapter's tiers: one T2 single-rung to oil the arithmetic, one T4 curveball to keep the decomposition flexible. This is the two-drills-a-week the 30-day program already prescribed for after day 30; the weekly T2 is what keeps the *speed* of the spoken chain from rusting, which is the first thing that goes.

**Monthly, ~15 minutes.** One full T3 ladder, spoken end to end on a system you haven't touched — the rep that keeps chain-assembly warm, not just the individual formulas.

**Quarterly, ~15 minutes.** Blank-page the whole cheat sheet once, to catch the silent drift of an anchor you've been quietly misremembering for weeks.

That is the entire lifetime cost — about twelve hours a year, all in. It respects the same law as the 30-day program: daily-or-weekly-small beats a heroic Saturday, because retrieval strength grows from many spaced pulls, and a three-hour session is one recall wearing the costume of a dozen. Keep the cadence and the reflex stays a few degrees below performance temperature all year — a short re-warm away from the room, never a rebuild.

> ⚠️ **Trap** — "I'll just cram it back when I need it." Skip maintenance and the trace decays to recognition; the 48-hour re-warm below then becomes a 48-hour re-*learn*, which is not enough time, which is why people who "knew this stuff" freeze. Pay the ten minutes a week so the two days before a round are cheap.

## Interleaving — retrieve the move, not the order

There are two ways to spend a practice session, and the one that feels better is the worse one.

*Blocked* practice runs all the storage problems together, then all the traffic problems. By the third storage problem your hand reaches for `rate × size × retention × 5` before you've read the prompt — because the session pre-loaded it. It feels fluent and fast. It transfers badly, because you have rehearsed *executing* a move you were handed, never *choosing* it.

*Interleaved* practice shuffles the deck: a news feed, then a payments ledger, then a telemetry firehose, in no order. Every rep now forces the harder, real question first — *which move does this system need?* — before any formula runs. That selection, under uncertainty, is exactly what the interview demands, because no interviewer ever says "this is a storage problem." They say "design a ride-hailing app" and watch which rung you reach for.

The peak factor is the cleanest case. Two systems, identical average load:

```
200 M actions/day ÷ 10^5 = 2 k QPS average   # both systems, same number
global social feed   -> ×3  = 6 k peak
India-only portal    -> ×5  = 10 k peak       # single region, ~8 h of traffic
```

Interleaving makes you *pick* ×3 versus ×5 from the shape of the system, every rep. Blocked practice hands you the same factor twice and trains nothing — the pick is the graded skill, and only a shuffled deck rehearses it.

> 🎯 **In the room** — Reciting a memorized order ("users, then traffic, then storage…") reads as a candidate on rails the moment the system doesn't fit the template. Selecting the right move *because this system's numbers demanded it* — "machines are trivial here, the whole finding is egress" — is the senior signal. Interleaving is what trains the selection instead of the sequence.

## The 48-hour re-warm before a round

A real round is scheduled. Treat the two days before it as a pilot's recurrent check: you are not learning to fly, you are raising the temperature on a skill you already have. This assumes you kept the maintenance schedule; if you did, forty-eight hours is plenty.

- **Day −2, ~20 min.** Blank-page the cheat sheet twice — §§1–9 and the eight pocket formulas, verbatim. Then two T2 single-rungs aloud, logged. This reloads the anchors and tells you which one drifted.
- **Day −1, ~30 min.** Two T3 full ladders, five minutes each, spoken, on systems nearest the company's domain. Reread the interview script's pushback playbook. One T4 curveball to loosen the decomposition. This restores chain-assembly speed — the thing that rusts first.
- **Morning of, ~5 min.** One 60-second skeleton aloud, standing. Then stop. Do not cram: an extra hour of sleep beats an extra hour of drills, and a re-warm is not a rebuild.

What a re-warm restores is production speed, not knowledge — the difference between a number that leaves your mouth mid-sentence and one you grope for while the interviewer waits:

```
"...that's 200 M a day, so 2 k average, global so ×3 — call it 6 k peak,
 typical logic, ten-ish boxes." # warm: one breath, from two anchors
```

That fluency is perishable. The 48-hour re-warm is how you bring it back to room temperature on demand.

## Driving it with the two tools — the Anki deck and the Practice Arena

The book ships two tools, and they divide the labour along the two things that decay: the numbers, and the speed of assembling them into a chain.

**The Anki anchor-numbers deck is for the numbers.** It *is* a spaced-repetition engine — its algorithm implements the expanding-interval table above automatically, per card, widening the gap after each clean recall and collapsing it after a lapse. Use it for the ~40 anchors, daily-ish, only what's due, two minutes. But heed the warning from *The numbers that matter*: a flashcard, flipped silently, builds recognition, and the interview tests recall. The fix converts the tool: **say the answer out loud before you flip, and score a silent flip as a miss.** That one rule turns a recognition trainer into a recall trainer.

**The Practice Arena is for the chains.** Full-ladder reps under mild pressure: it draws a random system — interleaving by construction, so you retrieve the move, not the order — starts a clock, and reveals the reference answer only after you've spoken yours, so you self-calibrate and log the ratio. It is the drills chapter's speak-then-reveal ritual, shuffled and timed. The clock supplies the mild stress that makes retrieval a training stimulus rather than a stroll; the reveal-after supplies the one honest retrieval per rep.

The split is clean: Anki keeps the anchors from fading; the Arena keeps the spoken chain from slowing. Run Anki in the weekly cadence and the Arena for the monthly T3 and the whole 48-hour re-warm. Two tools, two failure modes — a forgotten number and a sluggish assembly — each with its own antidote. Neglect either end and the reflex rots at that end while the other end lies to you that all is well.

## Numbers to keep

- Expanding intervals: **day 1, 3, 7, 16, 35, then monthly** — each clean recall roughly doubles the gap; one lapse collapses it back to the start.
- Maintenance ≈ **10 min/week (two drills) + one monthly T3 ladder + a quarterly blank-page** ≈ **~12 h/year** to hold a 30-day build.
- **Spacing beats massing:** retrieve as the trace fades, not while it's fresh — the effort of retrieval *is* the stimulus (deficit watering; the deeper root).
- **Out loud, always:** a silent flip is a miss; speaking is the retrieval that sticks — the same rule that runs the whole book.
- **Interleave:** the Arena's random draw trains the pick — which move, not which order; blocked practice's fluency is the same lie as re-reading.
- **48-hour re-warm:** −2 blank-page the cheat sheet twice + 2 T2; −1 two T3 + a curveball + the pushback playbook; morning-of one skeleton, then sleep.
- **Two tools:** Anki for the numbers (spaced, spoken), the Practice Arena for the chains (shuffled, timed).

## Drills

**D1** — Your Anki intervals on the storage-formula card so far are 1, 3, 7, 16 days, and you just recalled it cold at the day-16 review. Roughly when is it due next, and what happens to that gap if instead you had blanked?

<details><summary>Answer</summary>

```
clean recall at day 16 -> next gap ~2× ≈ 19 days -> due ~day 35
blank at day 16        -> gap collapses back to ~1 day, card re-enters short rotation
```

The interval is a readout of trace strength, not a calendar convenience — the gap doubles because a clean pull flattened the forgetting curve, and it springs back to the start the moment the root can't reach water. That collapse is the deck doing its job, not punishing you.
</details>

**D2** — In one Arena session you draw a global social feed, then an India-only results portal — both ~200 M actions/day. Same average QPS. What does interleaving force you to retrieve that a blocked storage set never would, and what's the number?

<details><summary>Answer</summary>

```
200 M/day ÷ 10^5 = 2 k QPS average        # identical for both — the trap
global feed      -> ×3  = 6 k peak
regional portal  -> ×5  = 10 k peak         # single region, ~8 h of traffic
```

The peak-factor pick — ×3 versus ×5 — chosen from the system's shape, not handed to you. Interleaving rehearses exactly that selection, which is the move the interview grades; a blocked set gives you the same factor twice and trains only your typing.
</details>
