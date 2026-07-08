# 2 — The arithmetic of scale

*The candidates who sound fast aren't calculating faster than you. They're calculating less.*

## The question this chapter answers

Estimation arithmetic never gets harder than single-digit multiplication and adding small whole numbers. That sounds like a promise about easy interviews; it's actually a claim about notation. The candidate who hears "50 million users, 20 actions a day, a kilobyte each" and answers "call it a terabyte a day" within a breath isn't running fast arithmetic — they're running almost none, because every quantity they touch is already in a form where the work has disappeared.

[Chapter 1](01-the-skill-that-decides-the-round.md) established that the number isn't graded; the audible chain is. But narration costs attention, and attention spent wrestling 86,400 is stolen from stating assumptions and reading the interviewer. This chapter buys that attention back. It answers: **how do you run a six-factor multiplication chain out loud, at conversation speed, with an error whose size and direction you can name?** With one representation, one rounding doctrine, three pre-computed time constants, and a handful of percentage moves. Everything else in this book stands on them.

## From first principles

Start with why your brain needs the help. The old Indian legend: a sage wins a favor from a king and asks for rice on a chessboard — one grain on the first square, doubled on each square after. The king laughs at the modesty and agrees; his treasurers discover, squares later, that the final square alone owes 2^63 grains and the kingdom is bankrupt. (Versions disagree on whether the sage got the throne or the sword.) The king's failure wasn't greed. Human intuition *linearizes*: sixty-four small doublings feel like a sack of rice. They are about 2 × 10^19 grains — we'll compute that in two moves shortly.

You are the king. Everyone is. Brains evolved for crowd-sized counts, and seniority doesn't fix the blindness. What fixes it is a notation that carries the magnitude *for* you — so the part of a number your intuition fumbles, the zeros, is handled by bookkeeping instead of feel.

### Every number becomes a small number times a power of ten

The representation: every quantity is **mantissa × 10^exponent**, mantissa kept between 1 and 10. Fifty million users is 5 × 10^7. Twenty actions is 2 × 10^1. A kilobyte is 10^3 bytes. The form splits each number into the part you handle well (a small number) and the part you don't (the exponent — zeros, counted instead of felt).

Two rules operate the entire system:

- **To multiply: multiply the mantissas, add the exponents.**
- **To divide: divide the mantissas, subtract the exponents.**

```
3 × 10^5  ×  4 × 10^3
mantissas: 3 × 4 = 12        exponents: 5 + 3 = 8
= 12 × 10^8                  renormalize: ≈ 1.2 × 10^9
```

The third move, **renormalize**, is the one candidates skip and regret: the moment a mantissa drifts out of the 1–10 window, push the overflow into the exponent — 12 × 10^8 becomes 1.2 × 10^9 *before you write another line*. A mantissa of 12 left sitting for three lines turns into a silent 10× error.

Unit prefixes make the exponents pronounceable: K is 10^3, M is 10^6, G is 10^9, T is 10^12, P is 10^15 — every rung is +3. So unit arithmetic is exponent addition with names, and one sentence carries the whole trick:

**A million things of 1 KB each is a GB.** 10^6 × 10^3 = 10^9. The [cheat sheet](a-cheat-sheet.md) calls that sentence, as reflex, half this book — because every storage estimate you'll ever do is that sentence in different clothes:

```
10^3 × 10^3  = 10^6     a thousand 1 KB rows        = 1 MB
10^6 × 10^3  = 10^9     a million 1 KB rows         = 1 GB     ← the sentence
10^9 × 10^3  = 10^12    a billion 1 KB rows         = 1 TB
10^6 × 10^6  = 10^12    a million 1 MB objects      = 1 TB
10^12 ÷ 10^6 = 10^6     a TB across a million users = 1 MB each
```

Drill that block until the right column arrives before the left one finishes. [Chapter 3](03-the-numbers-that-matter.md) supplies the object sizes to plug in; the multiplication itself should already be gone.

> ⚡ **Instinct check** — Half a billion 200 KB photos: total bytes, ten seconds. … 5 × 10^8 × 2 × 10^5 = 10 × 10^13 = 10^14 B — 100 TB. If your mantissa said 10 and stayed 10, reread the renormalize rule.

### The one binary bridge

2^10 = 1,024 ≈ 10^3. Accept the 2% and take the bridge — it's the only crossing between binary and decimal you will ever need. From it: 2^20 ≈ 10^6, 2^30 ≈ 10^9, 2^32 = 4 × 2^30 ≈ 4 × 10^9 (the 32-bit ceiling). And interviews speak decimal: 1 GB = 10^9 bytes, and nobody fails for ignoring GiB — [Appendix B](b-reference-tables.md) settles that account once, so the room never has to.

The bridge also pays the chessboard debt: 2^64 = 2^4 × (2^10)^6 ≈ 16 × 10^18 ≈ 2 × 10^19 grains. The king's intuition said "sack of rice"; two exponent moves say otherwise. The notation didn't make anyone smarter — it made the magnitude impossible to miss. That is the entire case for it.

### Round ruthlessly — in a direction you chose

One significant figure, everywhere. Your mantissa menu is **1, 2, 3, 5** — with 1.5 and 2.5 as half-steps when an anchor itself carries one (the month is 2.5 × 10^6 s). Forcing every number onto that ladder costs at most ~40%, usually far less — and the softest behavioral assumption in any chain (does a user open the feed 5 times a day, or 10?) carries a clean 2×. Rounding never leads your error budget; assumptions do. Refusing to round buys precision your assumptions can't cash.

Two refinements separate practiced rounders:

**Compensate.** When you round one factor up, look for a neighbor to round down — multiplicative errors cancel. 7 × 43: take 7 up to 10, take 43 down to 30 — answer 300, truth 301. Rounding both *up* would have said 500.

**Track the direction.** Every rounding pushes the running total high or low; know which, cumulatively. The canon's own example: a day rounded up to 10^5 seconds under-counts every per-second rate by ~15% — known, named once, and swallowed by the ×3 peak factor applied right after. That's the full pattern for living with error: name the direction, find the bigger multiplier that absorbs it, move on. And when the number sizes capacity — storage to provision, servers to buy — let the *net* error sit on the conservative side: round demand up, capacity down. Optimistic rounding produces estimates that look fine and systems that aren't.

Once rounded, stay rounded: "≈ 1.2 × 10^9" is a defensible claim; "≈ 1.2347 × 10^9" is a confession you don't know what your own ≈ means. The traps section returns to this.

> 🎯 **In the room** — Write exponents; speak names. On the whiteboard: 4 × 10^14. Out of your mouth: "400 terabytes." A candidate who says "ten to the fourteenth" is reciting notation; one who says "400 TB a year — so we're a blob store, not a database" is having a conversation. The notation is for your hands. The names are for the human.

### Time, pre-computed

Every traffic estimate divides by seconds and every retention estimate multiplies by them, so derive the constants once, here, and never again:

```
1 day   = 24 h × 3,600 s/h = 86,400 s    → round up:  10^5 s
1 month ≈ 30 × 86,400 s   ≈ 2.6 × 10^6 s → call it:   2.5 × 10^6 s
1 year  ≈ 365 × 86,400 s  ≈ 3.15 × 10^7 s → call it:  3 × 10^7 s
```

The day's rounding is the famous one — up to 10^5, rates under-counted ~15%, the peak factor pays the debt ([chapter 5](05-traffic.md) prices that trade). The year has a mnemonic too good to skip: **a year is π × 10^7 seconds** — accurate to half a percent, meaningful not at all, unforgettable anyway. Compute with 3 × 10^7; remember with π. The month earns its keep through one trick: dividing by 2.5 is multiplying by 4 — so monthly volumes become per-second rates in a single move: ×4, knock 7 off the exponent.

| You have | You want | Move | Say it like |
|---|---|---|---|
| per day | per second | ÷ 10^5 | "a billion a day — 10 k a second" |
| per second | per day | × 10^5 | "5 k a second — 500 M a day" |
| per day | per month | × 30 | "1 TB a day — 30 TB a month" |
| per day | per year | × 365 ≈ × 4 × 10^2 (up ~10% — conservative, right for storage) | "1 TB a day — ~400 TB a year" |
| per month | per second | ÷ 2.5 × 10^6 (= ×4, drop 7) | "750 M a month — 300 a second" |
| per year | per second | ÷ 3 × 10^7 | "a billion a year — ~30 a second" |
| per second | per year | × 3 × 10^7 | "100 a second — 3 B a year" |

Run this table both directions until neither feels like a calculation. Interviewers switch frames mid-sentence — "600 a second; what's that a month?" — and the candidates who keep up aren't computing. They're converting.

> ⚡ **Instinct check** — Your pipeline ingests 2 k events/s. Events per day? … 2 × 10^3 × 10^5 = 2 × 10^8 — 200 M. Now backwards: 600 M writes a month — per second? … 6 × 10^8 × 4 × 10^-7 = 240 — call it 250/s.

### Two number languages, one exponent line

English names a new word every three exponents — thousand 10^3, million 10^6, billion 10^9, trillion 10^12 — which is exactly why K/M/G/T feel native. India's system names different rungs: a **lakh** is 10^5, a **crore** is 10^7.

| Name | Power | Cross-reading |
|---|---|---|
| thousand | 10^3 | 1 K |
| lakh | 10^5 | 100 thousand |
| million | 10^6 | 10 lakh |
| crore | 10^7 | 10 million |
| billion | 10^9 | 100 crore |
| lakh crore | 10^12 | 1 trillion |

Readers fluent in both systems have been doing exponent arithmetic for free since childhood: every newspaper headline is a drill, because moving between "₹3 lakh crore" and "three trillion rupees" *is* mantissa-and-exponent work — 10^5 × 10^7 = 10^12, the compound name is itself exponent addition. If you grew up with lakhs, that fluency is an asset here: "10 crore DAU" should land as 100 M without a pause. If you didn't, this book stays in millions and billions — but steal one mnemonic regardless: **a day is a lakh of seconds.** The 10^5 anchor, with a name. (Chinese, Japanese and Korean speakers hold the same advantage through 万 = 10^4 — any second naming system turns exponent conversion into a daily habit instead of an interview trick.)

### Percentages are one-move divisions

You will never multiply by 0.25 in an interview. The percentage moves that matter are divisions in disguise, and the behavioral defaults of [chapter 3](03-the-numbers-that-matter.md) are usable at speed precisely because each is a single move:

```
10%  = ÷ 10     exponent down one      peak concurrent = DAU ÷ 10
1%   = ÷ 100    exponent down two
50%  = ÷ 2      sticky-app DAU = MAU ÷ 2
25%  = ÷ 4      DAU = MAU ÷ 4
20%  = ÷ 5      hot set = a day's reads ÷ 5
1/3  ≈ 0.3
```

And one multiplicative trick worth more than it looks: **×3 is half an order of magnitude.** 10^0.5 ≈ 3.16, so 3 × 3 ≈ 10 — two ×3s cost one exponent. Use it in both directions. Stacking multipliers: ×3 peak on ×3 fan-out is ×10, full stop. And the middle guess: certain a number lives between 10^5 and 10^6 but no closer, say 3 × 10^5 — the multiplicative midpoint, equally wrong in both directions, which makes it the most honest number available.

### Zeros and units on separate ledgers

Sanity-check a product the way you computed it: mantissas on one ledger, exponents on the other, reconciled at the end. The mantissa ledger never exceeds the times tables; the exponent ledger is integer addition; most slips surface in the reconciling. When a result still smells wrong, the *size* of the wrongness names the suspect:

| The error is about | The culprit |
|---|---|
| ~2× | rounding debt — fine, if you chose the direction |
| ~8× | bits read as bytes |
| ~10× | a lost exponent — an unrenormalized mantissa, a dropped zero |
| ~1,000× | a unit bug: KB as MB, ms as s — never arithmetic |

The 1,000× row matters most. Unit prefixes step in 10^3s, and so do the time units below a second — so misreading one rung of either ladder is always a three-exponent crime. You cannot *multiply* your way to a 1,000× error through small mantissas; you can only mis-label your way there. When an answer is absurd, audit units first — re-running the arithmetic checks the ledger that wasn't broken.

Bits are the 8× cousin: networks quote bits per second, storage counts bytes. 1 Gbps moves 125 MB/s; a 10 Gbps NIC, 1.25 GB/s. [Chapter 7](07-bandwidth.md) owns the doctrine; install the reflex now: **lowercase b — divide by 8 before any other move.**

## The anchors

| Anchor | Value | Why it earns memory |
|---|---|---|
| 1 day | 10^5 s | denominator of every QPS estimate (under-counts ~15%; peak ×3 swallows it) |
| 1 month | 2.5 × 10^6 s | monthly press numbers → per-second rates, one move |
| 1 year | 3 × 10^7 s (≈ π × 10^7) | retention → yearly storage |
| 2^10 | ≈ 10^3 | the only binary↔decimal bridge |
| ×3 | half an order of magnitude (3 × 3 ≈ 10) | stacked multipliers; the midpoint guess |
| 1 Gbps | 125 MB/s | the ÷8, made concrete (10 Gbps = 1.25 GB/s) |
| lakh / crore | 10^5 / 10^7 | "a day is a lakh of seconds" |

## 🧮 Worked example — fifty million users, spoken

Interviewer: *"50 M users, each doing ~20 writes a day, around a kilobyte per write — where does that land us?"* Here is the chain as it should run — exponents inside, names outside:

> "Fifty million is 5 × 10^7, times twenty: 5 × 2 is 10, exponents 7 + 1 — that's 10 × 10^8, renormalize, 10^9 — **a billion writes a day**. At a kilobyte each, a billion things of 1 KB is a terabyte — **1 TB a day in**. Per second: a billion over 10^5, subtract exponents — 10^4, **10 k writes a second average**; peak ×3, call it **30 k**. Ingress: 10^12 bytes over 10^5 seconds — 10^7 — **10 MB a second**. A year of this: 1 TB a day times 365 — I'll round up to ×400, storage is capacity — **400 TB a year logical**, times 5 for replication and overhead: **2 PB provisioned**."

The whiteboard version, every exponent step visible:

```
users:       50 M                         = 5 × 10^7
writes/day:  5 × 10^7 × 2 × 10^1          = 10 × 10^8 = 10^9 writes/day
bytes/day:   10^9 × 10^3 B                = 10^12 B   = 1 TB/day
write rate:  10^9 ÷ 10^5 s                = 10^4/s    = 10 k writes/s  → × 3 ≈ 30 k peak
ingress:     10^12 B ÷ 10^5 s             = 10^7 B/s  = 10 MB/s
per year:    10^12 B/day × 365 ≈ 10^12 × 4 × 10^2 = 4 × 10^14 B ≈ 400 TB/year logical
provisioned: 4 × 10^14 B × 5              = 2 × 10^15 B = 2 PB/year
```

Notice what the chain never required: no multiplication harder than 5 × 2, no number wider than two digits, and every rounding had a named direction — the ×400 runs ~10% high on purpose, because storage is capacity.

Now the so-what, because a chain that ends in a number hasn't ended. 30 k peak writes a second is thirty times the ~1 k TPS a single SQL node sustains, and 2 PB a year laughs at the few-TB practical ceiling per node — so this was never going to be a database with a growth plan; it's a partitioned ingest pipeline with a retention policy, and the per-*year* exponent, not the per-second one, forces that conversation. Meanwhile the 10 MB/s of ingress is a tenth of one Kafka broker's ~100 MB/s — say so, and stop sizing what doesn't need sizing.

## ⚠️ Traps

- **Unit soup.** KB multiplied into MB, a per-day figure divided by a per-second one, three lines apart. The antidote is mechanical, not mental: convert to bytes and seconds on the chain's first line, then write the unit on every line after. A chain with units on every line cannot change dimension silently; one without them is precise nonsense waiting to be discovered.
- **The mantissa that outlives its line.** 5 × 4 = 20, jotted as 20 × 10^8, read two lines later as 2 × 10^8. A mantissa outside 1–10 is a 10× error on a delay fuse — renormalize on the line where the overflow happens.
- **False precision after rounding.** "≈ 1.2347 × 10^9." The ≈ already confessed that everything past the first figure is noise; the four decimals try to reclaim authority the rounding spent. Chapter 1 called it precision theater — this is its arithmetic form. One figure in, one figure out.
- **Confusing 10× with 10%.** One moves the exponent; the other dents a mantissa. "Traffic grows 10%" never forces an architecture change; "traffic grows 10×" almost always does. Before reacting to any growth number, run the only diagnostic that matters: did the exponent move?

## Numbers to keep

- Every number is mantissa × 10^n — multiply mantissas, **add** exponents; divide, **subtract**; renormalize before the next line
- **A million things of 1 KB each is a GB** — 10^6 × 10^3 = 10^9
- Day = 10^5 s · month = 2.5 × 10^6 s · year = 3 × 10^7 s ≈ π × 10^7
- 2^10 ≈ 10^3, and interviews speak decimal
- One significant figure from {1, 2, 3, 5}; on capacity, keep the net error conservative — and name its direction
- 3 × 3 ≈ 10: ×3 is half an order of magnitude; 10% = ÷10, 25% = ÷4, 20% = ÷5
- A 1,000× surprise is a unit bug, never arithmetic; lowercase b → ÷8

## Drills

Ten seconds each, out loud — mantissas first, then exponents. Any drill that runs long names tomorrow's warm-up.

**Drill 2.1** — A photo app ingests 5 M feed-quality photos (200 KB each) a day. Daily bytes?

<details><summary>Answer</summary>

```
5 × 10^6 × 2 × 10^5 B = 10 × 10^11 = 10^12 B ≈ 1 TB/day
```

One renormalize and done. So-what: 5 M photos carry the same bytes as a *billion* 1 KB rows — media wins the storage conversation long before rows do.
</details>

**Drill 2.2** — A payments platform reports 750 M transactions a month. Average TPS?

<details><summary>Answer</summary>

```
7.5 × 10^8 ÷ 2.5 × 10^6 s = 3 × 10^2 = 300 TPS      (the move: × 4, drop 7)
```

Press releases speak per-month; systems break per-second. One move apart — and 300 TPS average is already a third of a single SQL node's ~1 k write ceiling before any peak factor arrives.
</details>

**Drill 2.3** — A telemetry stream writes 50 events/s, all year. Events per year?

<details><summary>Answer</summary>

```
5 × 10^1/s × 3 × 10^7 s = 15 × 10^8 = 1.5 × 10^9 events/year
```

Per-second numbers look innocent; the year multiplies by 3 × 10^7. 1.5 B rows is a retention conversation nobody scheduled.
</details>

**Drill 2.4** — 80 M MAU, typical stickiness. Peak concurrent users — and at ~100 k sockets per server, how many edge boxes?

<details><summary>Answer</summary>

```
DAU:        8 × 10^7 ÷ 4   = 2 × 10^7
concurrent: 2 × 10^7 ÷ 10  = 2 × 10^6 sockets
edge tier:  2 × 10^6 ÷ 10^5 = 20 servers
```

Two canonical ratios, two one-move divisions — and the answer was a server count all along. Percentages here are exponent moves in business clothes.
</details>

**Drill 2.5** — Off a single 10 Gbps NIC, how many 1 MB images per second?

<details><summary>Answer</summary>

```
10 Gbps ÷ 8            = 1.25 GB/s
1.25 × 10^9 B/s ÷ 10^6 B = 1.25 × 10^3 ≈ 1.2 k images/s
```

If you said 10,000, you read Gb as GB — the 8× bug. Lowercase b: divide by 8 before any other move ([chapter 7](07-bandwidth.md) owns the rest).
</details>

**Drill 2.6** — A queue averages 2 k TPS. Peak is ×3, and each event fans out to ~3 downstream writes. Peak downstream write rate?

<details><summary>Answer</summary>

```
2 k TPS × 3 × 3 ≈ 2 k × 10 = 20 k writes/s peak
```

Two ×3s are one exponent — 10^0.5, twice. Stacked "small" multipliers are how a comfortable 2 k becomes a sharding conversation; catching 3 × 3 ≈ 10 instantly is the whole trick.
</details>
