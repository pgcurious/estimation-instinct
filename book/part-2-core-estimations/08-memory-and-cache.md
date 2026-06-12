# 8 — Memory & cache

*A latency budget is an argument about which tier serves the hot path. This chapter argues the RAM side — and counts what it costs.*

## The question this chapter answers

A response feels instant inside 100 ms — and a modern page is not one lookup, it is twenty: session, profile, twenty items hydrated by id, a few counters. Served from an indexed SQL table at 5 ms per read, a dependent chain of twenty lookups costs 100 ms — the entire human budget, spent before a single pixel renders. The same twenty from Redis at 0.5 ms cost 10 ms. Fanning calls out in parallel softens the chain, but dependency edges keep several round trips in series, and the tier you read from still sets the floor. RAM versus disk-backed storage is one order of magnitude on the only path the user can feel.

So rung 4 of [the Ladder](../part-1-foundations/04-the-ladder.md) starts here: **what must live in RAM for the latency budget to hold, and how much RAM is that?** Two outputs: bytes (the working set) and boxes (the fleet). Plus a third worth more than both — what the database no longer has to do. Servers and shards, the rest of rung 4, are [next chapter](09-machines-and-shards.md).

## From first principles

### The working set — cache the fifth, not the whole

You never cache "the data." You cache the slice the world is reading today, and the canon gives that slice a shape: **20% of objects take 80% of reads.** A street vendor in any Indian bazaar runs this arithmetic without naming it — the cart holds twenty items within arm's reach; the godown across town holds everything he owns. He doesn't stock one of everything; he stocks what this corner buys this week, and the skill that feeds his family is choosing the twenty. Your Redis fleet is the cart. The database is the godown. Sizing the cart to the godown is this chapter's first trap.

The 80/20 law has two working forms:

```
form A — traffic: cache ≈ 20% × daily reads × object size          (formula 5)
form B — corpus:  cache ≈ (20% × distinct objects) × object size
```

Form A is easiest when you've already walked the traffic rung — daily read volume falls out of QPS × size, and one more ×0.2 finishes the job. It counts repeated reads of the same object as new bytes, so it over-sizes when traffic is concentrated: an error in the safe direction. Form B is easiest when the corpus is enumerable — 500M products, 200M profiles — and trusts the 80/20 shape directly. Compute the one whose inputs you actually hold; when you hold both, compute both — agreement buys confidence, and disagreement tells you the access pattern is unusual and worth a sentence.

### Hit-rate arithmetic — what *h* buys, and for whom

Put a cache in front of a database and every read becomes a weighted coin flip: a hit costs a Redis GET at 0.5 ms; a miss costs the indexed SQL query behind it at 5 ms.

```
effective latency = h × 0.5 ms  +  (1 − h) × 5 ms

h = 0.80:  0.8 × 0.5 ms  + 0.2 × 5 ms   = 0.4 + 1.0   = 1.4 ms
h = 0.90:  0.9 × 0.5 ms  + 0.1 × 5 ms   = 0.45 + 0.5  ≈ 1 ms
h = 0.99:  0.99 × 0.5 ms + 0.01 × 5 ms  ≈ 0.5 + 0.05  ≈ 0.55 ms
```

Read the table twice. First: misses own the average — at h = 0.8, one fifth of the requests contributes 70% of the total wait. Second: pushing 80% to 99% improves the average barely 2.5×. If average latency were the prize, the last nine would hardly be worth buying.

It isn't the prize. Two consequences matter more. Pages first: a 20-lookup page renders miss-free with probability h^20 — at h = 0.8 that's 0.8^20 ≈ 1%, so essentially every page eats at least one 5 ms miss, and page latency is database latency wearing a cache-shaped costume. At h = 0.99, ≈ 80% of pages never touch the database at all.

Then the database's day:

```
DB read QPS = total read QPS × (1 − h)

30 k peak, h = 0.90:  30 k × 0.10 = 3,000 QPS  → 60% of one 5 k-read SQL node
30 k peak, h = 0.99:  30 k × 0.01 =   300 QPS  →  6% of one node
```

The move the user barely feels — 90% to 99% — cuts the database's load 10×. That is routinely the difference between sharding the database and not, between a migration project and a quiet quarter. **The cache's job is to shrink the database's job.** Sub-millisecond reads are the visible win; the invisible one is the database living ten times longer before it needs surgery.

> ⚡ **Instinct check** — Your cache serves 60 k peak QPS at h = 0.95. What does the database see? … 60 k × 0.05 = 3 k QPS — under one node's 5 k read ceiling. Misses, not hits, size the database.

One discipline before promising any *h*: hit rate is a property of the access pattern, not of your ambition. Skewed 80/20 traffic hands a hot-20% cache its ~80%; flatter traffic hands it less — the traps section prices that mistake.

### Sizing the fleet — ops or bytes, one of them binds

The canon cache node is the commodity 128 GB box doing ~100k ops/s — RAM-bound, not CPU-bound. You don't get all 128 GB: allocator fragmentation leaves slack in every allocation, replication buffers want room, and the fork-to-snapshot moment copy-on-writes dirty pages. Keep ~25% headroom and call usable RAM **~100 GB per 128 GB box** — a planning number, not a law; state it as an assumption.

```
nodes = max( peak ops ÷ 100 k ops/s , working-set bytes ÷ 100 GB )
```

Two ceilings; one binds. A session store for 50M users is RAM-bound — a hundred gigabytes moving at a few thousand ops, CPUs idle. A counter fleet during a cricket final is the inverse — megabytes of data at hundreds of thousands of ops, bought entirely for throughput, RAM nearly empty.

> 🎯 **In the room** — Don't just give the node count; name the binding ceiling: "three nodes, bound by RAM — ops headroom is 10×." It tells the interviewer which growth is free (traffic, until ops catch up) and which costs money (working set), and it sets up the follow-up you want — bigger boxes, or a shorter TTL to shrink the set. An unexplained node count invites suspicion; a named bound invites a conversation.

### The four tenants — what actually lives there

Four tenants account for nearly every byte of application cache you will ever size:

| Tenant | Sizing pattern | One computed line |
|---|---|---|
| Sessions | DAU × ~1 KB | 20 M DAU × 1 KB = 20 GB |
| Hot rows | hot 20% of corpus bytes | 200 M rows × 1 KB = 200 GB → 40 GB hot |
| Rendered pages / fragments | hot pages × (items × row size) | 1 M hot pages × 20 × 1 KB ≈ 20 GB |
| Counters | count × (8 B value + ~100 B tax) | 100 M counters × ~108 B ≈ 10 GB — not 0.8 GB |

Sessions are the gentlest tenant — one key per active user, written at login, read on every request. Fragments earn their RAM twice: one GET replaces the whole 20-lookup fan-out, paid for in staleness, which TTL prices below. And the counter line is deliberately rude — ~10 GB to hold 0.8 GB of integers, more than 10× the payload. That tax is the next section.

### The small-key tax

Redis spends structure on every key, and nobody estimates it. Count it in pointer money: the hash-table entry alone is three 8 B pointers; the key and the value each carry a ~16 B object header; the key string stores its own length; give it a TTL and it joins a second table; and the allocator rounds every allocation up to a size class. The pieces sum to ~50–100 B depending on version and encoding — plan with **~100 B per key**.

Now the bomb. A deduplication set — a billion event ids at 16 B each, no values worth mentioning:

```
1 B keys × (16 B id + ~100 B structure) ≈ 116 GB → call it ~120 GB
```

More than a full node of RAM before storing a single value: roughly seven-eighths of the spend is bookkeeping. The antidote is amortization. Bucket ids into hashes — say 1,000 fields per hash — and the per-key structure is paid once per bucket (1 M buckets × ~100 B ≈ 0.1 GB) while small hashes store fields in a packed encoding costing roughly their own bytes: the billion ids collapse toward the ~20 GB they actually are. Batching many small values into one key is the same trick spelled differently. The rule: when the value is smaller than the ~100 B tax, restructure the keys before you buy RAM.

### TTL — the valve on the working set

A TTL bounds the population: only keys touched within one TTL window stay alive, so the TTL is a valve on the working set itself. The session store proves it with canon ratios — a 1-day TTL holds about a day's visitors, DAU × 1 KB; a 30-day "remember me" holds a month's, MAU × 1 KB. At the canon 25% DAU/MAU, one product checkbox is a 4× difference in fleet.

The valve's other side is what expiry does to the database. In steady state, every live key must be refilled once per TTL:

```
refill floor ≈ live keys ÷ TTL

100 M hot keys, TTL = 1 h:    100 M ÷ 3,600 s ≈ 30 k misses/s  → 6 SQL nodes, just refilling
100 M hot keys, TTL = 1 day:  100 M ÷ 10^5 s  =  1 k misses/s  → one node, breathing
```

The TTL just sized your database fleet. Turn the valve one way: longer TTL, more RAM, fewer misses, staler data. Turn it the other: fresher and smaller, and the database pays the difference. A kitchen's mise en place is the same valve — prep bowls filled for exactly one evening's service; prep more and it wilts, prep less and cooks sprint to the cold room mid-rush. When freshness is the real requirement, the senior move is usually not a shorter TTL but invalidation on write: freshness then costs the write rate, which for read-heavy data ([Traffic](05-traffic.md)) is a couple of orders of magnitude below expiry churn — keep a long TTL as the backstop.

### The hierarchy — count every byte once

Your Redis estimate is one tier of four, and a byte belongs to exactly one of them:

- **Tier 0 — the client.** Browser and app caches: bytes served from the user's own device cost you nothing and appear in no estimate. The cheapest infrastructure you own is a `Cache-Control` header.
- **CDN.** Media and static assets — the 200 KB photos, the bundles. Sized and priced in [Bandwidth](07-bandwidth.md).
- **Application cache.** This chapter: sessions, hot rows, fragments, counters — the dynamic and the per-user.
- **DB buffer pool.** The database caches its own hot pages in its own RAM — it is the reason an indexed query costs 5 ms and not a 10 ms disk seek. It comes with the database; know it exists, don't size it in an interview.

The rule the tiers enforce: bytes served by the CDN never reach your Redis estimate. A marketplace's product images were the CDN's bytes the moment they were uploaded; double-count them into the application cache and the fleet inflates 200× — 200 KB of image against 1 KB of row.

## The anchors

| Anchor | Value | Use it when |
|---|---|---|
| Effective read latency | h × 0.5 ms + (1 − h) × 5 ms | any cache-in-front-of-DB read path |
| Database load behind a cache | total read QPS × (1 − h) | sizing the DB tier — the number that matters |
| Working set | 20% of a day's read volume; or hot 20% of corpus × size | formula 5; pick the form whose inputs you hold |
| Cache fleet | max( peak ops ÷ 100 k/s , bytes ÷ ~100 GB usable ) | say which ceiling bound |
| Session store | DAU × ~1 KB | the first tenant in every estimate |
| Per-key structure tax | ~100 B | values smaller than the tax → restructure |
| Steady-state refill | live keys ÷ TTL | the TTL ↔ freshness ↔ DB-load valve |

The latency pair, the 80/20 law, the 100 k ops ceiling, the 128 GB box and the 1 KB row are [cheat-sheet](../appendices/a-cheat-sheet.md) canon; the ~100 GB usable and the ~100 B key tax are this chapter's planning numbers — derived above, stated as assumptions in the room.

## 🧮 Worked example — a 50M-DAU marketplace

Interviewer: *"50M-DAU online marketplace — what does the cache tier look like, and what does it buy us?"*

Spoken: "Three tenants want RAM: sessions, hot catalog rows, and — through the hit rate — the database's survival. Bytes first, then ops, then whichever binds."

```
sessions:    50 M DAU × 1 KB              = 50 GB
catalog:     500 M products × 1 KB        = 500 GB logical
hot rows:    20% of 500 GB                = 100 GB
working set:                              ≈ 150 GB
key tax:     150 M keys × ~100 B          ≈ 15 GB — 10%, inside the rounding
```

"Product images are ~200 KB each, but they're the CDN's bytes ([Bandwidth](07-bandwidth.md)) — not one of them enters this estimate. Traffic: say 20 product reads per user per day."

```
reads: 50 M × 20 = 1 B/day ÷ 10^5 = 10 k QPS average → ×3 ≈ 30 k QPS peak
```

"I'll target a 99% hit rate — defensible because marketplace browsing is heavily skewed toward the front page and bestsellers, and the entire hot 20% fits in RAM. I'll check the failure mode in a second. Fleet:"

```
by ops:    30 k ÷ 100 k ops/s              = 0.3  → 1 node
by bytes:  150 GB × 2 (a year's growth)    = 300 GB ÷ 100 GB usable = 3 nodes
```

"Three nodes, bound by RAM, not ops — ops headroom is 10×. Full at the year-out estimate, so the fourth node is a budget line, not a surprise. Now what the fleet buys:"

```
no cache:        30 k peak ÷ 5 k reads/node = 6 nodes of SQL read capacity
h = 0.99:        30 k × 0.01 = 300 QPS      → 6% of one node
h = 0.90, bad day: 30 k × 0.10 = 3 k QPS    → still one node
```

And the landing, out loud:

> "A three-node cache fleet, bound by RAM not ops. The win isn't the half-millisecond reads — it's the database shrinking from 30k to 300 QPS: one primary and a replica instead of a six-node read fleet, and no shards, since 500 GB sits well under the 2 TB per-node ceiling. Even if the hit rate sags to 90%, the database sees 3k — inside one node. The design survives its own bad day."

## ⚠️ Traps

- **Sizing the cache to total data instead of the working set.** "The catalog is 500 GB, so we need 500 GB of Redis." The number-one oversize, 5× too big — and it tells the interviewer you don't believe the 80/20 law you just cited. Cache the fifth.
- **Promising 99% over a flat access pattern.** Hit rate tracks skew, not ambition. Uniform random reads — id sweeps, batch exports, crawlers walking the long tail — give a hot-20% cache roughly 20%, and your "cache" is a RAM-priced disk. Check the pattern before promising the number.
- **Forgetting the key tax.** A billion 16 B ids is ~120 GB before the first value lands. Whenever values are smaller than ~100 B, the structure outweighs the data — bucket into hashes, then estimate.
- **Caching write-hot data.** Every write is an invalidation plus a refill. At 100:1 read:write ([Traffic](05-traffic.md)), 99 hits ride each fill; at ~1:1, the cache does double work for almost no hits — churn eats the win. Cache the read-heavy; let the write-heavy pass through.
- **Counting CDN bytes twice.** Media the CDN serves never transits the application cache. Size Redis for 200 KB images instead of 1 KB rows and you've provisioned a 200× phantom fleet.

## Numbers to keep

- Effective latency = h × 0.5 ms + (1 − h) × 5 ms → 1.4 / ~1 / ~0.55 ms at 80 / 90 / 99% — misses own the average
- The real prize: DB QPS = total × (1 − h); 90% → 99% cuts database load 10× — the cache's job is to shrink the database's job
- Working set: 20% of a day's read volume (formula 5), or hot 20% of corpus × size — use the form whose inputs you hold
- Fleet = max( peak ops ÷ 100 k/s , bytes ÷ ~100 GB usable per 128 GB box ) — and say which ceiling bound
- Sessions = DAU × ~1 KB; key tax ≈ 100 B/key — a billion tiny keys ≈ 120 GB of pure structure
- Refill floor = live keys ÷ TTL — the TTL is a valve trading RAM and DB load against freshness
- A byte lives at one tier: client → CDN → application cache → buffer pool; CDN bytes never enter the Redis estimate

## Drills

**Drill 8.1** — A fintech super-app has 80M MAU with typical stickiness. Size its session store. The PM then ships "stay signed in for 30 days" — resize it.

<details><summary>Answer</summary>

```
DAU:         80 M × 25% = 20 M
1-day TTL:   20 M × 1 KB = 20 GB
30-day TTL:  ~a month's visitors = 80 M × 1 KB = 80 GB
```

The user count never moved; the TTL quadrupled the store — DAU vs MAU is the canon 4×. So-what: session stores are sized by TTL policy as much as by users, and even 80 GB fits under one node's usable RAM — sessions ride along with the row cache and almost never deserve their own fleet.
</details>

**Drill 8.2** — A read path peaks at 300k QPS through cache. Compare h = 0.90 against h = 0.99: database nodes (5k reads each) and effective per-read latency. Which difference does the user notice, and which does the on-call engineer notice?

<details><summary>Answer</summary>

```
h = 0.90:  DB sees 300 k × 0.10 = 30 k QPS → 30 k ÷ 5 k = 6 nodes
           latency = 0.9 × 0.5 ms + 0.1 × 5 ms          ≈ 1 ms
h = 0.99:  DB sees 300 k × 0.01 = 3 k QPS  → 1 node at 60%
           latency = 0.99 × 0.5 ms + 0.01 × 5 ms        ≈ 0.55 ms
```

The user gets ~2× — sub-millisecond either way, barely perceptible. The engineer gets a six-node read fleet collapsing to one. The last nine of hit rate belongs to the database; that's why you buy it.
</details>

**Drill 8.3** — A payments pipeline keeps a dedup guard: 2B transaction UUIDs (16 B each), one Redis key per id, value an 8 B first-seen timestamp. RAM? Then re-estimate with ids bucketed into hashes of ~1,000 fields.

<details><summary>Answer</summary>

```
naive:     2 B × (16 B + 8 B + ~100 B structure) ≈ 2 B × 124 B ≈ 250 GB → 3 nodes
bucketed:  2 M bucket keys × ~100 B              ≈ 0.2 GB
           2 B fields × ~24 B payload (packed)   ≈ 50 GB        → 1 node
```

The data was always ~50 GB; the other ~200 GB was structure. So-what: when values are this small, the layout sizes the fleet, not the data — amortize the key tax before buying nodes, and say which bound you removed: this store was RAM-bound, and the RAM was mostly bookkeeping.
</details>

**Drill 8.4** — A cricket app serves live scores: ~2M distinct score objects (~1 KB each), and a big match draws 100M reads/hour with wickets synchronizing everyone. Ops-bound or RAM-bound, and how many nodes?

<details><summary>Answer</summary>

```
RAM:  2 M × 1 KB = 2 GB                          → nothing
ops:  100 M ÷ 3,600 s ≈ 30 k QPS sustained
      wicket spike, event-driven ×10 ≈ 300 k QPS → 300 k ÷ 100 k = 3 nodes
```

Ops-bound by two orders of magnitude — three nodes carrying 2 GB. The deeper ceiling: one mega-match's key can approach 100k ops/s on its own, and a single key lives on a single node — past that you replicate the value or cache it in-process on the API tier; you cannot shard one key. Scoreboard-shaped data — few keys, everyone reading — is always ops-bound.
</details>

**Drill 8.5** — A marketplace caches 20M rendered category-page fragments with a 1-hour TTL. The PM wants pages no staler than 1 minute. What does TTL-only freshness cost, and what's your counter-offer?

<details><summary>Answer</summary>

```
TTL = 1 h:    20 M ÷ 3,600 s ≈ 6 k regenerations/s     (each one is several DB reads)
TTL = 1 min:  20 M ÷ 60 s    ≈ 330 k regenerations/s   → dead on arrival
```

TTL-driven freshness costs keys ÷ TTL — inverse, and brutal at scale. Counter-offer: invalidate on write. Fragments change when a seller edits or a price moves — say 2M edits/day ÷ 10^5 ≈ 20 invalidations/s — four orders of magnitude cheaper than 330k expiries. Freshness should ride the write rate, not the clock; keep the long TTL as a backstop for missed events.
</details>

---
[← Previous: Bandwidth](07-bandwidth.md) · [Table of contents](../../README.md) · [Next: Machines & shards →](09-machines-and-shards.md)
