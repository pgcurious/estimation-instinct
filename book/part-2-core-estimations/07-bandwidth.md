# 7 — Bandwidth

*Storage asks what you keep. Bandwidth asks what you move — per second, in a unit one lowercase letter and a factor of 8 away from the one you think in.*

## The question this chapter answers

Watch a strong candidate lose the round in one sentence. The estimate is clean: 10k requests/s at peak, 200 KB per image. "Two gigabytes a second of egress — comfortably inside one 10 Gbps NIC." It is not inside. It is not close. A 10 Gbps NIC moves ten billion *bits* per second, and a byte is eight bits: 1.25 GB/s of real capacity. The candidate believed they had 5× headroom; they were 60% over the line. Every multiplication in the chain was correct, and the conclusion was still off by a factor of 8 — a bigger miss than forgetting peak, bigger than forgetting replication, delivered confidently in the round's final minute. This chapter exists so that sentence is never yours.

Bandwidth is the "move" half of rung 3 on [the Ladder](../part-1-foundations/04-the-ladder.md). [Storage](06-storage.md) handled the bytes that stay; this chapter handles the bytes in motion — how many per second, in which direction, through which pipes, at what price. The distinction is two clocks on the same bytes. A city water board sizes two unrelated things: tanks, which hold everything that has accumulated, and pipes, which pass only what flows this instant. Storage is tank volume — yesterday's writes still occupy it. Bandwidth is pipe diameter — capacity idle at 4 AM earns nothing at 9 PM, and a city floods when its engineers size the pipes for average rainfall instead of the cloudburst. Keep the picture; the traps section collects on it twice.

## From first principles

### One formula, two directions

A request arrives carrying bytes in and leaves carrying bytes out. Multiply each by the request rate and the theory is complete:

```
bandwidth = QPS × bytes per request      (ingress and egress, separately)
```

*Separately* is the load-bearing word. Ingress (client → you) and egress (you → client) are not halves of one number — they differ by orders of magnitude, and which one dominates is a diagnosis of the system. Content systems run 100:1 reads to writes, and the reads carry the fat payloads: a popular product photo is written once and read ten thousand times over its life, so egress dominates and the design conversation will be CDNs and edge caches. Telemetry, IoT, and logging invert it — millions of writers, a dozen dashboard readers — so ingress dominates and the conversation becomes ingestion fabric: Kafka brokers at ~100 MB/s apiece, write paths, compression. Announce the direction before sizing anything. "This is egress-dominated" is rung 3's version of "this is read-heavy": it tells the interviewer which half of the architecture the money goes to.

### Bits are not bytes

Now the lowercase letter. Networks are specified in bits per second because they descend from serial wires — one line, one bit at a time. Storage and memory are specified in bytes because they descend from addressable words. Two lineages, two units, a silent ÷8 between them:

```
1 Gbps  = 10^9 bits/s ÷ 8 bits/B  = 125 MB/s
10 Gbps                           = 1.25 GB/s
```

Memorize both conversions as facts, not arithmetic — under pressure you will not perform the ÷8, and the slip never announces itself. The discipline that makes the 8× error structurally impossible has two rules:

1. **Write the letter, every time.** Gbps or GB/s — never a bare "10G". Ambiguity is where the error breeds.
2. **Convert to bytes at first contact.** The moment a link spec enters the estimation, turn it into MB/s and never touch bits again — until the final sentence, if you quote a link size back.

> ⚡ **Instinct check** — Your egress is 2 GB/s; what link capacity do you ask the network team for? … 2 GB/s × 8 = 16 Gbps — two 10 Gbps uplinks. If you said "2 Gbps," you just under-provisioned by 8×, out loud, in the easy direction.

### The pipe on the back of every box

The canon commodity box carries a 10 Gbps NIC: 1.25 GB/s, sustained, in or out. Whether that pipe matters depends on payload size, and the dependence is dramatic.

A JSON API tier never notices its NIC. Typical business logic runs ~1k QPS per server at ~1 KB per response — 1 MB/s, a thousandth of the pipe. CPU is the wall; size the fleet with the QPS formula. A media tier inverts. Serving a cached image is trivial work — ~10k QPS of CPU — but 10k QPS × 200 KB = 2 GB/s, which crosses the NIC's 1.25 GB/s at just 6k QPS. The box runs out of network before it runs out of compute. So rung 4 carries a second server formula, the network-bound twin of the QPS one:

```
servers (network-bound) = peak egress ÷ 1.25 GB/s ÷ 0.6
servers (CPU-bound)     = peak QPS ÷ per-server QPS ÷ 0.6
fleet                   = max of the two
```

Compute both, take the max, and name the binder — "this tier is NIC-limited, not CPU-limited" is exactly the species of sentence [Machines & shards](09-machines-and-shards.md) trades in. The ÷0.6 is the same 60% utilization target as ever: pipes need headroom for the same reason CPUs do, and a NIC at 95% is a retry storm with the fuse lit.

Peak applies to pipes with full force. Egress follows human attention, and attention arrives in the canon spikes from [Traffic](05-traffic.md) — ×3 global, ×5 single-region, ×10+ for events. Size the NIC count at the cloudburst, not the average rainfall; the flood is the only second anyone remembers.

### Why CDNs exist, in numbers

Media egress has two merciful properties: the objects are immutable — nobody edits image four of a product listing — and the hot 20% of objects takes 80% of the reads. Immutable plus concentrated means cacheable at someone else's edge, so a CDN can serve **~80–95% of a media system's egress** — an assumption you state per system, exactly like a peak factor. What the offload buys, from canon:

| Lever | Origin | CDN edge |
|---|---|---|
| Delivery cost | ~$100 per TB | ~$30 per TB |
| Round trip to a far user | 250 ms cross-continent | ≤50 ms, same continent or closer |
| Who buys the NICs | you | them |

A CDN is a financial instrument that happens to improve latency. The money is the structural reason: at media scale, egress dwarfs compute and storage on the bill, and a 3× unit-price cut on 90% of the volume is a CFO-level event. The latency is the user-visible bonus — every image on the page arrives in one short hop instead of a 250 ms ocean crossing, a 5× cut on the slowest thing the user was waiting for. Either argument wins alone. Together they make "no CDN" indefensible for media — the worked example makes it exact.

### The traffic the client never sees

Everything so far counts bytes at your front door — north-south. Most of a system's arrows point sideways. For every bag a passenger checks at an airport counter, handlers move it three more times behind the wall — belt, cart, hold — and systems treat bytes the same way. The interviewer who asks **"what about the network between services?"** is testing whether your model of the system ends at the load balancer.

Count the crossings of one accepted write. Gateway to service: a hop. Then the byte goes to rest three times — service to primary, primary to each of two replicas: three crossings, which is canon's replication ×3 as the network feels it. Every ingress byte crosses the internal fabric roughly three more times after it arrives — before counting cache fills (every miss is an internal fetch from the tier below), fan-out (one message duplicated toward three recipients), or the analytics tap. The rule of thumb, derived rather than memorized:

```
east-west ≈ ingress × (service hops + 3 replication crossings)
```

In a write-heavy system, internal traffic exceeds client traffic comfortably — 5× is ordinary — which is why a cluster's spine is built fatter than its uplink. It is rarely the first wall: inside a datacenter, round trips cost 0.5 ms and the bytes don't carry the $100/TB internet-egress price. But it sizes real things — broker counts, replica lag, inter-AZ line items — and handling the question well is a seniority tell.

> 🎯 **In the room** — When the east-west question lands, answer with a multiplier, not a shrug: "Every accepted write crosses the fabric about three more times for replication, plus a hop or two between services — call internal traffic ~5× ingress. Here that's a few MB/s, a non-issue, and worth saying so. On the write-heavy version of this system, the same multiplier is what sizes the broker fleet." Two numbers, fifteen seconds, and your model audibly extends past the load balancer.

## The anchors

| Anchor | Value | Use it when |
|---|---|---|
| Bandwidth | QPS × bytes per request — ingress and egress separately | every rung-3 "move" estimate |
| 1 Gbps | 125 MB/s | any link spec enters the estimate |
| 10 Gbps NIC | 1.25 GB/s per box | the per-server egress ceiling |
| Network-bound servers | peak egress ÷ 1.25 GB/s ÷ 0.6 | media tiers; take the max vs the QPS count |
| CDN offload, cacheable media | ~80–95% — state yours | image, video, static egress |
| Origin vs CDN delivery | $100/TB vs $30/TB | the CDN decision, in money |
| Cross- vs same-continent RTT | 250 ms vs 50 ms | the CDN decision, in latency |
| East-west traffic | ≈ ingress × (hops + 3) | "the network between services" |

Every row is cheat-sheet canon except two, both said out loud as assumptions: the CDN offload band, and the east-west multiplier — re-derive that one from your system's actual hop count.

## 🧮 Worked example — an image-heavy product catalog

Interviewer: *"Global e-commerce platform, 20M DAU, image-heavy catalog. Walk me through the bandwidth."*

Spoken: "Browsing dominates — say 50 product views per user per day, 5 images per page at feed quality, 200 KB each. That's 1 MB of images per view. Global audience, so peak ×3."

```
views:   20 M DAU × 50 views/day  = 10^9 views/day
         10^9 ÷ 10^5 s            = 10 k views/s average → × 3 ≈ 30 k views/s peak
egress:  10^9 views × 1 MB        = 1 PB/day
         10 k views/s × 1 MB      = 10 GB/s average    (10,000 MB/s)
         30 k views/s × 1 MB      = 30 GB/s peak       (30,000 MB/s)
```

"Ingress is merchants updating the catalog — say 1M new images a day at 200 KB: 200 GB/day, about 2 MB/s. Five-thousand-to-one, egress to ingress. Egress is the system; I won't size the upload path further."

The origin fleet, raw — both formulas, then the max:

```
network-bound:  30 GB/s ÷ 1.25 GB/s ÷ 0.6   = 40 servers
CPU-bound:      30 k views/s × 5 images     = 150 k image requests/s peak
                150 k ÷ 10 k trivial ÷ 0.6  = 25 servers
fleet:          max(40, 25)                 = 40 — the NIC binds, not the CPU
```

Forty boxes to push pixels for a catalog, before any cleverness. Now the cleverness. Product images are immutable, and the hot 20% of products takes 80% of the views — say 90% CDN offload, stated as an assumption:

```
origin egress, peak:  30 GB/s × 10%          = 3 GB/s
origin fleet:         3 GB/s ÷ 1.25 ÷ 0.6    = 4 servers     (was 40)
```

Money, both ways:

```
volume:      1 PB/day × 30 days     = 30,000 TB/month
all-origin:  30,000 TB × $100/TB    = $3 M/month
with CDN:    27,000 TB × $30/TB     ≈ $810 k
             + 3,000 TB × $100/TB   = $300 k
             total                  ≈ $1.1 M/month
```

Interpret, and land it:

> "Egress is a petabyte a day — 30 GB/s at the peak. Served raw from origin, that's a 40-box fleet and $3M a month in egress alone. With 90% CDN offload it's a 4-box origin and about $1.1M. The CDN cuts the bill roughly 3× and the origin fleet 10× — it's not optional, it's the design. And since what remains is still almost all egress, the next dial is image weight: these are already-compressed media, so gzip does nothing — the lever is smaller variants, and shaving 100 KB per image halves the per-view payload, about half a million a month at this scale."

That closing dial survives a check — 100 KB × 5 images = 0.5 MB less per view, half the volume, half of $1.1M — and a landing sentence you can defend numerically beats any buzzword you could have ended on instead.

## ⚠️ Traps

- **The 8× slip.** "10 Gbps handles my 10 GB/s." It handles 1.25 GB/s. Write B or b on every quantity, convert links to bytes at first contact, and speak bits again only when quoting capacity back to the interviewer.
- **Quoting ingress when egress is the problem.** Uploads feel like the work, so candidates size them — but on content systems downloads outweigh uploads thousands-fold, and on telemetry it's the mirror image. Compute both directions, announce the ratio, size the dominant side.
- **Ignoring east-west.** Client-facing bytes are the minority of bytes on the wire. Replication ×3 alone makes every ingress byte cross the fabric three more times; add hops and cache fills and internal traffic beats client traffic. Have the multiplier ready before the interviewer reaches for it.
- **Sizing NICs for the average.** A pipe idle overnight banks nothing for the evening spike — apply the peak factor (×3, ×5, ×10) before dividing by 1.25 GB/s. Averages set the bill; peaks set the outage.
- **One clock for two questions.** The catalog above moves 1 PB/day but keeps only 200 GB/day of new images — moved is not kept. Bandwidth answers a per-second question, [storage](06-storage.md) a cumulative one; quote MB/s for the first, TB for the second, and never let one impersonate the other.

## Numbers to keep

- Bandwidth = QPS × bytes per request — ingress and egress separately; announce which direction dominates
- Networks speak bits, storage speaks bytes: 1 Gbps = 125 MB/s, 10 Gbps = 1.25 GB/s — convert to bytes at first contact
- A 10 Gbps NIC is 1.25 GB/s: media tiers go network-bound before CPU-bound
- Fleet = max( peak egress ÷ 1.25 GB/s ÷ 0.6 , peak QPS ÷ per-server QPS ÷ 0.6 )
- CDN: ~80–95% offload, $30 vs $100 per TB, 50 ms vs 250 ms — a financial instrument that happens to improve latency
- East-west ≈ ingress × (hops + 3) — internal traffic usually exceeds client traffic
- Bandwidth is per-second, storage is cumulative — same bytes, different clocks

## Drills

**Drill 7.1** — Mid-design, the interviewer says: "Your media tier peaks at 800 MB/s of egress — does a single 10 Gbps uplink hold?" You have ten seconds.

<details><summary>Answer</summary>

```
10 Gbps = 1,250 MB/s
800 MB/s ÷ 1,250 MB/s = 64% utilization
```

It holds — 36% from the ceiling, but above the 60% target you size everything else to. Say exactly that: "yes, at 64% — past my comfort line, so I'd pair the link before the next growth doubling, not after." The conversion must be reflex; the so-what is that *holds* and *healthy* are different claims.
</details>

**Drill 7.2** — An industrial IoT fleet: 10M sensors each report a 1 KB reading every 10 seconds; 1,000 operators watch dashboards that refresh 1 MB once a minute. Ingress, egress, and which one is the design problem?

<details><summary>Answer</summary>

```
ingress: 10 M sensors ÷ 10 s = 1 M readings/s × 1 KB  = 1 GB/s
egress:  1,000 × 1 MB ÷ 60 s                          ≈ 17 MB/s
ratio:   ingress ≈ 60× egress
```

The mirror image of a content system: ingress-dominated, so the conversation is ingestion, not CDNs — 1 GB/s ÷ 100 MB/s ≈ 10 Kafka brokers before replication, and ×3 replication puts ~3 GB/s of east-west behind them. One wrinkle worth saying out loud: sensors report on a fixed cadence, so there's no diurnal ×3 relief — machines don't sleep.
</details>

**Drill 7.3** — A streaming-thumbnails service egresses 200 TB/day, 90% of it cacheable. Monthly bill, all-origin versus CDN-offloaded — and is the difference worth an engineering quarter?

<details><summary>Answer</summary>

```
all-origin:  200 TB/day × 30 days × $100/TB  = $600 k/month
with CDN:    180 TB/day × 30 × $30/TB        = $162 k
             + 20 TB/day × 30 × $100/TB      = $60 k
             total                           ≈ $220 k/month
savings:                                     ≈ $380 k/month
```

Roughly 3× off the bill. At the canon $15k fully-loaded engineer-month, $380k/month is ~25 engineers — a two-engineer integration quarter (~$90k) pays back inside its first week. That's the financial-instrument framing made concrete: phrase CDN adoption as headcount and nobody argues.
</details>

**Drill 7.4** — A log pipeline ingests 50 MB/s at peak. Each record crosses gateway → parser → enricher, then lands in a store with ×3 replication. What does the internal network carry, and does a 1 Gbps inter-rack link survive?

<details><summary>Answer</summary>

```
crossings:  2 service hops + 3 replication  = 5
east-west:  50 MB/s × 5                     = 250 MB/s
1 Gbps link                                 = 125 MB/s — dead at half the load
```

A 5× amplification the client never sees, and the rack link fails before any server does. Two recoveries: a 10 Gbps fabric (1.25 GB/s — comfortable), or canon's logs-compress-÷10 applied at the gateway, *before* the hops: 5 MB/s × 5 crossings = 25 MB/s, and the 1 Gbps link yawns. Compress at the edge of the pipeline, not the end — the saving multiplies through everything downstream of wherever you shrink the bytes.
</details>

---
[← Previous: Storage](06-storage.md) · [Table of contents](../../README.md) · [Next: Memory & cache →](08-memory-and-cache.md)
