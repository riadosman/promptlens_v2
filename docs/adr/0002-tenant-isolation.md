# ADR-0002: Shared schema with policy layer and PostgreSQL RLS

- Status: Accepted
- Date: 2026-07-30

## Context

The platform must serve self-hosted and multi-tenant installations without duplicating the operational model. Application-only tenant filters are too easy to omit.

## Decision

Use a shared PostgreSQL schema. Every tenant-owned row carries `tenant_id`. Application use cases authorize the actor and scope repositories; PostgreSQL row-level security is an independent enforcement layer. Tenant context is set transaction-locally from authenticated server state, never client input.

## Consequences

Queries and indexes must begin with tenant scope, background work must restore verified context, and migrations require RLS regression tests. Exceptional cross-tenant operations use a separate audited administrative path.
