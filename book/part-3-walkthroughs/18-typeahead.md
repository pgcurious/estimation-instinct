# 18 — Typeahead

*The suggest box is a courtesy feature bolted under the search bar — count its keystrokes and it out-serves the search engine behind it ten to one.*

## The prompt

> "Design search autocomplete for a Google-scale search box."

Candidates hear "search" and reach for crawlers and inverted indexes. Wrong system. Autocomplete is graded on two surprises, pointing in opposite directions: traffic an order of magnitude *larger* than intuition says, and data several orders *smaller*. Put both on the table in the first three minutes and the rest of the round designs itself.

## Scope it in 60 seconds

Three questions change the numbers.

1. **Global and multilingual?** Global, yes. Estimate the core on one dominant language and stress multilingual later — it moves bytes, not architecture (the pushback round takes it).
2. **Personalized or popularity-ranked?** Assume popularity-ranked with a light personalization re-rank on top. A fully per-user index is a different and mostly worse system; say so and move.
3. **How fresh must trending queries appear?** Minutes, not seconds. This quietly decides the build architecture: minutes means a streaming top-off beside a batch rebuild, not a real-time write path.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| Searchers | 500 M DAU | Google-scale; propose it, get the nod |
| Searches per user | ~5/day | habitual utility, not entertainment |
| Keystrokes per search | ~20 | a few words plus corrections |
| Suggest requests per search | **~10 effective** | client debounces ~150 ms of pause — pauses fire requests, not raw keystrokes; **this one assumption halves the fleet** |
| Response payload | ~1 KB | 10 suggestions × ~100 B each ≈ the canon JSON payload |
| Latency target | inside 100 ms, per keystroke | suggestions must feel synchronous with typing |
| Trending freshness | minutes | from scoping; isolates the hard sub-problem |

## Rung 1 — Users

500 M DAU, and — as with the URL shortener — the top rung bends: demand arrives not per user, not per session, not even per search, but **per keystroke**. The unit of demand is the smallest unit of user behavior in this book. Say that plainly in the room, because the next rung is where intuition fails.

## Rung 2 — Actions (traffic)

Walk it in two stages — the search engine first, then the box bolted on top of it:

```
searches: 500 M × 5/day             = 2.5 B searches/day
          2.5 B ÷ 10^5 s            = 25,000 QPS average

suggests: 2.5 B × 10 effective reqs = 25 B requests/day
          25 B ÷ 10^5 s             = 250,000 QPS average
          × 3 peak factor           ≈ 750,000 QPS peak
```

Stop and interpret, because this is the chapter: **the suggest box serves ten times the traffic of the search engine it decorates.** The "minor UX feature" is one of the highest-QPS read services on the planet — every keystroke from half a billion people, arriving as an HTTP request. Per-action multipliers — keystrokes, polls, retries, fan-out — are how small features quietly out-scale their products, and this is the canonical case.

Notice what the debounce bought before you drew a single box: ~20 raw keystrokes collapse to ~10 requests because the client waits ~150 ms of pause before firing. Without it, every number below doubles — a timer in JavaScript is doing the work of 125 servers. Hold that for drill 18.1.

The write side? There isn't one on the hot path. No user write ever touches the serving fleet; the only writes are index builds arriving from a pipeline. The canon's 100:1 content default is conservative here — this path is read-only.

> 🎯 **In the room** — Deliver the ×10 as a discovery, not trivia: "…so suggest runs at 250k QPS — ten times the search engine itself. That's the number that should shape the design." Interviewers are checking whether you notice the multiplier unprompted; it is the entire reason this question gets asked.

## Rung 3 — Bytes (storage & bandwidth)

Now the second surprise, pointing the other way.

The index does not hold every query ever typed — it holds the head. The canon's 80/20 law is the floor; search distributions are skewed far harder, so the top ~10 M queries cover the overwhelming head of traffic. For each meaningful prefix of those queries (~10 per query), store the top-10 completions. An entry is a short string plus a score — call it ~100 B, the canon's URL-sized object:

```
10 M queries × ~10 prefixes × ~100 B/entry ≈ 10^10 B = 10 GB
round generously for ranking metadata, scores, casing → ~20–50 GB
```

Interpret: **the entire global suggestion index fits in one commodity box's 128 GB of RAM.** This system has no storage problem at all. It has a *copies* problem — and saying that reframing out loud is the second sentence the interviewer is waiting for.

The tea-stall owner outside a Kolkata office starts your order at your second syllable — not because he knows every drink in the city, but because he keeps a tiny mental index of his regulars, refreshed daily. Prediction doesn't need the universe; it needs the head of the distribution, kept warm.

**Logging** is where the big bytes live — every keystroke event feeds tomorrow's index. An event is a prefix, a timestamp, a session hash: a couple of 8 B fields plus a short string, call it ~100 B:

```
25 B events/day × ~100 B = 2.5 TB/day raw
÷ 10 log compression     = 250 GB/day to analytics
```

A quarter-terabyte a day handed to the analytics pipeline — the [metrics aggregator](21-metrics-aggregator.md)'s territory. Real, but a batch problem, not a serving problem.

**Bandwidth.** 250k QPS × 1 KB = 250 MB/s egress average globally, 750 MB/s peak — under one 10 Gbps port's 1.25 GB/s even unsplit, and it will be split across regions. Trivial; say so and move.

### The signature sub-question — the budget physics enforces

The budget is the canon's human "instant": 100 ms. Typeahead is crueler than a page load, though — a suggestion that lands after the next keystroke is worse than none, so the budget applies per keystroke, hard.

Now the canon's geography: a cross-continent round trip is 250 ms. Read those two numbers together: **a centralized suggest service cannot meet the budget for most of Earth at any QPS.** No fleet is big enough, because the problem isn't throughput — you are 2.5× over budget before the first instruction executes. Physics has made the architectural decision for you: the index must live near the user, in every region and ideally every edge PoP.

Here the smallness pays off: replicating ~50 GB to thirty PoPs costs nothing worth discussing. **Small data + tight budget = copies everywhere.** Were the index 50 TB, this would be a hard chapter.

The in-region budget, once replicated:

```
client → in-region edge, RTT  ≈ 20 ms   (well inside the 50 ms same-continent hop)
prefix lookup in RAM          ≈ 0       (100 ns reference; the entry in µs)
rank + serialize 1 KB         ≈ 1 ms
total                         ≈ 21 ms — inside 100 ms with ~5× room
```

> ⚡ **Instinct check** — Same design, but the index lives on NVMe instead of RAM: does the budget still close? Answer before reading on.

It does — 100 µs random reads, even several per request, vanish inside a 21 ms total. RAM is chosen for throughput-per-box, not latency. Knowing which constraint each choice actually serves is the fluency being graded.

## Rung 4 — Machines (cache, servers, shards)

A suggest request is a RAM lookup plus serialization — trivial work, the 10k rung of the 100/1k/10k rule:

```
750 k peak ÷ 10 k QPS/server ÷ 0.6 utilization ≈ 125 servers globally
```

Spread them where users are: ~40–50 per major region across three regions, plus a handful in smaller edge PoPs. Each box holds the **full index in RAM** — 50 GB inside 128 GB leaves room for the OS and two index versions during swap-over. No shard map, no separate cache tier, no coordination: the service *is* the cache. This is the easiest scaling story in Part III, and say why: shared-nothing and perfectly horizontal — every box is identical and interchangeable, so adding capacity anywhere is copying a file onto another machine. Zero coordination, pure replication.

The index build is the only machinery with moving parts: a daily-to-hourly batch job over the 250 GB/day of keystroke logs rebuilds the base index, and a small streaming path tops up trending queries within minutes — a modest worker pool, not a second empire.

> ⚠️ **Trap** — Proposing a distributed trie sharded by prefix across the fleet. That takes the one system in this book that needs zero coordination and hands it a shard map, cross-node hops inside a 100 ms budget, and a rebalancing story — to "solve" a 50 GB dataset. Shard data that cannot fit; this data fits in one box.

## Rung 5 — Money

```
serving: ~125 boxes × $1 k/month            ≈ $125 k/month
egress:  25 TB/day × 30 × $30/TB (edge)     ≈ $20 k/month
logs + build pipeline                        ≈ storage noise + modest compute
total                                        ≈ order $150 k/month
```

One line of interpretation: $150k a month for 25 *billion* requests a day — about 20 cents per million requests — because each request does almost nothing. **Cost follows work-per-request, not request count.** That is the 100/1k/10k rule restated as money.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 250 k QPS suggest vs 25 k search | suggest is its own service with its own fleet — never an endpoint on the search cluster |
| 20 keystrokes → 10 requests via debounce | the debounce timer is a fleet-sizing decision made in JavaScript — review client code like infrastructure, because here it is |
| ~50 GB index vs 128 GB RAM/box | full replica on every box: copies, not shards; no cache tier — the service is the cache |
| 250 ms cross-continent vs 100 ms budget | geo-replication mandatory at any QPS — latency is solved by geography, and made affordable by smallness |
| trending fresh in minutes | the only hard sub-problem; isolate it on a slow path (batch rebuild + streaming top-off) so the read path stays dumb |

The deepest row is the second: **client code is capacity policy.** A product engineer "tuning responsiveness" from a 150 ms debounce to 50 ms just bought your company a hundred servers, and no capacity review will catch it unless that constant sits in a table like this one.

## The pushback round

**Interviewer:** "You sized one language. Hindi, Tamil, Arabic, emoji — does your 10 GB survive 50 languages?"

**You:** "Scale the head per language, not the naive product. Naive ×50 on the 10 GB core is 500 GB. But each language's head follows its user base, and long tails share structure — most of the fifty bring a far smaller head than English. Effectively ×10–20: call it 100–200 GB core, a few hundred GB with ranking metadata. Even the worst case, 500 GB, is four boxes' worth of RAM — either a few larger boxes per region, or shard by language, since the first codepoints of the prefix identify the script before you've parsed anything. The architecture survives: still copies everywhere, now grouped by language."

**Interviewer:** "So sharding sneaks back in after all?"

**You:** "By language, not by load — and it buys something the capacity math doesn't show: each language shard gets its own ranking model and rebuild cadence. Tamil completion quality stops competing with English signals inside one global model. When a capacity answer opens a product door, that's usually the sign it was the right cut."

## Say it in 60 seconds

> "Numbers first. 500 million searchers at five searches a day is 2.5 billion searches — 25k QPS. But autocomplete fires per keystroke: twenty per search, debounced to ten effective requests — 25 *billion* requests a day, 250k QPS average, 750k peak. The suggest box serves ten times the search engine. The index goes the other way: top 10 million queries, ten prefixes each, a hundred bytes an entry — about 10 GB, call it 50 with ranking metadata. It fits in one box's RAM, so this has no storage problem — it has a copies problem. And latency settles the architecture: 100 ms to feel instant, but a cross-continent round trip is 250, so a centralized service can't work at any fleet size — replicate the index to every region. 750k peak of trivial work is about 125 servers worldwide, each holding the full index — no shards, pure copies, order of $150k a month. The hard part is freshness: a batch rebuild over 250 GB a day of keystroke logs, plus a streaming path so trending appears in minutes. Everything else is the easiest scaling story in this interview."

## Numbers to keep

- 500 M × 5 = 2.5 B searches/day = 25 k QPS — the engine
- × 10 effective keystrokes = 25 B/day = 250 k QPS, 750 k peak — the box out-serves the engine 10×
- Debounce 20 → 10: a JavaScript timer that halves the fleet — client code is capacity policy
- Index: 10 M × 10 prefixes × 100 B ≈ 10 GB → ~20–50 GB — fits one 128 GB box; a copies problem, not a storage problem
- 250 ms cross-continent vs 100 ms instant → geo-replication mandatory at any QPS; smallness makes it affordable
- 750 k ÷ 10 k ÷ 0.6 ≈ 125 servers globally, full index on each — no shards, only copies
- Keystroke logs: 25 B × 100 B = 2.5 TB/day → ÷10 → 250 GB/day to the pipeline; total ≈ $150 k/month

## Drills

**Drill 18.1** — A product engineer deletes the debounce "for snappier UX." Every keystroke now fires. Recompute the fleet and the bill — then justify the engineering hour the debounce cost.

<details><summary>Answer</summary>

```
requests: 2.5 B searches × 20 keystrokes = 50 B/day = 500 k QPS avg → 1.5 M peak
servers:  1.5 M ÷ 10 k ÷ 0.6 ≈ 250 — the fleet doubles
money:    +125 boxes ≈ +$125 k/month ≈ +$1.5 M/year  (logs double too: 5 TB/day raw)
```

One ~150 ms timer is worth ~$1.5M a year — a hundred engineer-months at the canon's $15k fully-loaded rate, bought with an hour of work. So what: the highest-ROI line of code in this system lives in the client, which is why the debounce constant belongs in capacity reviews, not just UX reviews.
</details>

**Drill 18.2** — An IPL final pushes one query to 1% of *all* suggest traffic for an hour. Does anything break in the replicated-RAM design?

<details><summary>Answer</summary>

1% of the 750k peak is 7.5k QPS on one query's prefixes. In a sharded design that's a hot-shard incident; here every box holds the full index, so the load spreads across all ~125 servers — roughly 60 QPS of extra trivial work each. Nothing breaks; nobody is paged. Replication pre-solved the hot key — contrast the celebrity link in [chapter 11](11-url-shortener.md), where one key saturated one cache node. What *is* stressed is freshness: "ipl final" variants surge as near-new queries, and a daily batch index won't show them — the minutes-fast streaming path is what keeps suggestions relevant mid-match. So what: replicated-read designs convert hot-key incidents into staleness questions; the failure mode moves from the serving path to the build path.
</details>

**Drill 18.3** — Same problem, e-commerce: product autocomplete at 1/100th the traffic, over a 10M-SKU catalog. Which numbers change *shape*, not just size?

<details><summary>Answer</summary>

```
traffic: 250 k ÷ 100 = 2.5 k QPS avg; single market → ×5 regional peak ≈ 12.5 k
servers: 12.5 k ÷ 10 k ÷ 0.6 ≈ 2 → run 3 — the fleet problem vanishes
index:   10 M SKUs × 10 prefixes × 100 B ≈ 10 GB — did NOT shrink
```

Three shape changes. One: the index follows the *catalog*, not the traffic — 100× less load, same ~10 GB, because heads size by corpus. Two: geography dissolves — one country sits inside the 50 ms same-continent hop, so even a centralized service meets the 100 ms budget, and the copies-everywhere argument evaporates. Three: freshness inverts from garnish to core — prices and stock change hourly, so the slow path becomes the main engineering surface and ranking shifts from popularity to conversion. So what: scaling down 100× didn't shrink the system uniformly — it migrated the hard problem from serving to index freshness.
</details>

---
[← Previous: Cloud storage](17-cloud-storage.md) · [Table of contents](../../README.md) · [Next: Rate limiter →](19-rate-limiter.md)
