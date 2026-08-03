# Service objectives and capacity gates

The self-hosted reference profile targets 99.9% monthly API availability, p95 interactive API latency
below 300 ms excluding exports, p95 prompt-ingest acknowledgement below 500 ms, and 99% of queued
analyses beginning within five minutes while an AI provider is healthy.

Alerts should cover API error ratio, p95/p99 latency, oldest outbox age, BullMQ waiting/failed counts,
PostgreSQL connections and storage, Redis memory, provider circuit state, and tenant budget rejection.
Prompt content and connector credentials must never appear in metric labels or traces.

Before a tagged release, operators run the clean-install acceptance flow, a representative search
dataset benchmark, a 30-minute steady ingest soak, provider 429/5xx fault injection, worker restart,
Redis interruption, and the documented restore drill. Capacity is increased when any sustained test
exceeds 70% CPU, memory, database connections, queue saturation, or the latency objectives above.
