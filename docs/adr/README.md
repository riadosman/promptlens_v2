# Architecture Decision Records

ADRs record decisions that are expensive to reverse. Accepted records are immutable; a later ADR supersedes them when a decision changes.

| ADR                                  | Decision                                              | Status   |
| ------------------------------------ | ----------------------------------------------------- | -------- |
| [0001](0001-modular-monolith.md)     | Modular monolith with independent workers             | Accepted |
| [0002](0002-tenant-isolation.md)     | Shared schema with policy layer and PostgreSQL RLS    | Accepted |
| [0003](0003-authentication.md)       | Server sessions plus OAuth device/PKCE connector auth | Accepted |
| [0004](0004-connector-protocol.md)   | Versioned, least-privilege connector protocol         | Accepted |
| [0005](0005-ai-provider-boundary.md) | Provider adapters and validated structured output     | Accepted |
