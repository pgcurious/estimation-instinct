# 25 — Notification system

*One tap fans out to millions across three channels of wildly unequal cost — and the arithmetic finds the whole bill hiding in SMS, not servers.*

## The prompt

> "Design the notification system for a social app — push, SMS and email for likes, comments and follows, plus OTPs, receipts and marketing sends. Put numbers on it first."

This looks like a product but behaves like a component: it produces nothing a user asks for directly, it inherits its load from *other* people's actions, and one event it never chose can detonate into millions of sends. The famous answer — a durable queue with rate-limited per-provider workers — is not the grade. The grade is whether your numbers make that queue the only survivor. Recited, it is a diagram; derived, it is ten minutes of an architect refusing to send synchronously and showing you why.

## Scope it in 60 seconds

Three questions change the numbers; the third changes the topology.

1. **Which channels, and is marketing in scope?** All three — push (APNs/FCM), SMS, email — and yes, marketing is in scope, because its volume rivals the organic stream. But marketing carries **no freshness SLA**, so it becomes the shock absorber: batched into off-peak troughs. Get that concession on record.
2. **Do we count events, or delivery attempts?** Delivery attempts — one notification × one channel. An event fans out; the *provider* meters and bills attempts, not events. Everything below is sized in attempts, because that is what hits a ceiling and what shows up on the invoice.
3. **What are the priority classes and their SLAs?** Three lanes: **transactional** (OTP) sub-second, **social** within a minute, **marketing** best-effort. This single answer decides the queueing discipline — flag it, and get it agreed before drawing anything.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| DAU | 200 M | social app at X-scale; canon 25% DAU/MAU → ~800 M MAU — propose it, get the nod |
| Social notifications | 10/DAU/day → 2 B/day | likes dominate; this is what a user *receives*, not sends |
| Transactional | 1/DAU/day → 0.2 B/day | OTP, receipts, security alerts |
| SMS share | ~100 M/day | OTP + critical only — the cents-each channel, and the number the design must attack |
| Marketing | ~0.5 B/day | to 800 M MAU at ~0.6/day; no freshness SLA → off-peak |
| Payload / inbox entry | ~1 KB / ~100 B | canon row for the payload; a stored inbox entry is a pointer bundle |
| APNs + FCM ceiling | ~500 k push/s (external) | **not canon** — a provider integration cap, inherited like a component inherits traffic |
| SMS carrier | ~10 k SMS/s, ~$0.01 each (external) | **not canon** — carrier economics, stated and flagged; "cents each" is the whole story |
| Read:write | ~1:1 (fan-out inflates writes) | canon chat/telemetry — a sanity check, not an input |

> ⚠️ **Trap** — Treating APNs/FCM as elastic. They are a fixed QPS ceiling you cannot exceed by spending more, exactly like the rate limiter inherited 100k from its gateway. The durable queue is not a convenience buffer; it exists *because* this ceiling is a wall, not a dial.

## Rung 1 — Users

200 M DAU, ~800 M MAU behind them. The canon's 10% concurrency says ~20M people have the app open right now — but that is not the load that matters here. Notice the shape early, because it is the whole chapter: this system has one incessant, cheap verb (a like, a comment) and one rare, catastrophic verb (a huge account acts once), and every design decision below is about what the rare verb costs when a follower list and a channel list both multiply it.

## Rung 2 — Actions (traffic)

State the notification stream by class, then collapse to attempts.

```
social:        200 M × 10/day  = 2 B/day     (likes, comments, follows received)
transactional: 200 M × 1/day   = 0.2 B/day   (OTP, receipts, security)
marketing:     800 M × 0.6/day = 0.5 B/day   (off-peak, no SLA)
total notifications                ≈ 2.7 B/day → call it 3 B/day
```

Route each to channels — push is default and effectively free, SMS is reserved, email carries receipts and marketing:

```
push:  2 B social + 0.1 B txn + 0.4 B mktg ≈ 2.5 B/day
SMS:   0.1 B/day  (OTP + critical only)
email: 0.1 B receipts + 0.1 B marketing    = 0.2 B/day
delivery attempts ≈ 2.8 B/day → 3 B/day
```

```
average QPS = 3 B ÷ 10^5 = 30,000 attempts/s
peak QPS    = 30k × 3     ≈ 90,000/s → call it ~100k/s
```

One beefy stream, not exotic — until you split it. **Writes** are the 3B notifications created a day: 30k/s. **Reads** are inbox opens — users glancing at the bell:

```
inbox opens: 200 M × 5/day = 1 B/day ÷ 10^5 = 10,000 reads/s, peak ~30k/s
```

Reads and writes land at roughly **1:1** — the canon's chat/telemetry ratio, not the 100:1 of a feed. Interpret it hard: fan-out has *inverted* the usual system. This is a write-and-egress pipeline, not a read-cache problem — the wall is throughput *out* to providers, and there is no read path to offload the pressure onto.

### The signature sub-question — what does one event cost across three channels?

A like costs one push. But a notification is born when someone acts, and some accounts are followed by millions. The load-bearing event: **an account 10M people follow goes live.** One tap, one row in your database, and now the provider must be handed ten million sends.

A village temple has two ways to reach people. Ring the bell in the tower and everyone within earshot knows in a second — one act, ten thousand ears, no cost. Or seal a letter and pay a runner to walk it to a named door — certain, personal, a coin each. You ring the bell for the festival; you send the runner only for the summons that must arrive in one named hand. A notification system is that village: **push is the bell, SMS is the runner** — and the fastest way to bankrupt the temple is to send ten thousand runners with news the bell could have carried.

> ⚡ **Instinct check** — 10M followers, and suppose product wired all three channels into "go live." How many delivery attempts from one tap — and at a cent per SMS, what did that single tap cost? Answer before reading on.

**Price the push burst against the provider wall.**

```
10 M followers × 1 push = 10^7 push attempts — for ONE event
provider ceiling         = 5 × 10^5 push/s (APNs + FCM, inherited)
10^7 ÷ 5×10^5            = 20 s to drain one event at the wall
```

Twenty seconds of the entire push pipeline pinned by one sentence — and organic traffic (~100k/s, a fifth of the ceiling already) queues behind it. Ten such accounts scheduled for the top of the hour is `10^8 ÷ 5×10^5 = 200 s` — a standing backlog from a handful of taps. **No single provider can absorb the burst**; the ceiling is fixed and it is someone else's.

**Now price it if SMS were in the mix.**

```
10 M × $0.01 = $100,000 — for one tap
```

A hundred thousand dollars because one popular account went live. This is not an optimization to find later; it is a channel-eligibility rule the arithmetic writes for you: **high-fan-out events are push-only, full stop.** SMS is the runner, and you never dispatch ten million runners.

**The forced move.** You cannot send synchronously — one tap does not complete inside a request, and the send rate is not yours to choose. So: decouple through a **durable queue**; expand events to per-recipient notifications in elastic fan-out workers; **dedup and collapse** near-identical notifications (fifty likes in five minutes become one "50 people liked your photo," not fifty pushes); drain each provider through **rate-limited workers** that never exceed its ceiling; and split **priority lanes** so an OTP never waits behind a celebrity's blast. Every one of those four is a line of arithmetic above, not a preference.

> 🎯 **In the room** — The tell is what you call the queue. A candidate says "for reliability." A senior candidate says it is an **impedance match** — it converts an event-time spike (×10, uncontrollable) into a provider-time constant (a fixed QPS ceiling), and without it your uptime is chained to APNs' uptime and your latency to your worst fan-out.

## Rung 3 — Bytes (storage & bandwidth)

Notifications are ephemeral — a rolling window, not an archive. Store the inbox entry as a reference, not the rendered message:

```
inbox entry ≈ 100 B (id + type + actor + target + ts, canon pointers)
2 B social/day × 100 B = 200 GB/day logical
× 30-day retention     = 6 TB
× 5 (repl + overhead)  = ~30 TB provisioned
```

Thirty terabytes for the durable inbox of a 200M-DAU network. Say it plainly: **bytes are a non-story here.** No petabytes, because the payloads are tiny and the retention is short — the opposite of the video platforms.

Bandwidth is the only byte number worth a line. Payloads to providers are small — a push is ~1 KB, capped by APNs anyway:

```
push egress: 100k/s peak × 1 KB ≈ 100 MB/s → under one 10 Gbps port (1.25 GB/s)
email:       200 M/day × 50 KB  = 10 TB/day ≈ 120 MB/s to the mail provider
```

Trivial both ways. The system moves a few TB a day of small things at high rate — throughput is a *counting* problem (ops/s, sends/s), not a *bytes* problem. Stop looking at storage; the pressure is elsewhere.

## Rung 4 — Machines (cache, servers, shards)

**Durable queue (Kafka) — the spine.**

```
100k/s peak × 1 KB = 100 MB/s = exactly one broker at the canon ceiling
+ replication + ×10 event burst → 3–5 brokers, queue depth absorbs the spike
```

The queue's job is precisely that: turn a ×10 expansion burst into a flat drain the providers can survive.

**Per-provider sender workers (rate-limited).** Typical network-bound logic, ~1k sends/s each:

```
push senders: 100k/s peak ÷ 1k ÷ 0.6 ≈ 170 workers (elastic; average ~50)
SMS senders:  ~3k/s peak — a handful, and carrier-capped below push anyway
email senders: modest — provider-bound, not CPU-bound
```

The push fleet is the biggest stateless tier and it is *elastic by design* — it must surge for a fan-out burst and idle overnight.

**Fan-out / expansion workers.** Canon's named example of heavy work (~100 QPS/server): they explode one "go live" event into millions of queue entries. Scale them up for the whale, down at 3 AM — the celebrity burst is exactly why this fleet cannot be fixed-size.

**Dedup / idempotency (Redis).** Every notification carries a key = hash(event, recipient, channel); never double-send.

```
100k ops/s → 2 Redis nodes (ops force the count, not memory)
working set: 30k/s × 3600 s window × ~50 B ≈ 5 GB → one box holds it
```

**Inbox store (NoSQL LSM).**

```
writes: 60k/s peak ÷ 10k/node = 6 nodes
size:   30 TB ÷ 2 TB          = 15 shards  ← size wins, mildly
→ ~15 shards × 3 replication ≈ 45 boxes, keyed by recipient id
```

**Cache.** 20% of a day's reads — recent and unread inbox for active users — is a few hundred GB, a small Redis tier. Reads were never the problem; this is a formality.

## Rung 5 — Money

```
compute:  ~5 queue + ~50–170 senders + 2 dedup + 45 inbox + cache
          ≈ 100–250 boxes × $1k       ≈ $100–250k/month
storage:  30 TB × $20                 ≈ $600/month           — noise
egress:   email 10 TB/day × 30 × $100 ≈ $30k/month           — minor
SMS:      100 M/day × 30 × $0.01      = $30,000,000/month    ← the bill
push:     APNs/FCM                    ≈ free
```

Stop and stare. Compute, storage and egress together are ~$250k a month; **SMS alone is $30M — 99% of the bill.** The most expensive thing this system does is not computed on any machine you own; it is a cent handed to a carrier, a hundred million times a day. Interpret it as the architecture it forces: **prefer push, fall back to SMS.** Every user with a live push token is a cent saved per message. The bill is not a systems number — it is a channel-routing number, and it is enormous.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 10^7 push attempts, 20 s at the provider ceiling | one event can pin the whole pipeline → durable queue + rate-limited drain, never synchronous |
| provider ceiling fixed at ~500k/s, not elastic | you rate-limit *yourself* to the provider's wall; the queue absorbs the difference |
| $100k for one tap if SMS joins fan-out | high-fan-out events are push-only — channel eligibility is set by fan-out size |
| $30M/month SMS vs $250k compute | the design lever is channel routing (push-first, SMS-fallback), not any box |
| read:write ≈ 1:1, write-heavy | a delivery pipeline, not a content cache — size the write/egress path |
| OTP sub-second vs marketing best-effort | separate priority lanes; marketing batched into off-peak troughs |

## The pushback round

**Interviewer:** "Your SMS line is $30M a month. Finance wants it halved by next quarter. What do you actually change?"

**You:** "Not compute — routing. SMS is a fallback, not a primary. If ~80% of OTP recipients have a live push token, I send push-first and fall back to SMS only on the ~20% with no token or a failed delivery receipt: `2×10^7/day × $0.01 = $6M/month` — a $24M cut for a fallback timer and a token check. So the real metric I'd instrument isn't latency, it's *push-token coverage*, because that percentage is a direct line on the P&L. The bill is a routing decision wearing a volume disguise."

**Interviewer:** "APNs goes dark for five minutes at peak. Walk me through it."

**You:** "Thundering herd is the danger. During the outage, `100k/s × 300 s = 30M` notifications accrue; naive retries would then slam APNs the instant it recovers, on top of live traffic, and knock it down again. The durable queue is what saves us — that's what *durable* buys. Workers back off exponentially with jitter, and drain on recovery at the provider-safe rate, not as fast as possible. And the lanes matter here: the transactional queue drains first, so OTPs clear in seconds while social notifications ride a longer backlog — which is fine, because we agreed social's SLA is a minute and OTP's is not."

**Interviewer:** "Then why not skip the queue and just send inline, and avoid all this?"

**You:** "Because two independent facts make synchronous impossible, and they're both arithmetic. One event is up to 10^7 sends — that cannot complete inside a request. And the send *rate* is a fixed provider ceiling — that cannot be chosen by my caller. The queue isn't a buffer I added for tidiness; it's the impedance match between an event-time spike I don't control and a provider-time constant I can't exceed. Send inline and you've soldered your availability to APNs' availability and your tail latency to your single worst fan-out — you've imported someone else's ceiling as your own outage."

## Say it in 60 seconds

> "Numbers first, because they pick the architecture and the bill. 200 million DAU generate about 3 billion notifications a day — 30,000 a second, 90,000 peak — and it splits roughly one-to-one reads to writes, so this is a delivery pipeline, not a cache. The crux is one event: an account 10 million people follow goes live — ten million push attempts from one tap, twenty seconds pinned against a fixed 500k-per-second provider ceiling, and a hundred thousand dollars if anyone dares route that through SMS. So high-fan-out is push-only, and you cannot send synchronously — durable queue, dedup and collapse, rate-limited per-provider workers, and separate lanes so an OTP never waits behind a celebrity. Bytes are nothing — 30 terabytes of tiny ephemeral records. Compute is a hundred-odd boxes, a quarter-million a month. But SMS is 100 million messages a day at a cent each — 30 million a month, 99% of everything. The number that worries me is the SMS bill — 30 million against a quarter-million of compute — so I'd design the channel-routing policy, push-first with SMS fallback, before I draw a single box."

## Numbers to keep

- 3 B notifications/day = 30k/s average, ~90k/s peak; read:write ≈ 1:1 — write-heavy delivery, not a cache
- One 10M-follower event = 10^7 push attempts = 20 s at the ~500k/s provider ceiling — the queue exists for this
- SMS wired into fan-out = 10^7 × $0.01 = $100k per tap → high-fan-out is push-only by arithmetic
- SMS bill = 100M/day × $0.01 × 30 ≈ $30M/month vs ~$250k compute — the P&L is channel routing
- Push-first, SMS-fallback at 80% token coverage → $30M → $6M
- Kafka spine: 100k/s × 1 KB = 100 MB/s = one broker at ceiling; the queue turns a ×10 spike into a flat drain
- Inbox store ~30 TB → ~15 shards by recipient; dedup Redis 2 nodes on ops, ~5 GB of keys
- Providers are inherited ceilings, not dials: rate-limit yourself, back off with jitter, lanes drain by priority

## Drills

**Drill 25.1** — A 100M-follower account goes live during peak — ten times the whale. Price the push burst, the drain, and the cost had SMS been wired in.

<details><summary>Answer</summary>

```
push:    10^8 attempts for one event
ceiling: 5×10^5/s → 10^8 ÷ 5×10^5 = 200 s to drain
organic: peak 10^5/s already eats 20% of the ceiling → real drain longer
SMS?:    10^8 × $0.01 = $1,000,000 — for one tap
```

So what: at this scale the drain is minutes, not seconds — which is why the fan-out lane must be separate and rate-shaped, and why a single such account may itself warrant *pull* semantics (write once to a hot list the client fetches) instead of 10^8 writes. Channel eligibility is set by fan-out size, not message type: a million-dollar tap is not a message, it's an incident.
</details>

**Drill 25.2** — Marketing wants to fire 500M promo notifications. Compare 9 AM peak versus spread across the overnight trough.

<details><summary>Answer</summary>

```
at 9 AM, 1 hour: 5×10^8 ÷ 3600 ≈ 140k/s + 100k/s organic = 240k/s
                 → fits under 500k/s, but eats half the headroom fan-out needs
overnight, 6 h:  5×10^8 ÷ (6×3600) ≈ 23k/s — a trickle beside idle capacity
```

So what: marketing is the one class with no freshness SLA, which makes it the shock absorber. Batch it into troughs where it borrows idle provider capacity, and it never competes with OTP or a celebrity burst for the ceiling. A class with no deadline is a scheduling gift — spend it smoothing the others.
</details>

**Drill 25.3** — Cut the SMS bill by routing push-first with an SMS fallback after N seconds. Given 80% live-token coverage, what falls out?

<details><summary>Answer</summary>

```
baseline:  10^8 SMS/day × $0.01 = $10^6/day = $30M/month
80% have a live push token → push-first, SMS only for the 20%
SMS now:   2×10^7/day × $0.01 = $2×10^5/day = $6M/month
saving:    $24M/month, for a token check and a fallback timer
```

So what: the SMS bill is a routing decision, not a volume constant. Every user with a live push token is a cent saved per message — so push-token coverage is a financial KPI, not a UX one, and the cheapest engineering in the whole system is whatever raises that percentage.
</details>
