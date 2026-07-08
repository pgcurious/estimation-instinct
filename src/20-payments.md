# 20 — Payments

*Half a billion writes a day that may never be lost, never be edited, and must answer to a regulator for a decade — and the monster isn't the load; it's what refused load does next.*

## The prompt

> "Design a national-scale instant payment system — UPI-class. Numbers first."

Every walkthrough so far had a hot path you could cache your way out of. Not this one. A payment is a write, every write is money, and every byte is evidence a court can demand ten years later. The Ladder doesn't change — but watch where the weight lands. Traffic turns out almost modest. The write fan-out, the audit shelf, and an availability chain that fails multiplicatively are where this interview is decided.

## Scope it in 60 seconds

Three questions change the numbers.

1. **What's the topology?** A closed wallet, or account-to-account transfers between many banks through a central switch — the UPI shape? Assume the switch: it's the harder, realer problem, and it puts four parties on every payment's critical path.
2. **Settlement: instant or batched?** Assume instant *authorization* — the payer sees "done" in seconds — with netted settlement between banks later. That splits the system into a latency-critical messaging path and a batch accounting path; the estimation lives almost entirely on the first.
3. **Audit retention?** Payments are regulated infrastructure. Assume ~10 years of immutable, queryable history. Hold that answer — it will dominate the bytes.

Assume: central switch, instant authorization with netted settlement, 10-year retention. Numbers on the table.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| Transactions | 500 M/day | UPI runs ~600 M/day (~2025); design just under the largest live example |
| Records per transaction | ~10 durable, ~2 KB total | sketched below: debits, credits, logs, statuses |
| Peak factors | ×3 diurnal, ×10 event design point | canon; salary days and festival midnights synchronize the country |
| Read:write | 10:1 | canon typical — balance checks and status polls surround each payment |
| Average ticket | ~₹2,000 | small-ticket dominated; only the money rung cares |
| Latency target | "instant" ≈ 2 s end-to-end | people grant money more patience than a page, less than a queue |
| Retention | 10 years, immutable | the regulatory assumption from scoping |

Earn the 2 KB before spending it. One payment's wake, in canon field sizes (8 B int64s, 16 B UUIDs, short strings): a debit entry at the payer's bank and a credit entry at the payee's — each ~200 B of transaction UUID, two account ids, amount, timestamps, status — the switch's authoritative log entry, two or three status-transition events, a fraud-score record, a settlement-netting entry, two notification records. Call it ten records:

```
~10 records × ~200 B ≈ 2 KB per transaction, durable, spread across four parties
```

## Rung 1 — Users

Demand arrives in this system's native unit — transactions, not DAU — so state the base there and sanity-check it against people: ~1.4 B population, maybe ~500 M active payers, so 500 M transactions/day is about one payment per payer per day. Believable for a country buying vegetables, bus tickets and chai by QR code. Get the nod: "Design for 500 million a day — just under UPI's actual ~600 M. Reasonable?"

## Rung 2 — Actions (traffic)

```
500 M/day ÷ 10^5 s   = 5,000 TPS average
× 3 diurnal peak     = 15,000 TPS normal peak
× 10 event factor    = 50,000 TPS event design point
```

Single-region traffic would justify canon's ×5 diurnal — 25 k — but the event factor dominates either way, so let ×10, canon's event floor, carry the headroom argument. The event has names: Diwali evening, salary day, a cricket-final flash sale.

Calibrate the top number before trusting it: Visa's global network is engineered for ~65 k TPS. Our event design point lands in the same decade as the most battle-tested payment network on earth. The envelope is sane.

> 🎯 **In the room** — Calibrating against a real system is a senior tell: "my event point is 50 k; Visa engineers for ~65 k — right decade." One sentence, and the interviewer knows your numbers come with a reality check bolted on.

Reads: every payment is wrapped in balance checks before and status polls after — canon's 10:1 typical ratio:

```
reads ≈ 10 × writes → 50 k/s average, ~500 k/s at the event point
```

Half a million read QPS sounds like the headline and isn't: statuses, handles and bank directories are all cacheable. One row is not — the account balance, the one value that must never be stale, because a stale balance approves money that isn't there. Say that sentence aloud; it is the entire read-side design problem.

## Rung 3 — Bytes (storage & bandwidth)

```
500 M/day × 2 KB              = 1 TB/day logical
× 5 (replication + overhead)  = 5 TB/day provisioned ≈ 2 PB/year
× 10 years                    ≈ 20 PB if it all stays in the database
```

Bandwidth, to dismiss it: 50 k TPS × 2 KB = 100 MB/s ingest at the event peak — one Kafka broker's canon ceiling. Trivial; never mention it again.

The 20 PB is the finding: **the audit trail, not the live ledger, is this system's bytes.** And almost none of it is ever read — payments older than ~90 days surface only for disputes, audits and subpoenas. Tier it:

```
hot, 90 days, SQL (×5):   90 × 1 TB = 90 TB logical → ~450 TB provisioned
archive, object store:    ~3.5 PB logical × 1.5 erasure-coded ≈ 5.5 PB
total tiered:             ≈ 6 PB   vs everything-in-SQL: ≈ 20 PB
saved:                    ~14 PB × $20/TB-month ≈ $300 k/month
```

The ×1.5 is earned, not chosen: the archive is append-only — written once, never updated — which is exactly the access pattern erasure coding demands.

This is an old pattern wearing new hardware. Traditional Indian merchants kept bahi-khata ledgers under one rule: never erase. A mistake got a correcting entry, so the books only ever grew — and the audit shelf, not the day's counter, is what filled the room. Same arithmetic, four centuries early.

## Rung 4 — Machines (cache, servers, shards)

The write wall, first and worst:

```
50 k TPS × 10 records         = 500,000 row-writes/s at the event point
SQL ceiling, 1 k writes/node  → 500 shards
LSM ceiling, 10 k writes/node → 50 nodes
```

Ledger semantics want SQL-class guarantees — per-account ordering, transactional debit-and-hold — so shard by hash of account id: 500+ logical shards, each account's history wholly on one shard, mapped onto however many physical nodes the storage engine allows.

How many is that? Here the workload's *shape* moves the wall. A ledger is append-only — the bahi-khata rule in production: you never UPDATE a payment, you append a correcting entry, and accountants settled that centuries before computers because erasure destroys trust. Append-only with per-shard ordering is precisely the workload LSM trees were built for — sequential writes, no in-place mutation — which is why LSM-backed ledger stores exist, and why the canon write ceiling moves from 1 k to 10 k per node. Five hundred boxes become fifty. Same guarantees where they matter, 10× fewer machines, purchased entirely by the workload's shape.

The rest of the machine story is quick. Stateless switch and API tier: 50 k TPS of typical business logic → 50 k ÷ 1 k ÷ 0.6 ≈ 85 → call it ~100 boxes. Cache for the pollable reads: 500 k/s ÷ 100 k Redis ops/s = 5 nodes plus replicas. Balance reads bypass the cache by design and land on the shard that owns the account.

### The latency budget — where two seconds go

The path: payer-app → payer-bank → switch → payee-bank → and back. Four-plus network hops, four durable commits (debit, switch log, credit, final status). Canon same-datacenter round trip is 0.5 ms; across a metro region, call it 1–2 ms.

| Segment | Budget |
|---|---|
| All network hops (~5 round trips × 1–2 ms) | ~10 ms |
| Payer bank: fraud check + debit commit | ~300 ms |
| Switch: validate + durable log + route | ~200 ms |
| Payee bank: credit commit | ~300 ms |
| Return path + status to payer's app | ~200 ms |
| Queueing margin under load | ~1,000 ms |
| **Total** | **≈ 2 s** |

Read the lesson out of the table: the network is ~10 ms — half a percent of the budget. The irreducible floor is the four commits — canon's indexed-SQL 5 ms each; with fsync and contention, tens of ms total. Everything else is queueing inside each party. So: co-locate the switch's hot path in-region, async-acknowledge every hop — commit locally, hand off, never hold a synchronous chain open across four organizations — and accept that the database commit is the latency floor you build around, not beat. Notifications ride entirely outside the budget.

### Availability — the serial chain, then the monster

> ⚡ **Instinct check** — four parties in series, each at 99.9%. Chain availability? Answer before reading on.

```
0.999^4 ≈ 99.6% available
missing 0.4% of a month: 0.004 × 2.5 × 10^6 s = 10^4 s ≈ 3 h/month
```

Three hours a month, *somebody* in the chain is failing payments — with every party meeting a respectable three-nines SLA and nobody at fault. The arithmetic, not prudence, forces three designs: **queue-and-retry semantics** (a failed payment is parked durably, never dropped — failed ≠ lost is the product promise), **idempotency keys on every hop** (anything may arrive twice; money must move once), and **per-bank circuit breakers** (one bank's bad hour must not eat the switch's threads).

Then the monster. When a bank slows, users mash retry and apps auto-retry — and retries are offered load:

```
20% failing, 1 retry per failure:    1 + 0.2 × 1 = ×1.2 offered load
50% failing, 3 retries per failure:  1 + 0.5 × 3 = ×2.5 offered load
```

A 2× slowdown halves a party's effective capacity at the same moment aggressive retries can ×2.5 what's thrown at it. Capacity halves, load doubles: the death spiral, derived in two lines. Retry budgets, exponential backoff and jitter are therefore *capacity features* computed from this arithmetic — not client-side politeness.

> ⚠️ **Trap** — Sizing the fleet for offered load and treating retries as someone else's problem. The amplification arrives exactly when your sized capacity is gone; a system that survives 50 k TPS of payments but not 50 k × 2.5 of payments-plus-retries was never sized at all.

## Rung 5 — Money

```
ledger fleet: ~50 LSM nodes, managed ≈ 2 × $1 k each   ≈ $100 k/month
switch + API + cache: ~100 boxes × $1 k                ≈ $100 k/month
storage, tiered: ~6 PB × $20/TB-month                  ≈ $120 k/month
→ order $0.3–0.5 M/month with headroom
```

Against what it moves:

```
500 M/day × ₹2,000 ≈ ₹10^12/day = ₹1 lakh crore/day ≈ $12 B/day (~₹85/$) ≈ $360 B/month
infra ÷ flow: $0.5 M ÷ $360 B ≈ 10^-6 — round up tenfold for pessimism: still ~0.001%
```

Infrastructure is a millionth of the value it moves. The number that actually prices this system is a minute of refusing it: at normal peak, 15 k TPS × 60 s ≈ 1 M payments × ₹2,000 ≈ ₹200 crore ≈ $25 M of flow turned away per minute — plus the front page, plus the regulator. That reframes every rung above: the money argument here never says "spend less on machines"; it says "spend whatever the availability target needs, because the machines are free by comparison."

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 500 k row-writes/s at the event point | shard by account hash — 500 logical shards on ~50 LSM-backed nodes |
| append-only ledger; corrections are new entries | never UPDATE — the shape buys the 10× write ceiling and an erasure-codable archive |
| 0.999^4 ≈ 99.6% → ~3 h/month some party failing | queue-and-retry (failed ≠ lost), idempotency keys everywhere, per-bank circuit breakers |
| retry amplification ×1.2–×2.5 | retry budgets and backoff enforced at the switch, as first-class capacity |
| 20 PB → ~6 PB tiered | 90-day hot SQL + immutable object archive; the audit trail is the storage story |
| ~$25 M refused per minute of downtime | the availability target, not throughput, is the thing you engineer |

## The pushback round

**Interviewer:** "You sized the write path for 50 k TPS on a 5 k average. Isn't 10× gold-plating?"

**You:** "It would be if payment peaks were independent — they're synchronized. Salaries land the same few days for the whole country; festival offers fire at one midnight; a cricket-final sale puts everyone in checkout in the same minute. ×10-over-average is observed at national scale, not hypothetical. So price both sides. The headroom: the delta between a 15 k and a 50 k write path is roughly 35 ledger nodes plus stateless fleet — order $100–200 k a month. The exposure: one Diwali hour at 50 k offered against 15 k built refuses 35 k TPS × 3,600 s ≈ 125 M payments — at ₹2,000 each, about ₹25,000 crore, ~$3 B of flow turned away in an hour, with the regulator and the front page attached. A couple hundred thousand a month against billions per refused hour: the asymmetry decides. Headroom isn't a virtue here; it's the cheap side of that inequality."

**Interviewer:** "Then autoscale into the events instead of paying all year."

**You:** "The stateless tier, yes — that's what it's for. The ledger can't: resharding a stateful, ordered, transactional store is the one operation you never run mid-spike, and not every spike is scheduled. Pre-provisioned headroom on the write path, elasticity everywhere else."

## Say it in 60 seconds

> "Numbers before boxes. 500 million payments a day — UPI does ~600 M, so we're calibrated — is 5,000 TPS average, 15 k at the daily peak, and I'll design the write path for 50 k, because salary days and festival midnights synchronize — and Visa engineers for ~65 k, so that's the right decade. Each payment leaves about ten durable records, ~2 KB, so 1 TB a day logical, 5 provisioned — 20 petabytes over the 10-year regulatory horizon if it stays in the database. It shouldn't: 90 days hot in SQL, the rest to an immutable erasure-coded archive — about 6 PB instead of 20, saving $300 k a month. Writes are the wall: 50 k times 10 records is 500 k row-writes a second — 500 SQL shards, or 50 LSM nodes, because an append-only ledger is exactly the workload LSM was built for — sharded by account hash. Latency: the network is 10 milliseconds of a 2-second budget; the floor is four database commits, so every hop is async-acknowledged. The brutal number is availability: four parties at three nines compound to 99.6 — three hours a month somebody's failing payments — so durable queues with idempotency keys, per-bank circuit breakers, and retry budgets, because three retries at 50% failure is ×2.5 load exactly when capacity halves. All of it costs half a million a month and moves twelve billion dollars a day. The number that worries me is $25 million refused per minute of downtime — so I'd engineer the availability story and let throughput follow."

## Numbers to keep

- 500 M/day ÷ 10^5 = 5 k TPS → ×3 = 15 k normal peak → ×10 = 50 k event design point (Visa: ~65 k — same decade)
- ~10 records × ~200 B = 2 KB/tx → 1 TB/day logical → 5 TB/day provisioned → ~20 PB/decade in SQL, ~6 PB tiered
- 500 k row-writes/s → 500 SQL shards or 50 LSM nodes; append-only is what moves the ceiling
- 0.999^4 ≈ 99.6% ≈ ~3 h/month of some party failing → queues, idempotency, circuit breakers
- Retry load = 1 + failure rate × retries: ×1.2 mild, ×2.5 spiral — budgets and backoff are capacity
- ~$0.3–0.5 M/month of infra vs ~$12 B/day of flow; one peak minute of downtime refuses ~$25 M

## Drills

**Drill 20.1** — Festival midnight: 10 minutes at 100 k TPS against a write fleet that handles 60 k. Queue depth and drain time?

<details><summary>Answer</summary>

```
excess:  (100 k − 60 k) × 600 s = 24 M transactions queued
bytes:   24 M × 2 KB ≈ 50 GB — RAM-sized; ingest 40 k × 2 KB = 80 MB/s, under one Kafka broker
drain:   load falls back to ~15 k → spare = 60 k − 15 k = 45 k TPS
         24 M ÷ 45 k/s ≈ 530 s ≈ 9 minutes
```

Survivable with zero extra database nodes — *if* the product can say "accepted, completing shortly" instead of a synchronous yes. The queue converts a capacity problem into a latency promise; whether a payment may stay pending for minutes is a product and regulatory question the arithmetic just surfaced. Ask it before the festival, not during.
</details>

**Drill 20.2** — A bank carrying 20% of traffic dies for 30 minutes at normal peak. Size the retry queue and the catch-up.

<details><summary>Answer</summary>

```
inflow:   15 k TPS × 20% = 3 k TPS destined for the dead bank
parked:   3 k × 1,800 s = 5.4 M ≈ 5 M transactions × 2 KB ≈ 10 GB — trivial to hold
catch-up: replay at 2× the bank's normal share (6 k TPS) while live traffic (3 k) continues
          spare drain = 3 k TPS → 5 M ÷ 3 k ≈ 1,700 s ≈ 30 minutes
```

A 30-minute outage costs about an hour end-to-end, and 10 GB of queue is nothing. The two real constraints: the circuit breaker must trip fast and *park* — not let ×1.2–×2.5 retry amplification hammer a dying bank — and the drain must stay capped below the recovering bank's ceiling, or the replay re-kills it. A retry queue's drain policy is a capacity decision, not a config detail.
</details>

**Drill 20.3** — The regulator extends retention from 10 to 25 years. What does the archive cost at canon prices, and which tier?

<details><summary>Answer</summary>

```
logical:            1 TB/day × 365 × 25 ≈ 9 PB
object store, ×1.5: ≈ 14 PB × $20/TB-month ≈ $300 k/month at steady state
in-database, ×5:    ≈ 45 PB — at a few TB per SQL node, ~15,000 nodes: an absurdity, not a bill
```

Object store, and it isn't close — immutability is what makes the erasure-coded archive possible at all. The so-what: retention scales the archive linearly, so a 2.5× longer mandate stays a ~$300 k/month budget line instead of a redesign — but *only* because the tiering decision was already made. The chapter's storage story — 90 days hot, immutable archive forever — is what turned a regulator's letter into a line item.
</details>
