# Contributing to The Estimation Instinct

Corrections, sharper drills, fresher real-world numbers, and new walkthroughs are all welcome. This guide exists because the book's value is **internal consistency** — a reader drilling chapter 14 must get the same answer the cheat sheet would give them. Read this before writing a word.

## The one law: the canon

[Appendix A — The cheat sheet](book/appendices/a-cheat-sheet.md) is the single source of truth for every number and formula in this book.

- Any number used in any chapter must either **appear in Appendix A** or be **derived in-text from numbers that do**.
- If you believe a canon number is wrong or stale, change it **in Appendix A first**, then update every chapter that uses it. A PR that changes a number in one chapter only will be declined.
- Real-world figures (e.g., "UPI processes ~600M transactions/day") live in [Appendix C](book/appendices/c-real-world-scale-gallery.md) with a source, and are always written with `~` — they are calibration points, not canon.

## Voice

The book speaks engineer-to-engineer, second person, present tense. Specifically:

1. **Direct.** No throat-clearing, no "in this chapter we will explore". Open with the problem or a claim.
2. **First principles before formulas.** Derive every formula once, so the reader could reconstruct it; only irreducible anchors get memorized.
3. **Every number earns its place.** A number that doesn't change a design decision is decoration — cut it or connect it. End estimations with "so what".
4. **Round ruthlessly and say so.** One significant figure. When a rounding introduces known error, name it and move on ("we under-count ~15% here; the peak factor swallows it").
5. **Physical anchors.** Abstract quantities get one human-scale, physical analogy — kitchens, crowds, railways, weddings, markets. Cross-cultural analogies are a feature of this book, not an accident. Limit: ~2 per chapter, and never let the analogy replace the derivation.
6. **No hedging stacks.** One qualifier maximum per claim. "Roughly 10k QPS" — not "perhaps somewhere around possibly 10k".
7. **Spoken-word test.** Worked examples should read the way a strong candidate would *say* them. If a sentence can't be said aloud in an interview, rewrite it.
8. **Arithmetic in code blocks**, one step per line, units always written:

```
200 M DAU × 5 reads/day      = 1 B reads/day
1 B / 10^5 s                 = 10,000 QPS average
× 3 peak factor              ≈ 30,000 QPS peak
```

## Callout conventions

Use these four, as blockquotes, sparingly:

- `> ⚡ **Instinct check** —` a 10-second inline drill the reader answers before continuing
- `> 🎯 **In the room** —` interview-specific advice: phrasing, timing, what the interviewer is noting
- `> 🧮 **Worked example** —` a full numeric walkthrough
- `> ⚠️ **Trap** —` a mistake candidates actually make

## Drill format

Every chapter ends with drills. Answers are collapsed so the reader must attempt first:

```markdown
**Drill N.1** — One Diwali evening, a payments app sees 10× its normal 2k TPS for 3 hours. How many extra transactions is that?

<details><summary>Answer</summary>

```
normal: 2k TPS × 3 h × 3,600 s/h ≈ 21.6 M  → call it 20 M
10×:    200 M total, so ~180 M extra
```

~180M extra transactions. The follow-up that matters: can the write path absorb 20k TPS, or do we queue?
</details>
```

## Chapter templates

### Concept chapters (Parts I, II, IV)

```markdown
# N — Title
*One-line hook in italics.*

## The question this chapter answers
## From first principles        ← the derivation
## The anchors                  ← table of numbers this chapter contributes
## Worked example(s)            ← 🧮, full chains, spoken-word style
## Traps                        ← ⚠️, the 3–5 real mistakes
## Numbers to keep              ← ≤7 bullets, the chapter's residue
## Drills                       ← 3–5, with <details> answers

navigation footer
```

### Walkthrough chapters (Part III)

Walkthroughs are deliberately repetitive — same rungs, same order, every time. That repetition *is* the training. Do not get creative with the structure; get creative inside it.

```markdown
# N — System name
*One-line scenario.*

## The prompt                   ← what the interviewer says, verbatim
## Scope it in 60 seconds       ← the 2–3 clarifying questions that change the numbers
## Assumptions on the table     ← table: quantity | value | why defensible
## Rung 1 — Users
## Rung 2 — Actions (traffic)
## Rung 3 — Bytes (storage & bandwidth)
## Rung 4 — Machines (cache, servers, shards)
## Rung 5 — Money               ← only as deep as it changes the conversation
## So what — decisions these numbers force   ← number → architectural consequence
## The pushback round           ← interviewer challenges a number; the recovery, as dialogue
## Say it in 60 seconds         ← the whole estimation as a spoken blockquote
## Numbers to keep
## Drills                       ← 3, variations on this system

navigation footer
```

## Navigation footer

Last line of every chapter, exactly this shape:

```markdown
---
[← Previous: Title](relative-path.md) · [Table of contents](../../README.md) · [Next: Title →](relative-path.md)
```

## Formatting rules

- One `#` H1 per file (the chapter title), `##` for sections.
- Tables for any set of ≥3 related numbers.
- Decimal units in prose (1 GB = 10^9 bytes) — interviews don't care about GiB; [Appendix B](book/appendices/b-reference-tables.md) covers the distinction once.
- Mermaid diagrams only where structure genuinely needs them; they must render on github.com.
- Lines of arithmetic: spaces around operators, units on every quantity, `≈` whenever rounding happened.

## What gets a PR declined

- Numbers that contradict the canon without updating it
- Precision theater (three significant figures anywhere)
- Analogies that require a paragraph of their own explanation
- New chapters that break the template
- Drills without collapsed answers, or answers without a "so what"
