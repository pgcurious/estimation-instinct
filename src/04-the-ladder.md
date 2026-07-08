# 4 — The Ladder

*Every estimation question ever asked in a system design round is the same question. Learn to answer that one.*

## The question this chapter answers

"Estimate the QPS." "How much storage?" "Will this fit in cache?" "How many servers?" — these sound like different questions, and candidates treat them as different skills with different formulas. They are not. They are five points on a single chain, and once you can walk the chain in one direction, you can start anywhere on it and walk to anywhere else.

This chapter gives you that chain. The rest of the book is practice walking it.

## From first principles

Strip any software system down to what it physically is: **people doing things that move bytes through machines that cost money.** That's the whole ontology. There is nothing else an interviewer can ask you to estimate — every quantity in a system design round is one of those five nouns or a ratio between two of them.

Consider how a veteran wedding caterer in Delhi quotes a wedding, on the phone, in under a minute. How many guests? *Two thousand.* How many will actually eat at the peak sitting, eight to nine? *Maybe half.* A thousand thalis in an hour — that's four buffet lines, two kitchens, forty staff. *That'll be about twelve lakh.* He didn't compute a menu; he walked a chain: **guests → plates per hour → kitchens → price**. He's done it so many times that the chain has disappeared. What's left looks like instinct.

The software version of his chain:

```
USERS      how many, how active, how peaky?
  ↓
ACTIONS    what do they do, how often?           → traffic (QPS)
  ↓
BYTES      what does each action move or keep?   → storage, bandwidth
  ↓
MACHINES   what does that volume demand?         → caches, servers, shards
  ↓
MONEY      what does that hardware cost?         → feasibility
```

Each rung is derived from the one above by multiplying by exactly one new assumption. That is the deep reason estimation is learnable: **you never compute anything from scratch — you only ever multiply the previous rung by one number you can defend.**

## The move you repeat at every rung

At each rung you do the same three things, out loud:

1. **State** the assumption. "Assume 200M DAU, and each user opens the feed 5 times a day."
2. **Compute** with round numbers. One significant figure. A day is 10^5 seconds.
3. **Interpret** the result. "10k average QPS — read-heavy — so this is a caching problem, not a database problem."

State, compute, interpret. The candidates who fail estimation almost never fail at step 2 — they fail by skipping 1 (silent assumptions the interviewer can't follow) or 3 (numbers that lead nowhere). An estimate that doesn't change a design decision is decoration.

> 🎯 **In the room** — The interpret step is what separates levels. A mid-level candidate says "so that's 10,000 QPS." A senior candidate says "so that's 10,000 QPS, which one beefy stateless tier handles easily — the interesting problem is the storage growth, let me look at that instead." Same arithmetic; entirely different signal.

## The five rungs

### Rung 1 — Users

The question: *how many people, and when do they show up?*

```
DAU              = MAU × 25%        (sticky messaging apps: 50%)
peak concurrent  = DAU × 10%
```

If the interviewer gives you DAU, take it. If they say "design for India" or "global scale," propose a number and get a nod: "Say 100M DAU — reasonable?" Never start multiplying without that nod; a wrong base silently poisons every rung below.

### Rung 2 — Actions → traffic

The question: *what do they do, how often, and how concentrated in time?*

```
average QPS = (DAU × actions per user per day) ÷ 10^5
peak QPS    = average × 3        (single-region ×5, event-driven ×10)
```

Always split reads from writes before leaving this rung — the ratio (100:1 for content systems, ~1:1 for chat) decides which one is your real problem. The rung-2 numbers are the most load-bearing in the whole estimation: everything below scales off them.

### Rung 3 — Bytes — storage and bandwidth

The question: *what does each action keep (storage) or move (bandwidth)?*

```
storage   = write rate × object size × retention × 5
bandwidth = QPS × bytes per request     (ingress and egress separately)
```

The ×5 turns logical bytes into provisioned bytes: ×3 replication, ×1.5 indexes and overhead, rounded with a straight face. Object sizes come from the canon: ~1 KB for a record, ~200 KB for a feed photo, ~100 MB per minute of video across renditions. When you don't know, say "call it a kilobyte" and keep moving — refining an object size is cheap later; stalling is not.

### Rung 4 — Machines

The question: *how many boxes, and where does the data have to split?*

```
servers = peak QPS ÷ per-server QPS ÷ 0.6        (100 / 1k / 10k rule)
cache   = 20% of a day's read volume             (the 80/20 working set)
shards  = max( total bytes ÷ 2 TB , write TPS ÷ node write ceiling )
```

The 100/1k/10k rule: a server sustains ~100 QPS of heavy work, ~1k of typical business logic, ~10k of trivial work. The shard formula is a maximum of two pressures — data size and write throughput — and saying *which one* forced sharding is exactly the kind of interpretation interviewers listen for.

### Rung 5 — Money

The question: *is this design affordable, and what dominates the bill?*

```
monthly cost ≈ boxes × $1k + TB stored × $20 + TB egress × $100
```

You won't be asked for cost in every round. Climb this rung anyway when something smells expensive — egress on a video platform, GPU inference, hot storage of cold data. "This design is roughly $2M a month and 80% of it is egress, which is why I'd put a CDN in front" is the single most architect-sounding sentence you can say in an interview.

## 🧮 Worked example — a podcast platform

Interviewer: *"Design a podcast platform — creators upload episodes, listeners stream them."* (Deliberately not one of this book's eleven walkthroughs — watch the ladder handle a system it's never seen.)

**Users.**

```
say 50 M MAU, podcast listening is habitual → DAU = 50 M × 25% ≈ 10 M
```

**Actions.** Listeners stream ~2 episodes/day; creators are rare — say 50k uploads/day total.

```
streams: 10 M × 2 = 20 M/day  → 20 M ÷ 10^5 = 200 stream-starts/s, peak ≈ 600/s
uploads: 50 k/day             → negligible QPS (~0.5/s) — but not negligible bytes
```

Interpret: request traffic is trivial. This system's problems live in bytes, not QPS. Keep climbing.

**Bytes.** An episode is ~40 min of audio. Audio is ~1 MB/min (a fifth of the 5 MB song anchor's 3 minutes — say 1 MB/min and move).

```
upload storage: 50 k/day × 40 MB = 2 TB/day logical × 5 = 10 TB/day provisioned
                → ~3.5 PB/year: real, but S3-class storage, not a database problem
streaming egress: 20 M streams × 40 MB (assume full listens — conservative)
                = 800 TB/day egress
```

Interpret: **800 TB/day of egress is the system.** Everything else is a rounding error.

**Machines.** API tier: 600 peak QPS of typical logic → one server, three for redundancy. Metadata: 50k episodes/day × 1 KB — a single Postgres laughs at this for years. No sharding. The whole machine story is the CDN.

**Money.**

```
egress, raw:     800 TB/day × 30 × $100/TB ≈ $2.4 M/month  ← non-starter
egress, CDN:     × $30/TB instead          ≈ $700 k/month   ← the real bill
storage:         3.5 PB × $20/TB-month     ≈ $70 k/month    ← noise
```

Interpret, and land it:

> "So: traffic is trivial, storage is manageable, and the entire design problem is 800 TB a day of audio egress — about $700k a month even through a CDN. The architecture should be: tiny API tier, one boring SQL database, and all engineering effort on the delivery path — aggressive CDN caching, maybe lower default bitrates. Want me to design that path?"

Ninety seconds of arithmetic just told you where the design effort goes. That is estimation doing its job — it didn't decorate the design, it *chose* it.

## ⚠️ Traps

- **Estimating without a customer.** Computing storage when nothing about the design depends on storage. Before climbing, ask yourself which decision this number will drive; if none, don't climb that rung.
- **Silent assumptions.** Every multiplier said out loud is a checkpoint the interviewer can correct cheaply. Every silent one is a 10× error they discover late — and now you're untrustworthy.
- **Unit soup.** Per-day mixed with per-second, MB with Mb. Antidote: write units on every line, convert to per-second and bytes early.
- **Precision theater.** "11,574 QPS" tells the interviewer you've memorized 86,400 and missed the point. Say 10k.
- **Forgetting peak.** Averages don't crash systems; the 9 PM spike does. The ×3 is one word of effort and it's the difference between sizing a system and describing one.

## Numbers to keep

- The chain: **users → actions → bytes → machines → money** — one new assumption per rung
- The move: **state, compute, interpret** — at every rung, out loud
- QPS = daily actions ÷ 10^5, peak ×3
- Storage = rate × size × retention × 5
- Servers = peak ÷ (100 / 1k / 10k) ÷ 0.6; cache = 20% of daily reads
- Cost ≈ boxes × $1k + TB × $20 + egress TB × $100
- An estimate that doesn't change a decision is decoration

## Drills

**Drill 4.1** — A meditation app has 40M MAU. Sessions are 1/day for actives, each session writes one 1 KB completion record. Walk all five rungs in under two minutes, out loud.

<details><summary>Answer</summary>

```
users:    40 M × 25% = 10 M DAU
actions:  10 M writes/day ÷ 10^5 = 100 writes/s, peak 300/s (evening meditation spike — maybe ×5: 500/s)
bytes:    10 M × 1 KB = 10 GB/day × 5 = 50 GB/day provisioned ≈ 18 TB/year
machines: 500 peak QPS typical logic → 1 server (3 for redundancy); one SQL node holds years of data
money:    ~$3–5k/month — noise
```

Interpretation: this system has no scale problem. Say that plainly — "nothing here stresses hardware; the design conversation should be about streaks, notifications, and offline sync." Recognizing a *small* system fast is as strong a signal as taming a big one.
</details>

**Drill 4.2** — In the podcast example, the interviewer says: "Make it video podcasts." Which rungs change, and by how much?

<details><summary>Answer</summary>

Only rung 3 onward — users and actions are untouched. Video is ~100 MB/min stored vs audio's ~1 MB/min: roughly **×100 on storage** (10 TB → 1 PB/day provisioned) and, at 1080p streaming bitrates vs audio, **~×20–30 on egress** (800 TB → ~20 PB/day — now a $20M+/month CDN bill). Interpretation: the business model, not the architecture, is now the question — which is also worth saying out loud.
</details>

**Drill 4.3** — An interviewer asks only: "How many servers for the API tier of a food-delivery app in Brazil?" You get one minute. Which rungs do you climb, and which do you skip?

<details><summary>Answer</summary>

Climb users → actions → machines; skip bytes and money entirely — no decision they'd drive was asked for.

```
say 20 M DAU, ~20 API calls each (browse, cart, order, track) = 400 M/day
400 M ÷ 10^5 = 4 k QPS average; single region + mealtime spikes → ×5 = 20 k peak
typical logic at 1 k QPS/server: 20 ÷ 0.6 ≈ 35 servers
```

"About 30–40 servers" with the chain stated beats "50" with silence — the interviewer can only trust what they can audit.
</details>
