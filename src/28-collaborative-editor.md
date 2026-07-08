# 28 — Collaborative document editor

*A million keystrokes a second, landing on documents that each fit in a text message — the entire design is deciding where they queue.*

## The prompt

> "Design the backend for a real-time collaborative document editor — Google Docs scale. Many people editing the same document at once, changes appearing live. Put numbers on it first."

## Scope it in 60 seconds

Three questions move the numbers; the second moves them by ~2.5×.

1. **Live co-editing, or storage and history?** The live sync path — the stream of edits flowing between people who have the same document open right now. Storage, versioning, export, and rendering are separate rounds with their own arithmetic; the interesting problem is the op stream. Get the rest excluded.
2. **Keystroke-level ops, or debounced?** Every keystroke as its own op is ~5/s per typist; batching a few hundred milliseconds of typing into one op is ~1–2/s. That is a ~2.5× swing on the single busiest number in the system. Assume debounced to ~2 ops/s — and flag that this dial is ours to turn.
3. **Presence and cursors in scope?** Yes — but name them now as a separate *class* of traffic: high-frequency, ephemeral, never durable. They will turn out to be the loudest thing on the wire and the cheapest thing to lose.

## Assumptions on the table

| Quantity | Value | Why defensible |
|---|---|---|
| DAU | 100 M | given; canon 25% DAU/MAU → ~400 M MAU — propose it, get the nod |
| Docs open per concurrent user | ~3 | tabs left open — a doc, a shared sheet, meeting notes |
| Active editors (typing now) | 5% of open docs | most open docs are being read or idle, not typed into |
| Ops per active editor | ~2/s | debounced keystrokes; ~5/s raw — the dial from scope Q2 |
| Op record | ~100 B | canon URL-class: position + a few chars + author id + version, 8 B fields |
| Doc snapshot | ~10 KB | a few pages of text — a handful of the canon 1 KB row |
| Collaborators per active doc | ~2 average, ~100 cap | most docs are solo or a pair; the product caps the crowd |
| Read:write | ~1:1 × fan-out | canon for chat/telemetry — an edit is a broadcast, not a query |

## Rung 1 — Users

100M DAU, and the canon's 10% concurrency rule puts ~10M people in a document right now. But the load-bearing base here is not editors — it is *open connections*. Every open tab holds a persistent WebSocket, editor or not.

```
concurrent users  = 100 M × 10%       = 10 M
open connections  = 10 M × ~3 docs    = 30 M persistent WebSockets
```

Interpret: you are sized by who has the door open, not by who walks through it. A document parked in a background tab, untouched for an hour, still costs a live socket — and against the canon's 100k connections per box, 30M sockets is already a 300-machine floor before a single keystroke is typed. This is the number the whole system orbits.

## Rung 2 — Actions (traffic)

Split durable writes (ops appended to a log) from reads (broadcasts and presence).

**Writes — durable ops.** Compute from the day, then check against concurrency. Say each user types a page or two daily — ~1,000 ops.

```
100 M DAU × 1,000 ops/day = 10^11 ops/day
10^11 ÷ 10^5 s            = 1 M ops/s average   → ×3 = 3 M ops/s peak
```

Concurrency check: active editors = 5% × 30M = 1.5M, each ~2 ops/s → 3M/s — and that's at peak concurrency, so it lands exactly on the peak figure. The two views cohere; trust the number.

Interpret: 3M keystroke-sized durable facts per second. This is the number that decides everything below — hold it.

**Reads — broadcasts.** An op is not a query answered from a store; it is a message pushed to everyone else on that doc. Average ~2 collaborators means each op fans out to ~1–2 others.

```
op broadcasts = 3 M ops/s × ~2 co-editors = 6 M messages/s peak
```

Interpret: read:write is ~2:1 — canon chat territory, ~1:1 × fan-out. There is no read replica to offload onto; the read *is* the write, forwarded.

**Presence — the loud, cheap layer.** Cursor and selection updates fire on every keystroke and mouse move.

```
presence = 1.5 M active editors × ~10 updates/s = 15 M/s ingress
         × ~2 fan-out                           = 30 M messages/s downstream
```

Interpret: presence is 10× the durable op rate and not one byte of it is worth keeping. The instinct to protect, early: never let a cursor wiggle share a fate with a keystroke.

### The signature sub-question — can one document live on one server?

3M ops/s looks like a sharding problem. It isn't, because ops don't aggregate the way bytes do. A document's edits must **serialize** somewhere — some single place has to decide that your "the" landed before my "cat," or the sentence is gibberish. So the question that hides the whole design is not the 3M total; it is the busiest *single* document, because that is the one unit you cannot split.

> ⚡ **Instinct check** — before you shard 3M ops/s across a fleet: what is the *most* ops one document can possibly generate? Answer before reading on.

The village letter-writer knows the answer already. Outside an Indian post office, one scribe holds the pen while a whole family dictates a letter at once — the son, the mother, the uncle all talking over each other. Only one hand commits words to the page, in one order. Two pens on one sheet ruin the sheet. The pen is the serialization point, and it is never the bottleneck — a single scribe keeps up with a whole family easily, because a letter is short. The crowd is loud; the page is small; one hand is enough.

Price the busiest document. The product caps a doc at ~100 concurrent editors.

```
one hot doc:  100 editors × 2 ops/s     = 200 ops/s serialized into one log
its fan-out:  200 ops/s × 100 watchers   = 20 k messages/s out of one box
```

Interpret: 200 ops/s is nothing — trivial in-memory work, a rounding error against the 10k trivial-work ceiling. Even 20k broadcast messages is a sliver of one box. **The busiest document in the entire product fits comfortably on a single server.** That one fact is the architecture: pin each document to one owning server — *document affinity* — and its ops serialize in that box's memory with no cross-node coordination, no lock, no consensus per character. The 3M/s aggregate dissolves into millions of independent single-doc problems, each tiny.

Now see the alternative the number kills. If a doc's editors landed on different servers, every keystroke would need distributed agreement on ordering — a consensus round across the datacenter, ~0.5 ms each, on 3M ops/s. You would be running Paxos on the alphabet. The single-owner box is not an optimization; it is the thing that lets you avoid coordinating at all.

> 🎯 **In the room** — A candidate who says "OT or CRDTs" has named the merge algorithm. A candidate who says "pin the doc to one box so there's nothing to merge *across* nodes" has understood *why* serialization is cheap only when it's local. The algorithm is table stakes; the topology is the signal.

## Rung 3 — Bytes (storage & bandwidth)

Two stores: the op log (interesting) and the snapshots (boring).

**Op log — append-only.**

```
10^11 ops/day × 100 B    = 10 TB/day logical × 5 = 50 TB/day provisioned
kept raw, forever        ≈ 18 PB/year — to store what is a few pages of text per doc
```

Interpret: a retained keystroke-by-keystroke log out-grows a video platform, for a corpus that is fundamentally text. The forced move: **snapshot and compact.** Fold each doc's op log into a fresh ~10KB snapshot periodically and truncate the log. Opening a document loads the snapshot and replays the handful of ops since — never the history. Retain ~a day of ops for undo and recovery, and the hot op log is ~50 TB.

> ⚠️ **Trap** — Reconstructing a document by replaying its full op log. A doc edited for a year is 10^5+ ops; opening it cannot be a 100,000-step computation. Snapshots exist so that *open* is O(1), not O(history).

**Snapshots — the corpus.**

```
docs:   400 M MAU × ~50 docs   = 2 × 10^10 documents
corpus: 2 × 10^10 × 10 KB      = 200 TB logical
blob store × 1.5 (erasure)     ≈ 300 TB
```

Interpret: the entire written corpus of a Google-Docs-scale product is ~300 TB — smaller than a *single day's* uploads on the photo platform. Say it plainly: this is not a storage problem. Text is nothing.

**Bandwidth.**

```
op egress:       6 M msgs/s × 100 B    = 600 MB/s
presence egress: 30 M msgs/s × ~30 B   = 900 MB/s
total downstream ≈ 1.5 GB/s peak, spread across the connection fleet
```

Interpret: ~1.5 GB/s is a bit over one 10 Gbps port in aggregate, but split across 300+ connection boxes it is ~5 MB/s each — trivial. The bytes were never the problem; the sockets holding them are.

## Rung 4 — Machines (cache, servers, shards)

**Document-affinity fleet (WebSocket + serialize + broadcast).** This is one fleet, not two: the box that owns a document holds its editors' connections *and* processes its ops. Affinity means the connection and the computation live in the same place.

```
connections: 30 M ÷ 100 k/box       = 300 boxes (floor)
ops:         3 M/s ÷ 300 boxes       = 10 k ops/s each — right at the trivial ceiling
size up:     → ~500 boxes → ~60 k conns + ~6 k ops/s each, with headroom
```

Interpret: ~500 boxes, and they *are* the system. Each does trivial work — hold a socket, append an op, push it to a handful of watchers — but there are a great many sockets. This is a connection-count fleet, not a compute fleet.

**Op log (Kafka-style commit log).** Ordering per document → partition by doc-hash.

```
3 M ops/s × 100 B = 300 MB/s ÷ 100 MB/s per broker = 3 brokers
× 3 replication                                    ≈ 10 brokers
```

Interpret: the owning server already holds each doc's ops in order, so it batches appends — ~10 brokers carry every keystroke on the platform.

**Metadata (doc → owning server, permissions, doc list).**

```
2 × 10^10 docs × 1 KB = 20 TB ÷ 2 TB/node ≈ 10 shards
```

Interpret: the routing table — which box owns which doc — is the load-bearing lookup, and it is a modest sharded KV. **Presence gets no store at all:** cursors live in the owning box's RAM and die with the session, off the durable path entirely. That absence is a design decision, said out loud. And there is no read-through cache tier — the working set (the live document) already sits in the owning server's memory. Document affinity *is* the cache.

## Rung 5 — Money

```
fleet:    500 doc + 10 log + 10 metadata ≈ 520 boxes × $1 k   ≈ $520 k/month
storage:  300 TB snapshots × $20 + 50 TB op log × $100         ≈ $11 k/month — noise
egress:   ~500 MB/s avg × 2.5 M s ≈ 1,250 TB/month × $100       ≈ $125 k/month
```

Interpret: order $600k–$1M/month, and — unusually — the box fleet dominates, not storage and not egress. The podcast platform's bill was egress; the photo platform's was storage; **this bill is idle open tabs.** That single observation reframes every optimization: the win is not compressing bytes, it is shedding connections — hibernating idle documents, collapsing a user's tabs onto one multiplexed socket.

## So what — decisions these numbers force

| Number | Decision it forces |
|---|---|
| 200 ops/s + 20k fan-out for the busiest doc | one server owns a document — affinity, no cross-node coordination |
| 3M ops/s, but never on one document | serialize locally per doc; the global rate never needs a global order |
| 18 PB/yr uncompacted op log vs 300 TB snapshots | snapshot + truncate; *open* is O(1) from a snapshot, never O(history) |
| 30M presence msgs/s, zero durable value | presence is fire-and-forget, off the op log entirely |
| 30M connections vs 300 TB corpus | the problem is connection count, not bytes — size the socket fleet, not the disk |
| $520k boxes vs $11k storage | the bill is holding sockets open — optimize tabs, not bytes |

## The pushback round

**Interviewer:** "One server owns each document. That server dies. Now what?"

**You:** "The box was never the source of truth — the op log is. The owning server holds a lease over a Kafka partition; on failure, another box takes the lease, loads the latest snapshot, replays the ~day of ops since it — a few thousand at most, milliseconds of work — and resumes. Editors reconnect and re-sync from their last acked version. The box was a cache with a pen; the durable order lives in the log. And recovery is bounded *because* we snapshot — replaying a full history would make every failover a minutes-long outage; replaying since the last snapshot makes it a blink."

**Interviewer:** "A document goes viral — a live doc pushed to a 500,000-person all-hands. Your 100-editor cap saved you. Lift it."

**You:** "Now the single owner is a fan-out bottleneck — the celebrity from the feed chapter, at the level of one document. Serialization still fits: in a 500k-person doc, maybe five people actually type, so it's ~10 ops/s into the log, nothing. What doesn't fit is broadcast — one op × 500,000 watchers is 500k messages per keystroke, ~5 million messages a second, and half a million sockets is 5× what one box's 100k-connection ceiling can even hold. So split the roles: the single owner keeps serializing the *write* path, and a tier of fan-out replicas subscribes to its op stream, each pushing to a slice of the read-only viewers. Editors stay pinned for correctness; viewers scale out for reach. Pin the writers, replicate the readers — and the trigger is watchers-per-doc crossing what one box's sockets and egress can push."

**Interviewer:** "So when do you actually need OT or CRDTs at all?"

**You:** "Only across the one boundary affinity can't cover: offline edits and reconnection. While every editor is connected to the one owning server, ordering is trivial — the server sees ops in arrival order and that *is* the order; there is nothing to merge. OT and CRDTs earn their complexity only when two people edited the same region while partitioned from that server — offline on a plane, a dropped link — and their streams have to be reconciled after the fact. The arithmetic told me to make that the rare path: all 3M ops/s flow through single owners where merging is free, and the expensive conflict machinery runs only on reconnect. Most candidates reach for the CRDT first and the topology second. The numbers say do it the other way round."

## Say it in 60 seconds

> "Numbers first, because they pick the architecture. 100 million DAU, 10% concurrent, three docs open each — 30 million live WebSockets, and *that's* the system: you're sized by open tabs, not typists. A page of typing a day is 10^11 ops — a million a second, three million peak — but they never pile onto one document: the busiest doc, capped at a hundred editors, is 200 ops a second and 20k of fan-out, a sliver of one box. So pin each document to one owning server — it serializes edits in memory, no consensus per keystroke — and the three-million aggregate becomes millions of tiny independent problems. Persist an append-only op log, ~300 MB/s, ten Kafka brokers, and snapshot each doc so opening it is O(1), never a replay of a year of keystrokes — because kept raw, that log is 18 petabytes a year to store what is 300 terabytes of actual text. Presence is 30 million cursor messages a second, worth nothing durable, so it's fire-and-forget, off the log. Bytes are trivial; the corpus is smaller than a day of one photo app. Call it 500 boxes, about $600k a month, and the bill is holding connections open, not storing or moving data. The number that worries me is the 30 million persistent connections, so I'd design the document-affinity socket fleet and its failover first."

## Numbers to keep

- 100M DAU → 10M concurrent × ~3 open docs = **30M persistent WebSockets** — sized by open tabs, not typists
- 10^11 ops/day = **1M/s average, 3M/s peak**; presence **30M msgs/s**, durable-worthless
- Busiest doc (100 editors) = **200 ops/s + 20k fan-out** — fits one box → **document affinity**
- Op log **300 MB/s ≈ 10 Kafka brokers**; snapshot + truncate or it's **18 PB/yr** to store **300 TB** of text
- Corpus **~300 TB** — smaller than a day of a photo app; bytes are never the problem
- **~500 boxes ≈ $520k/month** — the bill is holding sockets open, not storage or egress
- Affinity makes serialization local and free; **OT/CRDT only earns its keep on the offline-reconnect path**

## Drills

**Drill 28.1** — For "consistency," someone proposes routing cursor and presence updates through the durable op log. Price the blowup.

<details><summary>Answer</summary>

```
presence rate:  30 M msgs/s (rung 2)
into the log:   30 M × 100 B (op-sized) = 3 GB/s ÷ 100 MB/s per broker = 30 brokers
× 3 replication:                         ≈ 90 brokers — for data deleted on disconnect
vs durable-op log:                        ~10 brokers
```

Nine times the entire durable-op fleet, to persist jitter you throw away the moment someone closes the tab — and worse, it couples cursor chatter to the write path, so a laggy log now stutters everyone's *typing*. So what: putting ephemeral data on the durable path is a category error. Separate fates for separate durability — presence lives and dies in the owning box's RAM, and never touches the log.
</details>

**Drill 28.2** — A public broadcast document: 500,000 read-only viewers, 5 editors. How does the fan-out tier size?

<details><summary>Answer</summary>

```
write path:   5 editors × 2 ops/s = 10 ops/s serialized → one owner, trivial
connections:  500 k viewers ÷ 100 k/box = 5 boxes just to hold the sockets
read fan-out: 10 ops/s × 500 k viewers  = 5 M msgs/s ÷ 5 boxes = 1 M msgs/s each
per-box egress: 1 M × 100 B             = 100 MB/s each — near one 1 Gbps port
```

So ~5–10 fan-out replicas subscribe to the single owner and each pushes to ~100k viewers. So what: the writers pin to one owner because serialization is cheap and must be singular; the viewers shard across a read-replica tier because fan-out is the cost — the feed chapter's push/pull split, reappearing inside a single document. Editors pinned for correctness, viewers scaled for reach.
</details>

**Drill 28.3** — The interviewer says: "Drop debouncing — send every keystroke as its own op." Which numbers move, and does the architecture?

<details><summary>Answer</summary>

```
ops/editor:   2/s → ~5/s (raw keystroke)  = 2.5×
peak ops:     3 M/s → ~7.5 M/s
op log:       300 MB/s → ~750 MB/s ÷ 100 = ~8 brokers × 3 ≈ 24
busiest doc:  100 editors × 5/s = 500 ops/s + 50 k fan-out — still a sliver of one box
```

The op log fleet grows ~2.5×; the connection fleet doesn't move (sockets are unchanged); the busiest single document still fits on one box. So what: debouncing is a pure server-load *dial*, not an architectural fork — affinity survives untouched, only the log fleet breathes. A client-side batch is the cheapest 2.5× the backend will ever be handed; name it as a lever *before* you buy brokers.
</details>
