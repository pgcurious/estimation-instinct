# Appendix B — Reference Tables

*The extended tables. [Appendix A](a-cheat-sheet.md) is the canon you memorize; this page is the shelf behind it — for checking, calibrating, and the occasional interview that goes one level deeper. Nothing here contradicts A; where A has a value, A wins.*

---

## 1. Time

### Periods, exact and usable

| Period | Exact seconds | **Use in interviews** |
|---|---|---|
| 1 minute | 60 | 60 |
| 1 hour | 3,600 | 3.6 × 10^3 |
| 1 day | 86,400 | **10^5** |
| 1 week | 604,800 | 6 × 10^5 |
| 1 month | ~2,629,800 | **2.5 × 10^6** |
| 1 year | ~31,557,600 | **3 × 10^7** |
| 10 years (a regulatory horizon) | — | 3 × 10^8 |

### Per-day → per-second, pre-computed

The ÷10^5 rule, as a lookup column — these pairs are worth recognizing on sight:

| Events per day | Average per second |
|---|---|
| 100k | 1 |
| 1 M | 10 |
| 10 M | 100 |
| 100 M | 1,000 |
| 1 B | 10,000 |
| 10 B | 100,000 |

Multiply by the peak factor (×3 global, ×5 regional, ×10+ event) before sizing anything.

## 2. Binary vs decimal, settled once

Interviews speak decimal: **1 GB = 10^9 bytes**, and nobody fails for ignoring GiB. The full account, so the topic never costs you another thought:

| Decimal (what you say) | Binary (what RAM chips do) | Gap |
|---|---|---|
| 1 KB = 10^3 B | 1 KiB = 2^10 = 1,024 B | 2.4% |
| 1 MB = 10^6 B | 1 MiB = 2^20 ≈ 1.05 × 10^6 B | 4.9% |
| 1 GB = 10^9 B | 1 GiB = 2^30 ≈ 1.07 × 10^9 B | 7.4% |
| 1 TB = 10^12 B | 1 TiB = 2^40 ≈ 1.10 × 10^12 B | 10.0% |

The gap grows ~2.4% per prefix and never reaches the ~3× that would matter at one significant figure. The bridge `2^10 ≈ 10^3` absorbs all of it; from the bridge: 2^20 ≈ 10^6, 2^30 ≈ 10^9, 2^32 ≈ 4 × 10^9 (the 32-bit ceiling), 2^64 ≈ 2 × 10^19.

### Powers of two worth recognizing

| Power | Value | Where it shows up |
|---|---|---|
| 2^8 | 256 | one byte's worth of values |
| 2^16 | ~65k | ports, shard counts that "feel big enough" |
| 2^32 | ~4 × 10^9 | IPv4 space, int32 ceiling — *smaller than humanity* |
| 2^64 | ~2 × 10^19 | int64/UUID-half space — never exhausted honestly |

## 3. The extended latency table

The canon ladder from [Appendix A §4](a-cheat-sheet.md), plus the rungs that occasionally come up. Values are deliberately round, ~2026 hardware.

| Operation | Time | Note |
|---|---|---|
| L1 cache hit | 1 ns | |
| Branch mispredict | ~5 ns | |
| L2 cache hit | ~5 ns | |
| Mutex lock/unlock, uncontended | ~25 ns | contention is what hurts, not the lock |
| Main-memory reference | 100 ns | |
| Compress 1 KB (fast codec) | ~3 µs | why compress-then-send usually wins |
| Send 1 KB over 1 Gbps | ~10 µs | wire time only |
| Read 1 MB sequentially from RAM | 50 µs | ~20 GB/s stream |
| NVMe random read (4 KB) | 100 µs | 1,000× a RAM touch |
| Read 1 MB sequentially from NVMe | ~300 µs | ~3 GB/s stream |
| Read 1 MB from SSD (canon, conservative) | 1 ms | |
| Same-datacenter round trip | 0.5 ms | |
| Redis GET (in-DC, incl. network) | 0.5 ms | = the round trip |
| Indexed SQL query, warm | 5 ms | |
| Read 1 MB sequentially from HDD | ~7 ms | ~150 MB/s stream |
| HDD seek | 10 ms | |
| Read 1 MB over 1 Gbps network | 10 ms | |
| Same-continent round trip | 50 ms | |
| DNS lookup, cold | ~20–100 ms | cached: ~0 |
| Cross-continent round trip | 250 ms | the physics rung |
| New HTTPS connection, cross-continent | ~500–750 ms | TCP + TLS 1.3 ≈ 2–3 RTTs — why connection reuse exists |
| Human "instant" | 100 ms | |
| Human "I'll wait" limit | 1 s | |

Sanity rule from [chapter 3](../part-1-foundations/03-the-numbers-that-matter.md): a quoted latency that falls *between* rungs (e.g., "10 µs disk read") is probably a fiction — the ladder doubles as a fraud detector.

## 4. Bandwidth & throughput conversions

### Bits, bytes, and days

| Link | Per second | **Per day (the useful form)** |
|---|---|---|
| 100 Mbps | 12.5 MB/s | ~1 TB/day |
| 1 Gbps | 125 MB/s | **~10 TB/day** |
| 10 Gbps | 1.25 GB/s | ~100 TB/day |
| 100 Gbps | 12.5 GB/s | ~1 PB/day |

Two reflexes: **÷8 for bits→bytes**, and **1 Gbps ≈ 10 TB/day** — the second collapses most bandwidth-vs-storage cross-checks into one multiplication.

### Streaming bitrates (delivered)

| Quality | Bitrate | Per hour delivered |
|---|---|---|
| Audio / music | ~128 kbps | ~60 MB |
| SD video (480p) | ~1 Mbps | ~0.5 GB |
| HD video (1080p) | ~5 Mbps | ~2 GB |
| 4K video | ~15–25 Mbps | ~8–10 GB |

Consistent with the canon's storage anchor: 1080p at ~5 Mbps ≈ 40 MB/min delivered, ~50 MB stored per rendition, **~100 MB/min with all renditions kept**.

## 5. Extended object sizes

The canon table from [Appendix A §3](a-cheat-sheet.md), plus rows that earn their place in specific designs:

| Object | Size | Shows up in |
|---|---|---|
| ASCII char / UTF-8 (English) | 1 B | |
| UTF-8, Indic & CJK scripts | ~3 B/char | sizing non-English text honestly |
| IPv4 address | 4 B | |
| int64 / timestamp / pointer | 8 B | |
| IPv6 address / UUID / MD5 | 16 B | |
| SHA-256 hash | 32 B | content addressing, dedup keys |
| Geo point (lat, lng as doubles) | 16 B | location streams |
| B-tree index entry | ~20–50 B | why indexes are ~10–30% of table size |
| Bloom filter | ~10 bits/key at 1% false positives | "have I seen this?" at scale: 1 B keys ≈ 1.25 GB |
| Session token / JWT | ~1 KB | auth headers on every request |
| HTTP request, headers included | ~1–2 KB | the floor under every "tiny" API call |
| Log line, structured | ~1 KB | canon default for a record |
| Mobile app install | ~50–200 MB | distribution, not storage, problems |

## 6. Storage media

| Medium | Sequential throughput | Random IOPS | Latency class |
|---|---|---|---|
| RAM | ~20 GB/s | — | ns |
| NVMe SSD | ~3 GB/s | ~500k | 100 µs |
| SATA SSD | ~500 MB/s | ~100k | 100s of µs |
| HDD (7,200 rpm) | ~150 MB/s | ~150 | 10 ms |
| Tape (archive class) | ~300 MB/s once streaming | effectively 0 | minutes to first byte |

The shape to keep: each tier down trades latency for $/TB. The canon's law — ~3 orders of magnitude per tier — has survived tape, disk, and flash; values rot, the shape doesn't.

## 7. The arithmetic of nines

### Downtime allowances

| Nines | Per year | Per month | Per day |
|---|---|---|---|
| 99% | 3.7 days | 7.3 h | ~14 min |
| 99.9% | 8.8 h | 44 min | ~1.4 min |
| 99.99% | 53 min | 4.4 min | ~9 s |
| 99.999% | 5.3 min | 26 s | ~1 s |

### Composition

```
series  (all must work):   multiply availabilities
parallel (any one works):  1 − (1 − a)^n
```

| Composition | Result | The lesson |
|---|---|---|
| Two 99.9% services in series | ~99.8% | chains erode |
| Four parties at 99.9% in series | ~99.6% — ~3 h/month | why payment switches obsess over queues |
| Two 99% replicas in parallel | 99.99% | redundancy buys nines cheaply |
| Three 99% replicas in parallel | 99.9999% | …with diminishing returns |

Parallel math assumes *independent* failures — shared dependencies (same AZ, same config push, same on-call) quietly break the formula, and most real outages live exactly there.

## 8. Extended money (cloud, on-demand, rounded, ~2026)

Canon rows in bold; the rest are secondary reference. Re-check yearly — prices rot fastest of all anchors.

| Item | Cost | Note |
|---|---|---|
| **Compute** | **~$30 per vCPU-month** | **the 32-core box ≈ $1k/month** |
| RAM (as part of instances) | ~$3–5 per GB-month | why TB-of-RAM designs get expensive fast |
| GPU, H100-class | ~$2–3/hour ≈ ~$2k/month | one GPU ≈ two commodity boxes |
| **Object storage (S3-class)** | **~$20 per TB-month** | |
| Block SSD storage | ~$100 per TB-month | |
| Cold archive (Glacier-class) | ~$1–4 per TB-month | retrieval costs extra and takes hours |
| **Egress to internet** | **~$100 per TB** | |
| **CDN delivery, at volume** | **~$30 per TB** | |
| Inter-region transfer | ~$20 per TB | replication has a freight bill |
| Inter-AZ transfer | ~$10 per TB | chatty microservices pay it constantly |
| Managed database premium | ~2× equivalent compute | |
| Managed cache / queue premium | ~2–3× equivalent compute | same logic as databases |
| **One engineer, fully loaded** | **~$15k/month** | the build-vs-buy unit |

Reading the table top to bottom: compute is rentable, storage at rest is nearly free, **bytes in motion are the bill**, and people dominate everything — the canon's cost reflexes, with two more lines of evidence.

## 9. Three formulas beyond the pocket eight

Most interviews never need these; the ones that do, need them exactly.

**Little's Law** — `L = λ × W` (things in the system = arrival rate × time each spends). Sizes anything that *holds*: concurrent connections = request rate × duration; queue depth = ingest rate × processing lag; open rides = ride starts/s × ride length.

```
chat:  50 M DAU × 10% concurrent          → 5 M sockets   (canon shortcut)
same by Little: 5 M arrivals/h × 1 h avg  → 5 M held      (the law underneath)
```

**The birthday bound** — random IDs start colliding around `√(space)`. 64-bit IDs (~2 × 10^19) get risky near ~5 × 10^9 issued — fine for request IDs, careless for a permanent global keyspace. The fix is more bits or coordination, and this formula is the one-line justification.

**Bloom filter sizing** — ~10 bits per key at 1% false positives. "Have we seen this URL/event/email?" over 10 B keys ≈ 12.5 GB of RAM — fits one box, which is usually the design-deciding fact.

---
[← Previous: The cheat sheet](a-cheat-sheet.md) · [Table of contents](../../README.md) · [Next: Real-world scale gallery →](c-real-world-scale-gallery.md)
