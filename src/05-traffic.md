# 5 — Traffic

*Nobody gets paged at the average. This chapter finds the second that breaks you — and whether it breaks on a read or a write.*

## The question this chapter answers

"Estimate the QPS" is three questions in one trench coat: how many requests arrive at the worst moment, how many of those are reads versus writes, and what you're counting as a request in the first place. Answer all three and rung 2 of [the Ladder](04-the-ladder.md) is done. Miss any one and the error compounds through every rung below it — server counts, shard counts, the bill. Traffic numbers are the most load-bearing numbers in the whole estimation, which is why they get a chapter before storage does.

## From first principles

### From users to requests per second

Traffic is people doing things, divided by time. That is the entire derivation:

```
daily actions = DAU × actions per user per day
average rate  = daily actions ÷ seconds in a day
```

Seconds in a day: 24 h × 3,600 s/h = 86,400 s. You will never divide by 86,400 under pressure, and you don't need to — round it **up** to 10^5. The rounding under-counts QPS by ~15%; you name it once and move on, because the peak factor you're about to apply is ×3 to ×10 and swallows a 15% error whole. Trading 15% for arithmetic you can do mid-sentence is the best deal in this book.

```
average QPS = (DAU × actions per day) ÷ 10^5
```

> ⚡ **Instinct check** — A government-services portal: 5M DAU, 4 actions each. Average QPS, before reading on. … 5 M × 4 = 20 M ÷ 10^5 = **200 QPS**. More than ten seconds? Redo the [chapter 2](02-the-arithmetic-of-scale.md) drills first.

### From average to peak

The average assumes your users arrive uniformly, one every few microseconds, around the clock. No human population has ever behaved that way. Traffic concentrates — by timezone, by habit, by event — and your system either survives the concentration or it doesn't. Tokyo's Shinjuku station moves ~3.5M passengers a day, and none of its stairways are sized for the daily average — they're sized for the 8 AM crush. Your API tier is a stairway.

How concentrated? Derive it from how the people are spread.

**Global app — the diurnal ripple.** Even a "global" user base is lumpy: most of humanity lives in a handful of timezone bands, and the sun drags a bulge of evening usage around the planet, with big markets' evenings overlapping. The busiest hour of a global consumer service carries about three times the average second. That ×3 is the canon anchor — mechanism qualitative, number fixed.

**Single-region app — the compressed day.** Here you can derive the factor. A one-country app's traffic doesn't spread over 24 hours; ~80% of it lands in ~8 waking hours:

```
effective day   ≈ 8 h × 3,600 s/h ≈ 3 × 10^4 s     (the other 20%: rounding noise)
compression     = 10^5 ÷ (3 × 10^4) ≈ ×3            just from the shorter day
in-window crest ≈ ×1.5                              (lunch, and the 9 PM shoulder)
peak factor     ≈ 3 × 1.5 ≈ ×5
```

The ×1.5 crest is the one number here you take on faith; everything else is arithmetic. A regional app's peak is not a worse version of the global ×3 — it's a structurally different day.

**Event-driven — synchronized attention.** Habit spreads traffic; events synchronize it. A temple that sees a quiet trickle on Tuesdays runs queues ten deep on festival morning — same annual footfall, different clock. Flash sales, festival payouts, the final over: plan ×10 or more, and treat ×10 as a floor. For deliberately synchronized moments (a sale that opens at 10:00:00 sharp), skip the multiplier and derive the burst from the cohort and the window — drill 5.4 does exactly that.

> 🎯 **In the room** — Say the peak factor as an assumption, not a footnote: "global consumer app — I'll take peak as 3× average." One sentence. It signals you know averages don't crash systems, and it hands the interviewer a number to push on. That push is an invitation, not an attack.

Calibrate your ceilings against reality (calibration points, not canon — more in the [scale gallery](c-real-world-scale-gallery.md)): Alibaba's Singles' Day peaked at ~580k orders/s (2020); WeChat's New Year red envelopes hit ~760k/s (2017); Hotstar has held ~50–60M concurrent cricket viewers. Read these as limits: the largest synchronized consumer events on Earth produce write peaks around 10^5–10^6 per second. If your envelope says a regional grocery app takes 2M writes/s, you haven't discovered a big system — you've dropped an exponent.

### Split reads from writes before you design

Before leaving this rung, split total traffic by the read:write ratio — from canon: **100:1** for feeds, shorteners, and most content systems; **10:1** for a typical web app; **~1:1** for chat and telemetry, then multiplied by fan-out (one message in, three devices notified).

The split matters because reads and writes hit different walls. Reads repeat — 20% of objects take 80% of reads — so they're absorbed by copying: replicas, and caches where a hit is trivial work (~10k QPS per API server, ~100k ops/s on a Redis node). Writes cannot be cached away. Every write must reach durable, usually ordered, storage — and replication means each one lands three times. A SQL node serves ~5,000 read QPS but only ~1,000 write TPS: the write wall stands five times closer, and the tools that move it — sharding, queues — cost coordination and re-balancing pain ([Machines & shards](09-machines-and-shards.md) prices them). So the ratio picks your architecture before you draw a box: a 100:1 system is a caching problem; a 1:1 system is an ingestion problem. Same QPS, different book of solutions.

### Requests are not actions

One product-level action explodes at the API tier. Open a feed and the client fires the session refresh, the feed call, per-item hydration, counters, the notification badge, ads, telemetry — a modern page load is ~10–30 API calls. At the other extreme, [typeahead](18-typeahead.md) makes every keystroke a request: typing "biryani near me" is 15 requests before dinner is even chosen. Neither count is wrong; they're counts at different layers, and the gap between them is 10×. The fix costs one spoken sentence — name the unit and the multiplier: "20M DAU × 20 screens a day, and I'll take ~5 API calls per screen — 2B requests/day at the gateway." Interviewers probe exactly this seam.

### Connections are not requests

QPS counts arrivals; concurrency counts who is *present*. In-flight load = arrival rate × residence time — Little's law in street clothes:

```
request/response: 10 k QPS × 50 ms = 500 requests in flight   — nothing
held-open socket: presence ≈ session length, not latency
```

For request/response systems, concurrency is a footnote. For long-lived connections — chat, gaming, live video — it's the constraint: a chat user sends a message every few minutes yet holds a socket open all evening. The canon shortcut: **peak concurrent ≈ 10% of DAU**. A 50M-DAU messenger holds ~5M open sockets at the crest, and its edge tier is sized by sockets and memory — plan ~100k connections per server — not by message rate. Hotstar's ~50–60M concurrent viewers is this category at its extreme: the scary number has no "per second" in it. The [chat walkthrough](13-chat.md) climbs this one in full.

## The anchors

| Anchor | Value | Use it when |
|---|---|---|
| 1 day | 10^5 s (under-counts ~15%; peak factor swallows it) | every rung-2 division |
| Peak factor — global app | ×3 | diurnal ripple |
| Peak factor — single-region app | ×5 | ~80% of traffic in ~8 h |
| Peak factor — event-driven | ×10+, a floor | sales, festivals, the final over |
| Read:write — feeds, shorteners, content | 100:1 | cache-shaped systems |
| Read:write — typical web app | 10:1 | the default |
| Read:write — chat, telemetry | ~1:1, × fan-out | ingestion-shaped systems |
| API calls per user action | ~10–30 — state yours | sizing a gateway vs one service |
| Peak concurrent users | ~10% of DAU | long-lived connections |

Everything here is [cheat-sheet](a-cheat-sheet.md) canon except the API multiplier, which is an assumption you state per system — out loud.

## 🧮 Worked example 1 — food delivery, one country

Interviewer: *"Size the traffic for an India-only food-delivery app."*

Spoken: "Say 10M DAU — reasonable? Browsing dominates: call it 20 screens per user per day — search, menus, tracking — at ~5 API reads per screen, so 100 reads per user per day."

```
reads:  10 M × 100 = 10^9 reads/day
        10^9 ÷ 10^5 = 10 k QPS average
        single country → ×5 ≈ 50 k QPS peak
```

"Orders are rarer — say every third active user orders on a given day:"

```
writes: 10 M × 0.3 = 3 M orders/day
        3 M ÷ 10^5 = 30 TPS average → ×5 ≈ 150 TPS peak
        each order ≈ 5 rows (order, items, payment, status) ≈ 750 row-writes/s peak
```

Interpret. The ×5 isn't a smooth hill — it's two needles, lunch and dinner, predictable to the minute, so capacity can follow a schedule instead of a guess. Raw, 50k peak reads of typical logic would need 50 k ÷ 1 k ÷ 0.6 ≈ 80+ servers — but a neighborhood sees identical menus, so cached they become trivial work, and the read peak fits inside one ~100k-ops/s Redis (two for redundancy). Writes: 750 row-writes/s sits under a single SQL node's ~1k TPS ceiling — with no headroom for next year's ×2 growth, so name the queue-or-shard plan now. **So the read path is the design problem — put a cache in front of everything; the order path is a correctness problem (payments, idempotency), not a throughput problem.**

## 🧮 Worked example 2 — a global social feed

Interviewer: *"200M DAU social app — what's the traffic?"*

Spoken: "Global, so peak is ×3. Feed opens: say 5 per user per day, and content systems run ~100 reads per write."

```
reads:  200 M × 5 = 1 B feed reads/day
        1 B ÷ 10^5 = 10 k QPS average → ×3 ≈ 30 k QPS peak
writes: 1 B ÷ 100 = 10 M posts/day
        10 M ÷ 10^5 = 100 writes/s average → ×3 ≈ 300/s peak
```

Two multipliers to state before anyone relaxes. First, that 30k is the *feed service*; the gateway also carries every sidecar call — at ~10 calls per open, ~100k QPS average and 300k peak — so say which tier you're sizing. Second, 300 posts/s is ingest, not work: each post fans out toward followers' feeds, and the write you accept is not the write you store — the [news-feed walkthrough](12-news-feed.md) does that multiplication. **So the read path is the design problem — 30k QPS of repetitive, cacheable reads wants replicas plus a cache sized to the hot 20% — while the write path is trivial at the front door and explosive behind it, which is why feed design is fan-out design.**

## ⚠️ Traps

- **Averaging a regional app over 24 hours.** A one-country app lives in a 3 × 10^4-second day. Divide by 10^5 and apply ×3 and you've provisioned for 60% of the dinner crest — the shortfall lands at the only hour that matters.
- **MAU where DAU belongs.** Press releases say "100M users"; that's MAU. Use it raw and every number downstream inflates ~4×. Convert out loud — ×25%, sticky messengers ×50% — and label the base.
- **Quoting QPS when the constraint is connections.** "How many edge servers for chat?" is a socket-count question — 10% of DAU held open — not a rate question. Answer it in QPS and you've sized the wrong wall.
- **Counting actions but billing requests.** The gateway carries 10–30× the product-action count; a single service may carry 1×. Sizing either tier with the other's number is an order-of-magnitude miss. Name the layer, name the multiplier.
- **Answering "will it handle the load?" with an average.** That question is always about peak. Averages set the bill; peaks set the outages.

## Numbers to keep

- Average QPS = daily actions ÷ 10^5 — the ~15% under-count is paid for by the peak factor
- Peak: ×3 global, ×5 single-region, ×10+ events — and for synchronized events, derive from cohort ÷ window
- Split first: 100:1 content, 10:1 typical web, ~1:1 chat (× fan-out) — the ratio picks the architecture
- Reads scale by copying (replicas, caches); writes scale by splitting (shards, queues)
- ~10–30 API calls per user action — name your unit before multiplying
- Peak concurrent ≈ 10% of DAU; when connections live long, concurrency outranks QPS as the constraint
- World-record consumer peaks run ~10^5–10^6 writes/s — calibrate your ceilings against that

## Drills

**Drill 5.1** — A fitness app has 80M MAU with typical stickiness. Each active user reads the feed 10 times and logs 2 workouts a day. Peak read QPS and write TPS for this global app?

<details><summary>Answer</summary>

```
DAU:    80 M MAU × 25% = 20 M
reads:  20 M × 10 = 200 M/day ÷ 10^5 = 2 k QPS average → ×3 ≈ 6 k peak
writes: 20 M × 2  =  40 M/day ÷ 10^5 = 400 TPS average → ×3 ≈ 1.2 k peak
```

6k read QPS is one modest cached tier; the real flag is 1.2k peak write TPS — already past a single SQL node's ~1k ceiling, so the first shard or a write queue is due before the next marketing push.
</details>

**Drill 5.2** — A colleague sizes a single-country ride-hailing app: 12M DAU × 25 API calls/day ÷ 10^5 ≈ 3k QPS, then provisions ×3 ≈ 9k peak. Find the error and the right number.

<details><summary>Answer</summary>

```
the ×3 is the planet's peak factor — this app lives in one country
single-region → ×5:  3 k × 5 = 15 k QPS peak     (provisioned: 9 k)
```

He's 40% short, and the deficit lands exactly at the evening commute. Regional apps compress the day into ~3 × 10^4 s — ×3 belongs to the planet, ×5 to a country.
</details>

**Drill 5.3** — A messenger has 100M MAU and messaging stickiness. Each DAU sends 40 messages/day; average fan-out is ~3 recipients per message. Peak ingest TPS, peak delivery rate, and the number that actually sizes the edge tier?

<details><summary>Answer</summary>

```
DAU:        100 M × 50% = 50 M                    (sticky app)
ingest:     50 M × 40 = 2 B msgs/day ÷ 10^5 = 20 k TPS average → ×3 ≈ 60 k peak
deliveries: 60 k × 3 fan-out ≈ 180 k/s peak
edge:       peak concurrent = 50 M × 10% = 5 M open sockets
```

Chat's ~1:1 ratio triples after fan-out — and the edge isn't sized by any per-second rate at all but by 5M held-open sockets, ~50 boxes at 100k connections each ([chat walkthrough](13-chat.md)).
</details>

**Drill 5.4** — A sneaker drop opens at 10:00 sharp. 5M users set reminders; assume 20% hit "buy" in the first minute at ~3 API calls per attempt. What arrives, and where is the wall?

<details><summary>Answer</summary>

```
attempts: 5 M × 20% = 1 M in 60 s ≈ 17 k/s → call it ~20 k attempts/s
requests: 20 k × 3 calls ≈ 60 k QPS burst
```

The wall isn't aggregate QPS — every attempt converges on one SKU's stock row, a single serialization point that no per-node ceiling rescues. Queue at the edge and admit by token, so the database sees hundreds of writes, not 20k. Synchronized events break the multiplier model: ×10 is a floor — derive from cohort ÷ window.
</details>

**Drill 5.5** — Inversion. The interviewer states: "Our gateway peaks at 50k QPS — global consumer app, ~10 API calls per user action, users average ~10 actions a day." Roughly how many DAU, and which assumption do you confirm first?

<details><summary>Answer</summary>

```
average QPS:  50 k ÷ 3 ≈ 15 k
requests/day: 15 k × 10^5 = 1.5 B
actions/day:  1.5 B ÷ 10 calls   = 150 M
DAU:          150 M ÷ 10 actions = 15 M
```

~15M DAU. Confirm the calls-per-action multiplier first — it's the softest 10× in the chain. The Ladder runs downhill too: same rungs, inverted divisions, and the answer is only as good as the divisor you said out loud.
</details>
