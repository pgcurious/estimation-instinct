# 30 — A real-time leaderboard

*Every match writes into one sorted structure and every player reads the top of it — the whole design is a fight over that single hot ordering.*

## The prompt

> "Design a real-time global leaderboard for a popular mobile game — the top players, and every player's own rank. Put numbers on it first."

The structure picks itself: a sorted set. Every candidate reaches for Redis ZSETs within a minute, and the interviewer expects it. So the round is not graded on naming the data structure — it is graded on whether your numbers show you *why one global sorted set is exactly the wrong shape*, and what the arithmetic forces instead. A leaderboard looks like a read problem and is a write problem; it looks like one ranking and must become thousands. This walkthrough is where those two inversions get derived rather than asserted.

## Scope it in 60 seconds

Three questions change the numbers; the third changes the architecture.

1. **One global ranking, or segmented — region, friends, skill tier?** This decides whether there is a single ordered list or tens of thousands of them. Assume the interviewer wants global standings *plus* per-region and friends boards. Hold that — it turns out to be the escape hatch, not a feature request.
2. **How fresh must a rank be?** Live within seconds for the top, eventual for the tail is a typical answer. File the number; it caps how far behind the write stream is allowed to run.
3. **Exact rank for everyone, or exact at the top and approximate below?** The load-bearing one. Get: exact for the top-N and for the handful around each player, but "top 12%" is acceptable deep in the tail. Flag it and get it on record — it decides whether one un-shardable key is mandatory or optional.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| DAU | 50 M | given as order-of-magnitude; canon 25% DAU/MAU → ~200 M MAU, propose it |
| Matches per active/day | 10 → 500 M/day | short mobile rounds; casual + hardcore averaged, the frequent verb |
| Leaderboard views/day | 5 → 250 M/day | you glance at rank occasionally, not after every round |
| Registered players | ~200 M | everyone who could appear in a ranking = MAU |
| Score entry | id + score = 24 B → ~50 B in Redis | UUID 16 B + int64 8 B; skiplist/dict overhead ~doubles it (derived) |
| Match record | ~1 KB | canon default row |
| Read:write | **~1:2 — write-heavy** | every match writes; checking is rarer — the inverted ratio is the whole story |

## Rung 1 — Users

50 M DAU, and canon's 25% DAU/MAU puts registered players near 200 M — the population that could ever occupy a rank. The 10% concurrency rule says ~5 M people are mid-match right now. Nothing exotic in the counts, but notice the shape immediately: this system has one incessant verb (finishing a match, which *writes* a score) and one occasional verb (glancing at the board, which *reads* it) — and here the incessant verb is the write. Almost every system in this book reads far more than it writes. This one is upside down, and that single fact is where the design pressure will come from.

## Rung 2 — Actions (traffic)

```
writes: 200 M... no — 50 M DAU × 10 matches/day = 500 M/day ÷ 10^5 = 5,000 writes/s  × 3 ≈ 15,000/s peak
reads:  50 M DAU × 5 views/day  = 250 M/day ÷ 10^5 = 2,500 reads/s  × 3 ≈  7,500/s peak
```

Split them and interpret, because the ratio is the finding. Reads to writes is about **1:2** — the leaderboard *writes more than it reads*. Set that against the canon feed ratio of 100:1 and it is inverted by two hundred-fold. A feed is a read amplifier; a leaderboard is a write amplifier, because playing is more frequent than checking. So the expensive path here is the write — the score update — not the query. Every other walkthrough spends its energy on the read fan-out; this one must spend it on the write.

One more factor to name now: games are event-driven. A weekend tournament or a new-season launch compresses play into hours — canon's ×10, not ×3. Hold 15k/s as the diurnal peak and 50k/s as the event peak; the difference between them is exactly where a single sorted set dies.

### The signature sub-question — does one global sorted set survive the write rate?

The natural structure is a Redis sorted set: `ZADD` to update a score (O(log N)), `ZREVRANGE 0 K` for the top-K (cheap), `ZRANK` for a player's position and `ZRANGE` around it for "around me." Canon ceiling: 100k ops/s per Redis node. So price the one global set on both axes it can fail on.

**Memory first**, because it's quick and it's a trap:

```
200 M players × ~50 B/entry = 10 GB       → a thirteenth of one 128 GB box
even 1 B registered players × 50 B = 50 GB → still one box
```

Memory says a single global sorted set holding every player on Earth fits on one machine with room to spare. That is the seductive wrong answer.

**Now ops** — and here is the whole problem:

```
15,000 writes/s + 7,500 reads/s ≈ 22,500 ops/s  → on ONE key, ONE node
against 100 k ops/s per node                     → ~22% of one core
```

At baseline it survives — a fifth of one core. But a single Redis key is a single shard is a single thread, and **you cannot buy your way past 100k ops/s on one key, because a key does not split.** Every other ceiling in this book is relieved by adding nodes; this one is not. You are running the entire global ranking on one CPU core with a hard roof and zero horizontal escape. At event scale that roof arrives:

```
event peak: 5,000 × 10 = 50,000 writes/s + a read spike on the same hot top-N
            → 50k–70k ops/s on one core, ceiling 100k → inside the wall, no node adds relief
```

> ⚡ **Instinct check** — Two Redis nodes give you 200k ops/s of headroom. Why does that not save the single global sorted set? Answer before reading on.

Because a second node holds a *different* key, and there is only one global ranking — one key. This is a university merit list nailed to a single board outside the exam hall. Ten thousand students converge on that one sheet, and you cannot clone the board without cloning the crowd. Yet only the top names are read as ranks — the gold medallist is exactly first, the top ten matter for admissions — while the student who placed eight-thousandth reads a *band*, "First Division," and goes home. And no clerk can revise the list while the crowd is pressed against it. Every university already found the fix: post department-wise boards, not one, and print bands, not positions, for everyone below the top.

Split the hot key by *direction* the way the news-feed chapter did. The global top-100 is read by everyone → a hot **read** key → clone it onto read replicas, which serve the same list cheaply. But 15k writes/s cannot be replicated away — **hot reads replicate, hot writes do not.** The write stream has to physically land somewhere single-threaded, and one key means one thread. So the writes force the move:

**The forced move.** Shard the *write surface* by segment — region × skill tier, plus friends — so each score update lands in a bounded set of a few hundred thousand players instead of the one global key. Now write throughput scales with money: fifty segment keys across the fleet give fifty cores, not one. The single live global ranking becomes an *approximate roll-up* — a periodic merge and a percentile histogram — not a key every match hammers. Exact ranks survive only where they are bounded and actually read: the top-N, and the small neighborhood around each player.

> 🎯 **In the room** — Everyone says "Redis sorted set." The senior tell is the next sentence: *"—but one global set is a single core with a hard 100k ceiling and no shard escape, so I'll segment the write surface and keep exact rank only for the top-N."* One candidate names a data structure; the other names its failure mode and routes around it.

## Rung 3 — Bytes (storage & bandwidth)

**Serving state (Redis).** A ZSET entry is the player id and the score — nothing else belongs in the hot path:

```
id (UUID) 16 B + score (int64) 8 B = 24 B logical
Redis skiplist node + dict entry ~doubles a small member → ~50 B (derived, not a new anchor)
200 M players × 50 B = 10 GB     → one box holds every ranking, memory-wise
```

Ten gigabytes for the precomputed rank state of a 200-million-player game. Say it plainly, and echo the rate-limiter: **RAM is a rounding error here; the shards exist for throughput and hot-key contention, never for capacity.**

**Durable source of truth.** Redis is the serving layer, not the ledger — a lost node must not lose scores. The authoritative current score per player is a plain KV row:

```
200 M players × 1 KB × 5 (replication + overhead) = 1 TB provisioned → one node's worth
```

One terabyte of current-score truth, plus periodic Redis snapshots, means a wiped cache rebuilds from durable storage instead of from panic. The match *history* firehose is separate and larger — 500 M matches/day × 1 KB × 5 = 2.5 TB/day — but that is an event log to Kafka and object storage, aged out, not the serving path. Naming it and setting it aside is the point.

**Bandwidth.** A board response is the top-100 plus the ~20 around you, each row an id, a name, and a score:

```
egress: 7,500 reads/s × ~10 KB/response ≈ 75 MB/s  → under one 1 Gbps port (125 MB/s)
ingress: 15,000 writes/s × ~100 B/score ≈ 1.5 MB/s → noise
```

Trivial in both directions — a leaderboard is a compute-and-ordering problem, not a bandwidth one. Say "trivial" and never mention it again.

## Rung 4 — Machines (cache, servers, shards)

**Redis serving fleet.** Sized by ops and hot-key contention, not by the 10 GB. Shard the write surface by region × tier so no single key carries the full stream; replicate the global top-N as a read-only hot list. A handful of primaries plus a replica each — call it ~6 boxes — carries baseline comfortably and absorbs events because the write load is now spread across keys instead of pinned to one core.

**Ingest tier (the write path).** Each match end does a `ZADD` plus a durable write plus a Kafka emit — typical business logic:

```
15,000 peak writes/s ÷ 1,000 per server ÷ 0.6 ≈ 25 servers   → the biggest stateless fleet, because writes dominate
```

That the *write* tier is the largest fleet is the rung-2 inversion showing up in hardware. In the feed chapter the fan-out workers were biggest; here it is plain ingest, for the same reason — the frequent verb pays.

**Read API.** Mostly cache hits on the hot lists — trivial-to-typical work:

```
7,500 peak reads/s ÷ 1,000 per server ÷ 0.6 ≈ 13 servers
```

**Durable KV store.** Writes are the wall, so size by them — and note the contrast with Redis:

```
15,000 writes/s ÷ 10,000 (NoSQL LSM/node) = 2 nodes × 3 replication ≈ 6 boxes, sharded by PLAYER id
```

Sharded by player id, the 15k writes spread evenly across nodes — **no hot key**, because nothing here needs global order. The hot key existed *only* in Redis, and *only* because a single sorted set imposes a single ordering. Order is the thing that refuses to shard.

**Match-history log.** 15 MB/s against a 100 MB/s Kafka broker → one broker, three for redundancy, aged to object storage.

**Cache and the tail.** Canon's cache rule — 20% of a day's reads — is the hot top-N lists everyone stares at: a tiny set of hot keys served from replicas, the read-side twin of the celebrity list. And the long tail gets no per-player rank maintained at all: a score **histogram** of ~1,000 buckets, refreshed periodically, answers "what percentile is this score?" in O(1). The player ranked four-millionth reads "top 2%" from the histogram, never a `ZRANK`.

## Rung 5 — Money

```
~25 ingest + 13 read + 6 Redis + 6 KV + 3 Kafka ≈ 50 boxes × $1k ≈ $50k/month
storage: 1 TB serving truth + history aging out    → a few thousand
egress:  75 MB/s                                    → tiny
```

Order **$50k/month**, and it is noise against a popular mobile game grossing millions. Cost is not this design's conversation; say so and spend the minutes on the hot key, which no amount of money fixes on a single ordered set.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| read:write ≈ 1:2, inverted from the feed's 100:1 | the write is the problem — size the ingest tier, not the read tier |
| 10 GB of state fits on one box | never argue memory; capacity is not why you shard |
| 22k ops/s baseline but on **one un-shardable key** | a single global sorted set has a hard 100k ceiling with no horizontal escape |
| event ×10 → 50k+ ops/s on one core | the tournament, not the average, is what kills the single key |
| hot reads replicate, 15k hot writes do not | shard the *write surface* by segment; clone the top-N for reads |
| 8 KB histogram vs a globally-ordered set | approximate rank for the tail is O(1); exact rank stays only at the bounded top |
| 1 TB durable truth + snapshots | Redis is the serving layer, not the source of truth |

## The pushback round

**Interviewer:** "Memory fits in one box — 10 GB. Why not just run one global sorted set and keep it simple?"

**You:** "Because memory was never the constraint — ops on a single key are. One Redis key lives on one shard on one thread, capped at 100k ops/s, and nothing you add relieves it: a second node holds a different key, and there's only one global ranking. At 22k ops/s baseline it looks fine, but a tournament is a ×10 event — 50k writes a second plus a read spike on the same hot top-N — and now you're inside a ceiling with no escape and a single failure point. Segmenting the write surface by region and tier turns one core into fifty and makes throughput scale with money. The simple design is the one that pages you during your biggest revenue event."

**Interviewer:** "Players want their exact global rank, live. Your histogram gives them a percentile band — they'll hate it."

**You:** "Exact rank as a *read* is cheap — one `ZRANK`, O(log N), about thirty comparisons. What's expensive is *maintaining* exact global position for 200 million players under a write firehose, because every score change reshuffles ranks below it, and total order is exactly the property that refuses to shard. So I buy exactness where it's seen: the top-N, where being 4th versus 5th is the product, stays an exact sorted set; the neighbourhood around each player, a local `ZRANK` in their segment, stays exact too. The player ranked four-millionth genuinely cannot tell 3,988,201st from 4,012,540th — 'top 2%' from an 8 KB histogram is the same information at six orders of magnitude less cost."

**Interviewer:** "So where's the line?"

**You:** "The head needs a sorted set; the tail needs a histogram — same scores, two structures, because rank precision is a *product* feature only at the top. You don't maintain exactness where no one reads it. It's the leaderboard's version of the rule that averages size fleets and tails choose architectures: here the top chooses the sorted set and the tail chooses the histogram, and pretending both need the same structure is what forces the one un-shardable key nobody can afford."

That distinction — **rank exactness is bought where it's seen, not maintained where it isn't** — is the senior signal of the round.

## Say it in 60 seconds

> "Numbers first, because they invert the obvious design. 50 million DAU, ten matches each — 500 million score writes a day, 5,000 a second, 15,000 peak, and 50,000 during a tournament. Only 250 million views — this thing writes more than it reads, backwards from a feed, so the write is the problem. The natural structure is a Redis sorted set, and memory says one global set is fine: 200 million players at 50 bytes is 10 gigabytes, one box. But that's the trap — a single key is a single core with a hard 100k-ops ceiling and no shard escape, so at a ×10 event it's dead with no way to buy out. Hot reads on the top-100 I can replicate; 15,000 hot writes I cannot, so I shard the write surface by region and tier — fifty keys, fifty cores, throughput that scales with money — and keep exact rank only for the bounded top-N and the neighbourhood around each player. The four-millionth-place tail gets 'top 2%' from an 8-kilobyte histogram, O(1), no per-player rank maintained. Redis is the serving layer, not the truth — one terabyte of durable scores plus snapshots behind it. About 50 boxes, 50k a month, noise. The number that worries me is 50,000 writes a second funnelling into one un-shardable key, so I'd design the segment sharding first."

## Numbers to keep

- 500 M matches/day = 5k writes/s, 15k peak; 250 M views/day = 2.5k reads/s, 7.5k peak — **read:write ≈ 1:2, write-heavy**
- Event ×10 → ~50k writes/s: the tournament, not the average, breaks the single key
- One global ZSET = one key = one core = hard 100k ops/s ceiling, **no horizontal escape** — a key does not split
- 200 M × ~50 B = 10 GB — every ranking fits on one box; memory never forces the shard
- Hot reads replicate (clone the top-N); hot writes don't (segment the write surface)
- Exact rank for the top-N + around-me; **histogram (~8 KB, O(1)) for the tail** — precision only where it's read
- 1 TB durable truth + snapshots — Redis serves, it does not own

## Drills

**Drill 30.1** — A weekend tournament drives match rate to ×10 for three hours. What breaks on a single global sorted set, and does the segmented design hold?

<details><summary>Answer</summary>

```
event writes: 5,000/s × 10 = 50,000 writes/s + a read spike on the hot top-N
one global key: ~50k–70k ops/s on ONE core, ceiling 100 k → at the wall, and NO node adds relief
segmented (say 50 active region×tier sets): 50,000 ÷ 50 ≈ 1,000 writes/s per key → ~1% of a node each
```

The single key doesn't crash gracefully — it saturates one thread and latency climbs on every update and every top-N read at once, during your highest-revenue window. The segmented design spreads the same 50k across cores, so each key idles at 1%. So what: sharding converts an un-scalable single-core ceiling into a money-scalable fleet, and the *event* is what makes the hot key fatal — sizing on the average would have hidden it entirely.
</details>

**Drill 30.2** — Add a friends leaderboard: each player ranks against ~200 friends. Does this need a set per friend-group?

<details><summary>Answer</summary>

No — a per-group set for every player is 200 M tiny duplicated sets. Compute it on read instead: fetch each friend's score and sort 200 in the app.

```
say 20% of views are friends boards: 250 M × 20% = 50 M/day ÷ 10^5 = 500/s → 1,500/s peak
each does ~200 score lookups: 1,500 × 200 = 300,000 ZSCORE/s ÷ 100 k per node ≈ 3 Redis nodes
```

A 200-way scatter-gather — read amplification, like a pull feed — but bounded by the *group size*, not the player base: sorting 200 scores is trivial, and the friend set changes slowly so the sorted result caches well. So what: a friends board shards by construction — the small segment *is* the shard — which is exactly the "segment to spread load" move applied to the read side.
</details>

**Drill 30.3** — Product insists every player sees an *exact* live global rank. What does that cost versus the histogram, and where do you draw the line?

<details><summary>Answer</summary>

```
exact global rank: needs ONE totally-ordered set of 200 M → one un-shardable key
                   merging ranks across shards loses total order, so you cannot segment it away
                   → back to the single 100 k-ops core with no event headroom
approximate: score histogram, ~1,000 buckets × 8 B = 8 KB
             each write = +1/−1 on a bucket (O(1)); rank = cumulative count below your score
```

Exact global rank re-creates precisely the single hot key the whole design exists to avoid — six orders of magnitude more expensive in contention for information no tail player can perceive. So what: keep the exact sorted set for the bounded top-N (where 4th-vs-5th is the product) and the local neighbourhood (a cheap in-segment `ZRANK`), and serve everyone else a histogram percentile. Exactness is bought per rank-position, not granted per system — the line sits wherever the number stops being read.
</details>
