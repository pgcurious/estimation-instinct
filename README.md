# The Estimation Instinct

**Back-of-the-envelope estimation for system design interviews — from first principles to reflex.**

📖 **Read it free:** **<https://pgcurious.github.io/estimation-instinct/>**

> "How much storage will this need?" — the question that decides more system design rounds than any diagram.

---

## Why this book exists

You can ship software for fifteen years and never once size a system from scratch — then a system design interview asks you to say *"that's about 12,000 writes per second, so a single Postgres won't hold — we shard"* casually, mid-sentence, the way you'd read a clock. Interviewers call it **back-of-the-envelope estimation**, and they are not testing arithmetic. They are testing whether numbers *drive* your design or *decorate* it.

Most people freeze on estimation not because it is hard, but because they trained the wrong thing: they read answers until they looked right (**recognition**) and then got tested on producing a number from nothing, out loud, under pressure (**recall**). This book is built to train recall. It asks you, on nearly every page, to *say the number before you read it* — because that is the rep that sticks.

The instinct is three learnable things, and the book trains all three:

1. **~40 anchor numbers** worth memorizing — no more.
2. **One repeatable procedure** — the Ladder: `users → actions → bytes → machines → money`.
3. **Repetitions** — the same moves on different systems until the moves disappear.

## What's inside

- **32 chapters** across foundations, the six core estimations, **17 full system walkthroughs**, and a "make it instinct" program.
- **🎮 An interactive [Practice Arena](https://pgcurious.github.io/estimation-instinct/32-practice-arena.html)** — an infinite generator of randomized estimation problems that grades your answers by order of magnitude and tracks your streak. This is the "do it again and again" engine.
- **A 30-day program** and a **spaced-repetition retention schedule** to build the reflex and keep it for life.
- **A one-page [cheat sheet](src/a-cheat-sheet.md)** (the canon), extended reference tables, a real-world scale gallery, and a **problem bank** of graded drills.
- **An [Anki deck](drills/anki-anchor-numbers.csv)** of the anchor numbers.

## How to use it

- **Interview in 3 days?** Read chapters 2–4, memorize the cheat sheet, do three walkthroughs aloud, read the interview script.
- **Interview in a month?** Follow the 30-day program — 15 minutes a day — and do five Practice Arena reps daily.
- **Keeping it for life?** The retention schedule turns the reflex into something you never fully lose.

One rule regardless of path: **say your estimates out loud.** Reading builds recognition; speaking builds recall — and the interview tests recall.

## Built with

[mdBook](https://rust-lang.github.io/mdBook/). The source chapters live in [`src/`](src/); the site is built and deployed to GitHub Pages by [the workflow](.github/workflows/deploy.yml) on every push to `main`.

```bash
# local preview
mdbook serve --open
```

## Authors

Written by **Pradipta Gure** — technical architect with 14+ years across banking, insurance, and airline systems — in partnership with **Claude** (Anthropic): the practitioner's gap, questions and judgment; the model's breadth, drafting and synthesis; argued into shape together. The pedagogy throughout — first-principles derivations anchored by physical, human-scale analogies — reflects a shared belief: **a number becomes instinct only when it becomes physical.**

## Contributing

Numbers drift and good drills are scarce — corrections and contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first; the book keeps a strict internal canon (the [cheat sheet](src/a-cheat-sheet.md)) so every chapter agrees with every other.

## License

[CC BY-NC-SA 4.0](LICENSE.md) — share it, teach from it, translate it, improve it. Just attribute, keep it non-commercial, and share alike.

---

*If this book helped you walk into a system design round and reach for numbers without flinching — star the repo so it finds the next person.*
