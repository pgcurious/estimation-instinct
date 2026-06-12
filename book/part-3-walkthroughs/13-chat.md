# 13 — Chat

*The system where concurrency, not QPS, is the star — and where "transient" still means petabytes.*

## The prompt

> "Design a WhatsApp-scale messenger. Numbers before boxes."

Candidates hear "scale" and reach for QPS, because every system so far rewarded that reflex. Here it's a decoy. The number that shapes a messenger never appears in a rate formula: it's how many people are connected *right now*, sending nothing, waiting. The second decoy is storage — "messages are deleted after delivery, so the server barely stores anything." Both instincts are reasonable, and both are wrong by orders of magnitude. Three minutes of arithmetic will say so.

## Scope it in 60 seconds

1. **1:1 only, or groups too?** Groups don't add senders — they multiply deliveries. The delivered:sent ratio becomes a number you must defend.
2. **End-to-end encrypted?** If the server can't read messages, it stores ciphertext only until every device has picked it up. Retention becomes a delivery queue, not an archive — the whole storage story changes shape.
3. **Is media in scope?** Photos and voice notes ride in the same chat window but are a different system in bytes.
4. **Delivery receipts?** Sent/delivered/read ticks turn every message into a small conversation of acks — ops, not bytes.

Assume the interviewer says: 1:1 dominates, groups capped at a few hundred members; E2E on; media yes; receipts yes.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| MAU | 1 B | WhatsApp-scale, as asked |
| DAU | 500 M | messaging is the canon's sticky exception: 50%, not the default 25% |
| Sends | 40 msgs/user/day | a primary messenger; heavy but ordinary |
| Message size | ~300 B | canon short-text anchor: ~100 B of text plus ids, timestamps, envelope |
| Delivered:sent | ≈ 3 | ~2 recipient devices per 1:1 send, receipts on top; groups push it higher (see pushback) |
| Media | 5% of messages at ~200 KB | the feed-photo anchor; voice notes land nearby |
| Offline queue | ~30 days | undelivered ciphertext held, then expired |

## Rung 1 — Users

```
DAU              = 1 B × 50%   = 500 M
peak concurrent  = 500 M × 10% = 50 M open connections
```

Stop on the second line; it is the chapter. Fifty million is not a rate — there is no "per second" attached. It's a standing population: 50 million TCP connections that exist at this instant, each held open for hours so a message can reach a phone the moment it exists instead of waiting for a poll.

An old telephone exchange is the right mental model: what sized the building was never calls dialed per minute — it was lines *held open*, a physical pair of wires occupied for every live conversation, however quiet. Chat gateways are that exchange reborn. The messages are almost incidental; the holding is the job.

> 🎯 **In the room** — On a chat prompt, opening with "before any traffic math: 500M DAU at the canon 10% concurrency is 50 million open sockets — that number will size an entire tier" tells the interviewer you've seen a messenger before. QPS-first says you haven't.

## Rung 2 — Actions (traffic)

```
sends:      500 M × 40 msgs/day = 20 B sends/day
            20 B ÷ 10^5 s       = 200 k sends/s average
            × 3 peak            = 600 k sends/s peak
deliveries: × 3 delivered:sent  ≈ 2 M ops/s peak through the delivery path
```

Chat is the canon's ~1:1 × fan-out row: each message is written once and pushed about three times — unlike the feed's 100:1, where one write is amortized across a hundred cacheable reads, nothing here can be cached, because every read is of a message that didn't exist a second ago. Interpret: 600k writes/s at peak. Writes are the wall, and rung 4's storage choice is already decided, two rungs early.

## Rung 3 — Bytes (storage & bandwidth)

**Text.**

```
20 B msgs/day × 300 B = 6 TB/day logical
```

E2E encryption makes the server a courier, not an archive: it holds ciphertext it cannot read until every recipient device acks, and the long tail of offline devices means a ~30-day queue window. Bound the store by the full window:

```
6 TB/day × 30 days            = 180 TB logical
× 5 (replication + overhead)  ≈ 1 PB provisioned
```

Transient, at this scale, is a petabyte. That sentence is the rung.

> ⚠️ **Trap** — Hearing "messages are deleted after delivery" and writing storage off as negligible. Deletion bounds *retention*, not volume — a billion users fill a 30-day bound to a petabyte. Multiply the window out before you call anything small.

**Media.**

```
20 B × 5%                       = 1 B media messages/day
1 B × 200 KB                    = 200 TB/day into the blob path
× 30 days × 1.5 erasure coding  ≈ 9 PB provisioned
```

Say it plainly: media is 30× text by daily bytes — 200 TB against 6 — while being 5% of messages. The blob path is a different system with different physics, and it gets its own walkthroughs.

**Bandwidth.**

> ⚡ **Instinct check** — 600 k msgs/s × 300 B: how many MB/s? Answer before reading on.

```
text peak:  600 k/s × 300 B ≈ 200 MB/s in    (× 3 fan-out ≈ 600 MB/s out)
media:      200 TB/day ÷ 10^5 s = 2 GB/s average ingest
            × 3 peak            ≈ 6 GB/s
            ÷ 1.25 GB/s per 10 Gbps NIC ≈ 5 NICs' worth
```

All the text of half a billion people fits through a couple of 10 Gbps ports; even media peak is a handful of NICs spread across a global fleet. Interpret and move on: bandwidth never decides anything in chat — the bytes matter as storage here, and as egress in the media path's own chapter.

## Rung 4 — Machines (cache, servers, shards)

**The gateway fleet** — the lesson of this walkthrough.

```
50 M sockets ÷ 100 k per server (canon plan number) = 500 connection servers
```

Notice what's absent: QPS. This tier is sized by socket count and the memory behind it:

```
~10 KB kernel + app state per socket × 100 k ≈ 1 GB of connection state per box
```

One gigabyte on a 128 GB machine — memory isn't the constraint either. The 100k plan number is engineering conservatism: blast radius (one box dying is 100k phones reconnecting at once), file-descriptor and event-loop limits, deploys that must drain politely. Headroom is already inside it — don't divide by 0.6 again. Tuned systems famously hold a million-plus sockets per box, which is why the real chat giants ran astonishingly few machines; plan at 100k and know the ceiling is 10× away.

Now check the work each box actually does: 600k sends/s across 500 boxes is ~1.2k messages/s in and ~4k pushes/s out per box — trivial work on the 100/1k/10k scale. The tier saturates on *count* while idling on CPU. That asymmetry is exactly why connection handling exists as its own tier.

**The message bus.**

```
600 k sends/s × 300 B ≈ 200 MB/s
÷ 100 MB/s per broker = 2 brokers by bytes   (× 3 replication → ~6)
```

By bytes, a toy. But bytes are the wrong dimension: messages within a conversation must arrive in order, so the bus is partitioned by conversation id, and the partition count is set by ordering and consumer parallelism — hundreds, for smooth rebalancing — not by throughput. It's the URL shortener's inversion, mirrored: there bandwidth was trivial and the cache was real; here broker bytes are trivial and the partition layout is real. Ops and ordering size this component; the bytes just ride along.

**Delivery and presence workers.** Size by in-flight work — rate × residence:

```
2 M deliveries/s × ~10 ms residence = 20 k in-flight
(residence: route lookup 0.5 ms + queue write a few ms + push 0.5 ms + slack)
```

Twenty thousand concurrent I/O-bound operations. An async worker comfortably holds a few hundred in flight, so ~100 boxes — run 200 for headroom and isolation. The tier doing all the visible work is not the big one.

**The undelivered-message store.** Every send lands once, deleted on final ack:

```
SQL:  600 k writes/s ÷ 1 k TPS/node  = 600 nodes   — writes are the wall
LSM:  600 k writes/s ÷ 10 k TPS/node = 60 nodes    → carve 128 logical shards
```

An LSM store wins by an order of magnitude on exactly the dimension chat stresses. Sixty physical nodes; carve the keyspace into 128 logical shards — the next power of two with headroom — so growth is shard moves, not resharding. One honesty check: the shard formula's byte arm says 1 PB ÷ 2 TB ≈ 500 nodes, but that assumes the queue sits at its full 30-day bound. It doesn't — most rows delete seconds after they arrive — so the write arm governs, and queue occupancy is the metric that warns you if that ever stops being true.

## Rung 5 — Money

```
gateways:               500 boxes × $1 k   = $500 k/month
workers + store + bus: ~300 boxes × $1 k   ≈ $300 k/month
media storage:          9 PB × $20/TB      ≈ $180 k/month
```

Read the first line twice: the dominant compute cost is the fleet that does the least visible work — 500 machines whose entire job is to hold sockets open. Presence is what you pay for. Order of $1M a month before media egress (the media chapters own that bill), which for a billion MAU is a tenth of a cent per user. Say "cost is fine — what's interesting is where it sits," and point at the gateways.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 50 M sockets vs 600 k sends/s | connection handling is a dedicated tier sized by presence, not traffic; everything behind it stays stateless and small |
| per-conversation ordering | partition the bus and store by conversation id — throughput never enters the partition decision |
| 1 PB transient queue | the 30-day offline window is a cost dial product can turn: halve the window, halve the store |
| media 30× text | the media path is a separate system — blob store plus CDN: [photo sharing](15-photo-sharing.md), [cloud storage](17-cloud-storage.md) |
| delivered:sent ≈ 3, groups push it | the group-size cap bounds the multiplier — a capacity decision wearing product clothes |

## The pushback round

**Interviewer:** "Group chats break your 1:1 math — a 200-member group message is 200 deliveries."

**You:** "They break the delivery multiplier, not the send rate — sends stay 600k/s peak regardless of who's listening, and the ciphertext is stored once per conversation either way. So I re-derive the multiplier, not the system. Say 10% of sends go to groups averaging 50 members:

```
deliveries per send = 0.9 × 2 + 0.1 × 50 ≈ 7
delivery path       = 600 k × 7          ≈ 4 M ops/s peak    (was ~2 M)
```

Double the delivery workers, double each gateway's push rate — both scale linearly. The send path, the bus, the store don't move. Architecture unchanged."

**Interviewer:** "Your 10% group share is a guess."

**You:** "It is, so stress it. At zero groups the multiplier is 2–3. At triple my guess — 30% of sends into 50-member groups — it's 0.7 × 2 + 0.3 × 50 ≈ 16: about 10M deliveries/s peak, five times the fleet, same shape. Share moves the number linearly. The dangerous axis is *size*: one uncapped 100k-member group turns a send into a broadcast storm. That's why the cap exists — 256 or 1,024 members isn't a UX preference, it's the ceiling on this multiplier. Product limits are capacity decisions wearing product clothes."

## Say it in 60 seconds

> "Numbers before boxes, agreed. A billion MAU; messaging is sticky, so 50% — 500 million DAU. The headline isn't traffic: at 10% concurrency that's 50 million open sockets, and at the 100k-per-box planning number that's a 500-server tier that exists only to hold connections — sized by sockets and RAM, never QPS. Traffic: 40 sends each is 20 billion a day — 200k a second, 600k peak — and at a delivered-to-sent ratio of about 3, two million delivery ops a second. Chat is one-to-one times fan-out; no cache saves you. Bytes: 300-byte messages make 6 TB a day of ciphertext, held until delivery with a 30-day offline queue — times 5, that's a petabyte of 'transient' data. Media: 5% of messages at 200 KB is 200 TB a day — thirty times the text — a separate blob system. The store sees 600k writes a second, which says LSM: 60 nodes, carve 128 shards. Money: half a million a month is gateways — presence, not traffic, runs this bill. The number that worries me is the delivery multiplier under groups, so I'd hold the group cap and watch queue occupancy."

## Numbers to keep

- Messaging stickiness: DAU = 50% of MAU; concurrency = 10% of DAU → 1 B MAU ⇒ 50 M sockets
- 50 M ÷ 100 k sockets/box = 500 gateways — sized by sockets and RAM (~10 KB each), never QPS
- 20 B sends/day = 200 k/s average, 600 k/s peak; × 3 delivered:sent ≈ 2 M delivery ops/s
- Text: 6 TB/day × 30-day queue × 5 ≈ 1 PB — transient at this scale is a petabyte
- Media: 5% × 200 KB = 200 TB/day — 30× text; a separate system
- 600 k writes/s ⇒ LSM 60 nodes (SQL would need 600); provision 128 logical shards
- Group math: multiplier = Σ (share × group size); the cap is what bounds it

## Drills

**Drill 13.1** — New Year's midnight: sends spike ×10 over average for 10 minutes. What breaks first — the gateways or the bus?

<details><summary>Answer</summary>

Walk each tier against 2 M sends/s (200 k × the canon event factor ×10):

```
gateways: sized by sockets, not sends — concurrency barely moves (the senders
          are already online); plan 100 k/box vs ~1 M tuned ceiling → holds
bus:      2 M/s × 300 B = 600 MB/s ÷ 100 MB/s = 6 brokers — at ceiling if you
          provisioned the minimal ~6; tight but cheap to pad in advance
store:    2 M writes/s vs 60 nodes × 10 k = 600 k/s ceiling → 3.3× over
```

Neither named suspect: the LSM write floor breaks first — stateful, and 60 nodes don't become 200 inside ten minutes. Bytes are a non-event (10 min × 2 M/s × 300 B ≈ 360 GB). The so-what: event spikes are *rate* spikes, and rate lands on the stateful write floor while presence barely moves — size the store for event peak, or have a shedding order ready (receipts first).
</details>

**Drill 13.2** — Product raises the group cap from 256 to 10,000 members. Recompute the delivery multiplier.

<details><summary>Answer</summary>

The multiplier is Σ (share of sends × recipients). Keep the earlier mix and let just 1% of sends hit 10k-member megagroups:

```
0.89 × 2 + 0.1 × 50 + 0.01 × 10,000 ≈ 1.8 + 5 + 100 ≈ 107× sends
600 k sends/s × ~100 ≈ 60 M delivery ops/s peak     (was 2–4 M)
```

A 1% tail now produces over 90% of all deliveries. The delivery fleet scales ~30×, and per-gateway push rates (60 M ÷ 500 ≈ 120 k/s per box) leave trivial-work territory — the socket tier turns rate-bound and its whole sizing logic flips. The so-what: a 10k group isn't a bigger chat, it's broadcast — push flips to pull, which is the [feed's](12-news-feed.md) architecture. The cap was the only thing keeping chat a push system.
</details>

**Drill 13.3** — Product proposes switching read receipts off "to save scale." Which numbers actually shrink?

<details><summary>Answer</summary>

The delivered:sent ≈ 3 budgeted ~2 device pushes plus ~1 receipt leg per send. Receipts off:

```
delivery path: 600 k × 2 ≈ 1.2 M ops/s peak     (−40%)
workers:       ~200 boxes → ~120                (≈ $80 k/month saved)
```

What doesn't move: sends, sockets — so the 500-box gateway line stays $500k; text storage (receipts were never retained); media; the bus by bytes. The so-what: receipts are pure ops on the delivery path, so killing them shrinks the second-biggest fleet and leaves the dominant line untouched. Before trading product features for capacity, check which tier the feature actually loads — in chat, most of the cost sits where features aren't.
</details>

---
[← Previous: News feed](12-news-feed.md) · [Table of contents](../../README.md) · [Next: Video platform →](14-video-platform.md)
