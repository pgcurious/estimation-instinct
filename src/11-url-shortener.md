# 11 — URL shortener

*The classic opener: a system small enough to estimate completely — which is exactly why interviewers use it to check whether your numbers drive decisions or decorate them.*

## The prompt

> "Design a URL shortener like bit.ly. Start by putting some numbers on it."

The most common opener in system design rounds, and it is graded backwards from what candidates expect. Nobody fails it on arithmetic. They fail it by over-designing — sixteen shards and a message bus for a system that fits on a laptop — or by missing the one sub-question that is genuinely large. Three minutes of numbers, out loud, prevents both.

## Scope it in 60 seconds

Four questions change the numbers. Ask them before multiplying anything.

1. **Is click analytics in scope?** If yes, every redirect becomes an event you store — hold that thought; it will turn out to be the real system.
2. **Do links expire?** Retention is the storage multiplier. Forever versus 90 days is a 20× difference by year five.
3. **Custom aliases?** Vanity codes are a tiny namespace with product consequences (drill 11.3).
4. **What's the redirect latency target?** "Feels instant" means inside the human 100 ms budget — that decides which tier serves the hot path.

Assume the interviewer answers: analytics later, links live forever, vanity codes exist but are rare, redirects must feel instant. Numbers on the table.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| New links | 100 M/month | bit.ly-scale public shortener; propose it, get the nod |
| Read:write | 100:1 | the canon default for URL shorteners and content systems |
| Redirects | ~4 k/s average, ~12 k/s peak | derived below; global traffic, peak ×3 |
| Stored record | ~500 B | URL is ~100 B; round the full row up for the long tail |
| Retention | ~forever; plan 5 years | links must not die; 5 years is the planning horizon |
| Latency target | redirect inside 100 ms | the human "instant" budget |

## Rung 1 — Users

This system bends the top rung. Demand isn't driven by DAU — it arrives as *links created* and *links clicked*, mostly by people who will never hold an account. The Ladder doesn't care. The top rung's job is "how much demand shows up, and how peaky?"; only the noun changes, from users to links. So state the base in the system's native unit and get the nod: "Say 100 million new links a month — large public shortener territory. Reasonable?"

A wrong base here poisons every rung below, same as a wrong DAU would. The nod is not politeness; it's a checkpoint.

## Rung 2 — Actions (traffic)

Split writes from reads immediately — at 100:1 they live different lives.

```
writes: 100 M/month ÷ 2.5 × 10^6 s/month = 40 writes/s     peak ×3 ≈ 120/s
reads:  40 writes/s × 100                = 4,000 redirects/s average
peak:   4,000 × 3                        ≈ 12,000 redirects/s
```

Interpret as you go: the write side is nothing — 40 inserts a second. The read side is real but modest, and 100:1 read-heavy means this is a caching problem, not a database problem. Everything below follows from those two sentences.

## Rung 3 — Bytes (storage & bandwidth)

What does one link keep? The canon says a URL is ~100 B. Add a short code, an owner id, two timestamps — ~130 B of payload — then row overhead, an index on the code, and the long tail of 1–2 KB monster URLs. Round the full row to 500 B and say you rounded generously.

But that row contains a field whose size you haven't earned yet: the short code. How long must it be?

### The signature sub-question — how long is the code?

A short code is a cloakroom token: a tiny tag standing in for a big coat, and the whole trick is that the counter must never run out of token numbers. Codes use base62 — a–z, A–Z, 0–9 — so length 7 gives 62^7 of them. Do that in your head by rounding 62 down to 60:

```
62^7 ≈ 60^7 = 6^7 × 10^7
6^7:  36 → 216 → 1,300 → 7,800 → 47 k → 280 k    (6^2 through 6^7, each ×6)
→ 280 k × 10^7 ≈ 3 × 10^12       (62→60 under-counts ~20%; true value 3.5 × 10^12)
```

Call it ~3.5 trillion codes. Now demand:

```
100 M/month × 120 months = 12 B links in 10 years = 1.2 × 10^10
headroom: 3.5 × 10^12 ÷ 1.2 × 10^10 ≈ 300×
```

Seven characters outlast the company by two orders of magnitude. Check six: 62^6 ≈ 5.7 × 10^10 — 57 billion, under 5× headroom against the same decade. Uncomfortably close — one viral integration eats it. So: fixed-length 7, decided by arithmetic, not taste.

> 🎯 **In the room** — "How long should the code be?" is the most-asked estimation sub-question in this entire problem. The 62→60 rounding trick, performed out loud, is precisely the fluency being graded.

**Storage.** Now the chain:

```
100 M/month × 500 B           = 50 GB/month logical
× 5 (replication + overhead)  = 250 GB/month provisioned
× 12                          ≈ 3 TB/year → ~15 TB over 5 years
```

**Bandwidth.**

> ⚡ **Instinct check** — 12 k QPS × 500 B: how many MB/s? Answer before reading on.

```
12,000 QPS × 500 B ≈ 6 MB/s peak
```

A 1 Gbps port carries 125 MB/s. Say "bandwidth is trivial" in those words and never mention it again — knowing what not to compute further is part of the signal.

## Rung 4 — Machines (cache, servers, shards)

**Servers.** A redirect is a key lookup plus a 301 — trivial work, the 10k rung of the 100/1k/10k rule:

```
12 k peak ÷ 10 k per server ÷ 0.6 utilization = 2 → run 3 for redundancy
```

**Cache.** Size it from a day's read volume:

```
daily reads:  4 k/s × 10^5 s = 400 M clicks/day
read volume:  400 M × 500 B  = 200 GB/day
hot 20%:      ≈ 40 GB        → one Redis node
```

A 128 GB box holds the working set with room to spare, and 12 k peak ops is an eighth of one node's 100 k ops/s ceiling. One cache node, plus a replica for failover, ends the conversation.

**Shards.** Two pressures — check both:

```
by size:   15 TB in 5 years ÷ 2 TB/node ≈ 7–8 → eventually, yes
by writes: 40 writes/s vs ~1,000 TPS SQL ceiling → 4% of one node
```

Write rate will never force sharding. Size will — in years. The senior answer is to say so: one primary plus two read replicas on day one, and when the table approaches a couple of TB, partition by hash of the short code — codes are random, so hashing spreads perfectly. Sharding later, on a named trigger, is a design decision; sharding now is a reflex.

> ⚠️ **Trap** — Announcing sixteen shards and consistent hashing for 40 writes/s. Over-provisioning in an interview doesn't read as ambition; it reads as not believing the arithmetic you just did.

## Rung 5 — Money

Six or seven boxes (redirect tier, cache pair, primary plus replicas) ≈ $7 k/month, 15 TB stored × $20 ≈ $300, egress ~5 TB/month (4 k/s × 500 B) × $100 ≈ $500 — order of $5–10k a month, which is noise. Say "cost is not a factor here" and spend the minute elsewhere.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 12 k peak reads vs 5 k SQL read ceiling | cache-first redirect path + read replicas; the database is the source of truth, not the hot path |
| cache hit 0.5 ms vs indexed SQL 5 ms | both fit the 100 ms budget — the cache is there for throughput; the 10× latency win comes free |
| 40 writes/s vs 1 k TPS | single primary for years; no day-one sharding; partition by code hash when *size* says so |
| 62^7 ≈ 3.5 T vs 12 B in 10 years | 7-character fixed-length codes, settled forever |
| 400 M clicks/day, if analytics lands | the real data problem — see below |

That last row is the senior move in this interview. If analytics comes into scope, every redirect becomes an event: a short code, a timestamp, a referrer hash — a handful of 8 B fields, call it ~100 B.

```
400 M clicks/day × 100 B ≈ 40 GB/day of raw events
≈ 1.2 TB/month logical — 25× the link store's 50 GB/month
```

The click stream outweighs the product it measures by 25×, every month, forever. The shortener itself is a solved, small system; the analytics pipeline is a genuine big-data problem — ingestion, rollups, retention tiers — with its own walkthrough ([chapter 21 — metrics aggregator](21-metrics-aggregator.md)). "The interesting system here is the click pipeline, not the shortener" is the sentence that separates levels.

## The pushback round

**Interviewer:** "Your 100:1 feels arbitrary. Why not 10:1? Why not 1000:1?"

**You:** "Let's stress it — writes are pinned at 40/s either way. At 10:1, reads drop to 400/s average, 1.2 k peak: under one SQL replica's 5 k ceiling, so I could serve redirects from replicas and skip the cache entirely. At 1000:1, reads are 40 k/s average, 120 k peak: that's 20 redirect servers instead of 3, and the working set grows to 20% of 2 TB/day ≈ 400 GB — three or four cache nodes instead of one. The shape never moves: cache-first read path, single write primary. The ratio changes counts, not architecture — which is why one significant figure was enough."

**Interviewer:** "Then why state the ratio at all?"

**You:** "Because the counts still matter operationally — 3 servers and 20 are different bills and different on-call nights. The assumption is cheap to state and cheap for you to correct. Silent is the only wrong way to hold it."

That robustness — the design surviving a 100× swing in the assumption — is the actual answer to the challenge, and you only get to demonstrate it because you stated the ratio out loud in the first place.

## Say it in 60 seconds

> "Let me put numbers on it before designing. Call it 100 million new links a month — that's 40 writes a second, nothing. Shorteners are read-heavy, say 100:1, so about 4,000 redirects a second, peak 12,000. A stored link is a 100-byte URL plus code and metadata — round to 500 bytes — so 50 GB a month logical, 250 provisioned, roughly 15 TB over five years. Machines: redirects are trivial work, so two or three servers cover peak; the hot 20% of a day's 400 million clicks is about 40 GB — one Redis node; and at 40 writes a second, one SQL primary with read replicas is fine for years — I would not shard on day one. Code length: 62 to the 7th is about 3.5 trillion against 12 billion needed in ten years — 300× headroom, seven characters, done. Cost is single-digit thousands a month — noise. The number that worries me is none of these: it's the 400 million clicks a day *if* analytics is in scope — that pipeline dwarfs the shortener, so I'd scope it explicitly before drawing anything."

## Numbers to keep

- Months divide by 2.5 × 10^6: 100 M/month = 40/s
- 100:1 → 4 k redirects/s average, 12 k peak
- Row ≈ 500 B → 50 GB/month logical, ×5 → 250 GB provisioned, ~15 TB in 5 years
- 62^7 ≈ 3.5 × 10^12 vs 1.2 × 10^10 demanded → 7 characters, ~300× headroom; 62^6 ≈ 57 B is too close
- Cache = 20% of 200 GB/day = 40 GB → one Redis node
- 40 writes/s vs 1 k TPS → no day-one sharding; partition later by code hash
- If analytics: 400 M clicks × 100 B = 40 GB/day — the real data problem

## Drills

**Drill 11.1** — Product changes its mind: links expire after 90 days. What happens to storage?

<details><summary>Answer</summary>

```
live links: 100 M/month × 3 months  = 300 M at steady state
300 M × 500 B = 150 GB logical × 5  ≈ 750 GB provisioned — flat, forever
```

Growth stops. The dataset becomes a fixed ~750 GB working set instead of 3 TB/year unbounded — sharding falls off the roadmap entirely, and deletion is cheap (expiries run at the creation rate, 40/s; better, partition by month and drop whole partitions). The so-what: retention is the strongest storage lever you have. Before you ever say "shard," ask "must this live forever?"
</details>

**Drill 11.2** — A celebrity posts one short link and it draws 100k clicks/s. What breaks first?

<details><summary>Answer</summary>

Walk the tiers. The redirect fleet is sized for 12 k peak — 3 boxes × 10 k = 30 k absolute ceiling — so the stateless tier falls over first; autoscaling fixes that with money. The structural break hides behind it: all 100 k/s hash to *one key* on *one* Redis node, which is exactly the 100 k ops/s single-node ceiling — and you cannot shard one key. The fix is replication, not partitioning: the code→URL mapping is immutable, so cache it in-process on every redirect box (the first hit warms it; the rest never leave the machine) or push the 301 to the CDN edge. Bandwidth stays a non-issue (100 k × 500 B = 50 MB/s). The so-what: hot keys are replication problems, not sharding problems — and immutability is what makes the cheap fix safe.
</details>

**Drill 11.3** — Marketing wants 4-character vanity codes ("sho.rt/SALE"). How big is that namespace, and when does it exhaust?

<details><summary>Answer</summary>

```
62^4 ≈ 60^4 = 6^4 × 10^4 = 1,300 × 10^4 ≈ 1.3 × 10^7     (true ≈ 15 M)
```

~15 million codes. If even 1% of 100 M monthly links request one, that's 1 M/month — exhausted in ~15 months, and in practice far sooner: people don't want random 4-character strings, they want *words*, and the memorable subset is a sliver of the space. The so-what: a 4-character namespace is a scarce resource, not a capacity plan — reserve it, price it, or scope it per customer. The estimate just turned an engineering request into a product decision, and saying that out loud is the senior answer.
</details>
