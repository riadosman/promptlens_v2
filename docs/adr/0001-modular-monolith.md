# ADR-0001: Modular monolith with independent workers

- Status: Accepted
- Date: 2026-07-30

## Context

PromptLens needs transactional project, prompt, identity and authorization behavior, while AI analysis requires independent concurrency and failure handling. Splitting every domain into a service would add deployment and consistency cost before workload boundaries are measured.

## Decision

Use a stateless modular-monolith API and a separately deployed worker. Domain modules expose application interfaces rather than private database tables. API-to-worker work crosses a versioned event contract through a transactional outbox and durable queue.

## Consequences

Core changes remain transactional and self-hosting stays approachable. Worker load scales independently. A module may become a service only after measured scaling, isolation or release-cadence pressure justifies it.
