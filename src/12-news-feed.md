# 12 — News feed

*The walkthrough where arithmetic stops sizing the system and starts choosing it: the most famous forced move in system design interviews.*

## The prompt

> "Design the home timeline for a Twitter/X-scale social network. Put numbers on it first."

Every prepared candidate already knows where this lands: hybrid fan-out, the answer this question is famous for. The interviewer knows you know. So the round is not graded on reaching the answer — it is graded on whether your numbers *leave no alternative*. Recited, the hybrid is a flashcard. Derived, it is ten minutes of an architect thinking out loud. This walkthrough is the derivation.

## Scope it in 60 seconds

Three questions change the numbers.

1. **Following feed or ranked feed?** Following only: a near-chronological merge of accounts the user follows. Ranking bolts ML scoring onto every item — it changes the compute class, not the data movement, and it deserves its own round. Get it excluded.
2. **Media in scope, or text and links?** Text and links. Images and video ride a separate pipeline with its own walkthrough ([photo sharing](15-photo-sharing.md)); this system moves post records and ids.
3. **How fresh must a feed be?** Say the interviewer answers "a new post should appear within seconds to a minute." File that number. It returns at the end as the dial the entire architecture hangs on.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| DAU | 200 M | X-scale; with the canon 25% DAU/MAU that's ~800 M MAU — propose it, get the nod |
| Posts | 0.5/user/day → 100 M/day | most people lurk; posting is the rare verb |
| Feed opens | 5/user/day → 1 B/day | commute, queue, lunch — habitual check-ins |
| Items per open | 50 | a screenful plus one scroll |
| Followers | ~200 average | the load-bearing number of this chapter — and it hides a distribution |
| Post record | ~1 KB | canon default row: ~300 B of text plus author, ids, timestamps, counters |
| Read:write | ~100:1 | canon for feeds — used below as a sanity check, not an input |

## Rung 1 — Users

200M DAU, and the canon's 10% concurrency rule says ~20M people are looking at a timeline right now. Nothing exotic yet — but notice the shape early: this system has one rare verb (posting) and one incessant verb (reading), and the whole design question will turn out to be which verb pays the cost of connecting them.

## Rung 2 — Actions (traffic)

```
opens: 200 M × 5/day   = 1 B/day    ÷ 10^5 s = 10,000 opens/s   × 3 ≈ 30,000/s peak
posts: 200 M × 0.5/day = 100 M/day  ÷ 10^5 s = 1,000 posts/s    × 3 ≈ 3,000/s peak
```

Sanity-check the behavior against the canon before leaving: opens outnumber posts 10:1 in requests, and since each open delivers 50 items, 500:1 in items read per item written. The canon's 100:1 for feed systems sits inside that bracket — the assumptions cohere. Had it come out 5:1, I'd go back and distrust an input.

At face value this rung looks finished — 30k trivial reads, 3k writes, small numbers. The entire problem is hiding inside one unasked question.

### The signature sub-question — what does one post cost?

A post is not delivered when it is written; it must surface in the feed of every follower. Somebody pays for that join — at write time or at read time. Newspaper economics: **push** is home delivery — print once at the press, then a paperwallah drops a copy at every subscriber's door before dawn, so reading costs nothing. **Pull** is the newsstand — one stack at the corner, and every reader walks up and asks. Same paper, opposite owner of the work.

> ⚡ **Instinct check** — 1,000 posts/s, 200 followers each. How many timeline writes per second is home delivery? Answer before reading on.

**Price the push.** Every post becomes one insert into each follower's precomputed timeline:

```
1,000 posts/s × 200 followers = 200,000 inserts/s average
3,000 × 200                   = 600,000 inserts/s peak
```

Against the canon Redis ceiling of 100k ops/s, that is 6 nodes at the wall, 10 at 60% utilization. A real fleet, but an ordinary one. Push looks bought — until you price one specific user:

```
one account, 100 M followers, posts once = 10^8 inserts — for ONE post
fleet throughput: 10 nodes × 100 k ops/s = 10^6 inserts/s
10^8 inserts ÷ 10^6 inserts/s            = 100 seconds
```

A hundred seconds of the **entire fleet** doing nothing but copying one celebrity's sentence, while the organic 200–600k inserts/s queue behind it. Two such posts an hour and the system lives in permanent backlog. You do not mail 100 million letters; this is a stadium announcement — say it once where everyone walks past. **Pure push dies on the celebrity.**

**Price the pull.** Fine — compute feeds at read time instead. Now every open must collect recent posts from every account the user follows:

```
30,000 opens/s peak × 200 followees = 6,000,000 source-reads/s
```

Even at Redis-class ceilings that is 60 nodes doing little but answering "nothing new since last time"; against the SQL post store's 5k reads/s it is over a thousand. And every open becomes a 200-way scatter-gather that must land inside the 100 ms human budget. Step back and see *why* it is worse: the ×200 join multiplier is symmetric — it lands on whichever verb you attach it to. Push pays ×200 on 1k posts/s; pull pays ×200 on 10k opens/s. Ten times the total work, purely for taxing the common verb instead of the rare one. **Pure pull dies on read amplification.**

**The forced move.** Push is right for 99.99% of accounts and catastrophic for a handful; pull is wasteful in general and perfect for exactly that handful — a celebrity's recent posts collapse into one hot cached list served from replicas, instead of 10^8 separate writes. Hot reads replicate; hot writes do not. So: **push the long tail, pull the heads**, and merge the two at read time. The boundary is a follower-count threshold somewhere in 10k–1M, and it is not taste — it is this same arithmetic as a dial: at a 1M threshold the worst single post enqueues 10^6 inserts ≈ 1 s of the full fleet; at 10k, 10 ms. Set it where one post's fan-out fits inside the freshness budget from the scope questions.

> 🎯 **In the room** — Interviewers have heard "fan-out on write versus fan-out on read" recited hundreds of times. The tell they listen for is the threshold: a candidate who derives it from insert-seconds against a freshness SLA is designing; one who shrugs "maybe 10k followers?" is reciting.

## Rung 3 — Bytes (storage & bandwidth)

Posts first:

```
100 M posts/day × 1 KB        = 100 GB/day logical
× 5 (replication + overhead)  = 500 GB/day provisioned ≈ 180 TB/year
```

Modest — say so out loud. No petabytes anywhere, because media lives elsewhere; a text feed is a traffic problem wearing a storage costume.

The interesting bytes are the timelines. What is a timeline entry? Not the post — a *reference* to it: post id + author id + timestamp = 3 × 8 B = 24 B, call it 30 B with structure. Keep ~100 entries per user — two opens' worth, enough that almost every open is a pure cache hit:

```
200 M users × 100 entries × 30 B ≈ 600 GB
```

That number should stop you for a second: the precomputed home page of every user on a 200-million-DAU network fits in **600 GB of RAM**. On the canon's 128 GB box — call it ~100 GB usable after headroom — that is 6–8 machines. The whole product, cached, is one rack shelf.

> ⚠️ **Trap** — Storing post *bodies* in each timeline instead of ids: 200 M × 100 × 1 KB = 20 TB — thirty-three times the fleet, holding copies that sit one indirection away. Timelines store pointers, not posts.

Bandwidth, one line: 30k peak opens × 50 KB per response (50 items × 1 KB) ≈ 1.5 GB/s of text egress — a bit over one canon 10 Gbps port (1.25 GB/s) spread across a fleet. Unremarkable, and only because media stayed out of scope.

## Rung 4 — Machines (cache, servers, shards)

**Timeline fleet (Redis).** Two pressures on the same fleet — size by the max. RAM wants 6–8 boxes (600 GB); ops wants 600k peak inserts ÷ 100k ÷ 0.6 ≈ 10. Ops wins: 10 primaries plus a replica each, ~20 boxes, sharded by *reader* id.

**Read path.** An open is a cache read plus hydration — trivial work on the 10k rung:

```
30,000 peak ÷ 10,000 per server ÷ 0.6 ≈ 5 API boxes
```

**Fan-out workers.** Fan-out is the canon's named example of heavy work (~100 QPS/server): 3,000 peak posts/s ÷ 100 ÷ 0.6 = 50 boxes — quietly the biggest stateless fleet in the system, and the standing bill for choosing push. Elastic scaling (average needs ~17) keeps it honest.

**Post store.** Writes: 3,000 peak TPS ÷ 1,000 per SQL node = 3 shards → over-provision to 8 so you never re-shard in a hurry ([Machines & shards](09-machines-and-shards.md)), sharded by *author* id, ×3 replication ≈ 24 boxes. One caveat said aloud: at 180 TB/year provisioned, size — not write rate — reopens the sharding conversation within a year or two. The senior move is aging old posts out of the hot store; feeds only ever read the recent end.

Notice the asymmetry you just built: the same post lives once in a store sharded by **author** and two hundred times in timelines sharded by **reader**. That duplication is not an accident — it is the price of read speed, and the arithmetic above is what justified paying it.

## Rung 5 — Money

Roughly 5 API + 20 timeline + 50 workers + 24 store ≈ 100 boxes ≈ $100k/month, storage a few thousand more — order $50–100k/month depending on how elastically the workers run. A seven-engineer feed team out-costs the hardware. Cost is not this design's conversation; say so and spend the minutes on the fan-out.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 10^8 inserts for one celebrity post = 100 s of the full fleet | pure push is dead — the heads must be pulled |
| 6 M source-reads/s if feeds compute on read | pure pull is dead — the tail must be pushed |
| both deaths at once | **hybrid fan-out** — not chosen, forced |
| worst enqueue: 1 s at a 1 M threshold, 10 ms at 10 k | the threshold is a dial set by the freshness SLA, not by taste |
| 30 B entry vs 1 KB post | timelines are cache-shaped: ids in RAM, bodies hydrated on read |
| 3 k TPS by author vs 600 k inserts/s by reader | two partition keys: post store shards by author, timeline fleet by reader |

Every box in this design is the conclusion of a three-line multiplication. That is what "numbers first" buys: when the interviewer later pokes any component, the defense is arithmetic, not adjectives.

## The pushback round

**Interviewer:** "Your 200-follower average hides the skew. What does the real distribution look like?"

**You:** "A power law — median maybe 50, a fat tail running out to 10^8. But the average and the tail were doing different jobs. Fleet sizing used total inserts per second, which is posts/s × *mean* followers — and the mean is defined by that total, so no amount of skew breaks the fleet math. What the mean cannot see is the maximum, and the maximum is what killed pure push. I used the average to size the fleet and the tail to choose the architecture."

**Interviewer:** "If the median is 50, didn't you over-provision four-fold?"

**You:** "The opposite — sizing by the median builds a quarter of the fleet and watches it drown, because the whales' millions of followers are real inserts the median ignores. Sums follow means. Medians describe the typical user's experience, means size fleets, and maxes choose architectures — three statistics, three different jobs, and this system needs all three said out loud."

That distinction — **averages size fleets; tails choose architectures** — is the senior signal of the entire round.

## Say it in 60 seconds

> "Numbers first, because here they pick the architecture. 200 million DAU, five opens each: a billion feed opens a day — 10,000 a second, 30,000 peak. Half a post per user: 100 million posts a day — 1,000 a second, 3,000 peak. The crux is what one post costs downstream. At 200 average followers, precomputing every timeline is 200,000 inserts a second, 600,000 peak — about ten Redis nodes, fine. But one 100-million-follower account posting once is 100 million inserts — a hundred seconds of that whole fleet for one post — so pure push is dead. Computing feeds at read time instead is 30,000 opens times 200 followees — six million reads a second — so pure pull is dead too. The numbers force the hybrid: push the long tail, pull the few thousand biggest accounts, threshold set by the freshness budget. Bytes are easy — 100 gigabytes of posts a day, and all 200 million timelines fit in 600 gigabytes of RAM because they hold 30-byte ids, not bodies. Call it a hundred boxes, order 100k dollars a month — noise. The number that worries me is the celebrity tail, so I'd design the fan-out threshold first."

## Numbers to keep

- 1 B opens/day = 10 k/s average, 30 k peak; 100 M posts/day = 1 k/s, 3 k peak
- Push: 1 k × 200 = 200 k inserts/s average, 600 k peak → ~10 Redis nodes — ordinary
- The celebrity: 10^8 followers × 1 post = 10^8 inserts = 100 s of the full fleet — push dies on the tail
- Pull: 30 k × 200 = 6 M source-reads/s — pull dies on read amplification
- Threshold 10 k–1 M followers = worst single enqueue from 10 ms to 1 s — the freshness dial
- Timeline entry ~30 B → 200 M × 100 × 30 B ≈ 600 GB of RAM — ids, not bodies
- Averages size fleets; tails choose architectures

## Drills

**Drill 12.1** — Same product, 5M DAU — a national network, not a global one. Does the hybrid still pay, or is pure push fine?

<details><summary>Answer</summary>

```
posts: 5 M × 0.5/day = 2.5 M/day ÷ 10^5 s = 25 posts/s, peak 75/s
push:  75 × 200 followers = 15,000 inserts/s peak — 15% of ONE Redis node
worst case, an account all 5 M follow: 5 M inserts ÷ 10^5 ops/s = 50 s on one node, ~17 s on three
```

Pure push wins. Steady fan-out fits in a sliver of one node, and even the pathological everyone-follows-them account clears in seconds on a three-node fleet — inside the seconds-to-a-minute freshness budget. The hybrid's second read path, merge logic, and threshold machinery buy nothing here. So what: the celebrity problem scales with the tail, and the tail scales with the user base — hybrid fan-out has a minimum viable scale, and naming it ("when biggest-account × insert cost outgrows the freshness budget") beats installing Twitter's architecture at 2.5% of Twitter's size.
</details>

**Drill 12.2** — A 10M-follower account posts during peak. How many extra timeline inserts, and how long does the fan-out take on the 10-node fleet?

<details><summary>Answer</summary>

```
extra inserts:  10^7
fleet ceiling:  10 nodes × 100 k ops/s = 10^6 inserts/s → dedicated, 10 s
peak organic:   600 k inserts/s → headroom = 400 k/s
10^7 ÷ 4 × 10^5/s ≈ 25 s
```

Ten seconds if the fleet drops everything — and everyone else's inserts queue behind it; about 25 seconds riding only the headroom. Double-digit seconds either way, from an account ten times smaller than the 100M whale. So what: this is why the pull threshold sits at 10k–1M, far below 10M — an account like this belongs on the pull side, where its post costs one cache write instead of ten million — and why the push queue needs separate lanes, so one big enqueue can never starve the tail.
</details>

**Drill 12.3** — The interviewer adds: "A feed must include any post made in the last 5 seconds." Which side of the hybrid breaks?

<details><summary>Answer</summary>

The push side. Pull is fresh *by construction* — above-threshold posts are read at open time. Push freshness equals queue depth, and the SLA now caps it:

```
backlog budget: 5 s × 10^6 inserts/s (full fleet)  = 5 M inserts
one just-under-threshold account (T = 1 M) posts   = 10^6 inserts — 20% of the budget
peak organic load                                  = 600 k/s — over half of throughput already spoken for
```

Three big-but-not-celebrity posts in one burst, on top of peak organic load, and the queue silently blows the 5-second promise — no error, just stale feeds. The recovery is the dial: lower the threshold (at T = 10 k the worst single enqueue is 10 ms of fleet) so more accounts ride the always-fresh pull path, and accept heavier read-time merges. So what: tightening the freshness SLA moves the dial toward pull — the threshold is not a constant, it is the point where the SLA and the fan-out arithmetic intersect. That sentence is the chapter.
</details>
