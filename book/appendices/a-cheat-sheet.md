# Appendix A — The Cheat Sheet

*Every number and formula in this book, on one page. This is the canon: if a chapter and this page ever disagree, this page wins — and please file an issue.*

Print it. Tape it next to your monitor. The 30-day program assumes you can reproduce this page from memory by day 10 — not because memorization is the goal, but because you cannot reason at speed with numbers you have to look up.

---

## 1. Time

| Quantity | Exact | **Use in interviews** |
|---|---|---|
| 1 day | 86,400 s | **10^5 s** |
| 1 month | ~2.6M s | **2.5 × 10^6 s** |
| 1 year | ~31.5M s | **3 × 10^7 s** |
| Hours in a day that carry ~80% of regional traffic | — | **~8 h** |

Rounding a day up to 10^5 s under-counts QPS by ~15%. Known, accepted, swallowed by the peak factor.

## 2. Powers of ten & units

| Prefix | Power | Bytes shorthand |
|---|---|---|
| K (thousand) | 10^3 | KB |
| M (million) | 10^6 | MB |
| G (billion) | 10^9 | GB |
| T (trillion) | 10^12 | TB |
| P | 10^15 | PB |

- **2^10 ≈ 10^3** — the only binary/decimal bridge you need.
- Interviews use decimal. Nobody fails for ignoring GiB.
- Multiply powers: add exponents. `10^6 × 10^3 = 10^9` — a million things of 1 KB each is a GB. That sentence, as reflex, is half this book.

## 3. Object sizes

| Object | Size |
|---|---|
| int64 / timestamp / pointer | 8 B |
| UUID | 16 B |
| URL | ~100 B |
| Short text post (text only) | ~300 B |
| **Typical DB row / JSON payload / log line** | **~1 KB** |
| Email (no attachment) | ~50 KB |
| Thumbnail image | ~20 KB |
| Feed-quality photo | ~200 KB |
| Original phone photo | ~2 MB |
| Photo with all stored variants | ~2× original ≈ 4 MB |
| 1 min video, single 1080p rendition | ~50 MB |
| **1 min video, all renditions stored** | **~100 MB** |
| Song / 3-min audio | ~5 MB |
| Web page, total transfer | ~2 MB |

Default when you don't know: **1 KB for a record, 1 MB for a media object** — then refine.

## 4. The latency ladder

| Operation | Time | Anchor thought |
|---|---|---|
| L1 cache hit | 1 ns | the desk in front of you |
| Main-memory reference | 100 ns | a shelf across the room |
| Read 1 MB from RAM | 50 µs | — |
| NVMe random read | 100 µs | 1,000× slower than RAM |
| Read 1 MB from SSD | 1 ms | — |
| Same-datacenter round trip | 0.5 ms | across the building |
| Redis GET (in-DC, incl. network) | 0.5 ms | — |
| Indexed SQL query | 5 ms | — |
| HDD seek | 10 ms | — |
| Read 1 MB over 1 Gbps network | 10 ms | — |
| Same-continent round trip | 50 ms | — |
| Cross-continent round trip (e.g., India ↔ US East) | 250 ms | — |
| Human "instant" | 100 ms | the budget everything above must fit inside |
| Human "I'll wait" limit | 1 s | — |

The ladder's law: **each storage tier is ~3 orders of magnitude slower than the one above it** (RAM ns → SSD µs–ms → network/disk ms). Designs are arguments about which tier your hot path touches.

## 5. Per-machine capacity (commodity box: 32 vCPU, 128 GB RAM, 10 Gbps)

| Component | Sustained capacity | The reflex |
|---|---|---|
| Stateless API server — trivial work (proxy, cache hit) | ~10,000 QPS | **100 / 1k / 10k rule:** |
| Stateless API server — typical business logic | ~1,000 QPS | heavy / typical / trivial |
| Stateless API server — heavy work (ML inference, crypto, fan-out) | ~100 QPS | per server |
| SQL database (Postgres/MySQL), reads | ~5,000 QPS | |
| SQL database, writes | ~1,000 TPS | writes are the wall |
| SQL practical data ceiling per node | a few TB | beyond → shard |
| NoSQL LSM store (Cassandra-style), writes | ~10,000 TPS/node | |
| Redis / in-memory KV | ~100,000 ops/s | RAM-bound, not CPU-bound |
| Kafka broker | ~100 MB/s | |
| Concurrent WebSocket connections | plan **100k**/server (1M+ possible, tuned) | |
| Network: 1 Gbps | = 125 MB/s | 10 Gbps = 1.25 GB/s |
| NVMe SSD throughput | ~3 GB/s, ~500k IOPS | |
| HDD throughput | ~150 MB/s, ~150 IOPS | |

## 6. People & behavior

| Ratio | Default | Notes |
|---|---|---|
| DAU / MAU | **25%** | sticky messaging apps: 50% |
| Peak concurrent users / DAU | **10%** | |
| Peak factor (global, diurnal) | **×3** | say it as an assumption |
| Peak factor (single-region app) | ×5 | traffic compresses into ~8 h |
| Peak factor (event-driven: flash sale, festival, final over) | ×10+ | |
| Read:write — feeds, URL shortener, most content | **100:1** | |
| Read:write — typical web app | 10:1 | |
| Read:write — chat, telemetry | ~1:1 (× fan-out) | |
| Hot content | **20% of objects take 80% of reads** | the cache-sizing law |

## 7. Overheads & multipliers

| Adjustment | Multiplier |
|---|---|
| Replication | ×3 |
| Indexes, metadata, write amplification, headroom | ×1.5 |
| **Logical bytes → provisioned bytes (databases)** | **×5** (≈ 3 × 1.5) |
| Logical bytes → provisioned bytes (PB-scale blob stores, erasure-coded) | ×1.5 |
| Target utilization for compute | run at 60% → **÷0.6** when sizing |
| Text compression | ÷3 (logs: ÷10) |
| Media compression | already compressed — ×1 |
| Growth, when unstated | ×2/year — say the assumption out loud |

## 8. Availability

| Nines | Downtime/year | Downtime/month |
|---|---|---|
| 99% | 3.7 days | 7.3 h |
| 99.9% | 8.8 h | 44 min |
| 99.99% | 53 min | 4.4 min |
| 99.999% | 5.3 min | 26 s |

- Chain in **series**: multiply. Two 99.9% services in a row ≈ 99.8%.
- In **parallel** (either works): `1 − (1−a)²`. Two 99% replicas ≈ 99.99%.

## 9. Money (cloud, on-demand, rounded, ~2026)

| Item | Cost | Reflex |
|---|---|---|
| Compute | ~$30 per vCPU-month | **the 32-core box ≈ $1k/month** |
| Object storage (S3-class) | ~$20 per TB-month | storage is cheap |
| Block SSD storage | ~$100 per TB-month | |
| **Egress to internet** | **~$100 per TB** | egress runs the bill |
| CDN delivery, at volume | ~$30 per TB | why CDNs exist, in one number |
| Managed database | ~2× equivalent compute | |
| One engineer, fully loaded | ~$15k/month | the build-vs-buy unit |

## 10. The pocket formulas

```
1. Average QPS    = actions per day ÷ 10^5
2. Peak QPS       = 3 × average            (regional ×5, event ×10)
3. Storage        = rate × size × retention × 5     (×5: replication + overhead)
4. Bandwidth      = QPS × bytes per request          (ingress and egress separately)
5. Cache          = 20% of a day's read volume       (the 80/20 working set)
6. Servers        = peak QPS ÷ per-server QPS ÷ 0.6  (100/1k/10k rule for the divisor)
7. Shards         = max( total bytes ÷ 2 TB , write TPS ÷ node write ceiling )
8. Monthly cost   ≈ boxes × $1k  +  TB stored × $20  +  TB egress × $100
```

## 11. The Ladder — the 60-second skeleton

What you actually say in the room:

> "Let me put rough numbers on this before designing — it'll tell us where the hard parts are.
> **Users:** X million DAU, assume peak ×3.
> **Actions:** each does N reads and M writes a day → that's R reads/s and W writes/s, peak ~3× that.
> **Bytes:** each write is ~S, so storage grows rate × size × retention, times 5 for replication and overhead → T total.
> **Machines:** at our per-node ceilings that's C servers and D shards; the hot 20% fits in E of cache.
> **Money:** order of $F a month — fine / not fine.
> The number that worries me is ___, so the design should ___."

That last sentence is the entire point of estimating.

---
[← Previous: The 30-day program](../part-4-instinct/24-the-30-day-program.md) · [Table of contents](../../README.md) · [Next: Reference tables →](b-reference-tables.md)
