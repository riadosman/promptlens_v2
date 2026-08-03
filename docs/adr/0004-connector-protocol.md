# ADR-0004: Versioned connector protocol

- Status: Accepted
- Date: 2026-07-30

## Context

AI clients differ in capture capabilities and release cadence. A connector that depends on an unstable interface can silently lose prompts or gain excessive access.

## Decision

Define a versioned connector manifest and SDK with detection, authentication, capture, project selection, synchronization and health capabilities. Ingest is idempotent and supports offline delivery. Official artifacts are signed and permissions are explicit. DOM-dependent connectors remain experimental.

## Consequences

The server supports the current and previous protocol major during transitions. Compatibility fixtures and platform-version tests are release gates. A kill switch can disable a broken connector version without affecting core ingest.
