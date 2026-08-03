# ADR-0005: AI provider boundary and structured analysis

- Status: Accepted
- Date: 2026-07-30

## Context

Provider APIs, privacy guarantees, model identifiers and response formats change independently. Model output is untrusted and can be influenced by prompt injection.

## Decision

Place providers behind a small application-owned adapter. Analysis requests contain versioned rubric data and minimized prompt content. Providers must return a strict structured result; the server validates fields and calculates the final weighted score. The model receives no tools, secrets, filesystem or network capabilities.

## Consequences

Provider-specific SDK types do not enter the domain. A deterministic fake provider supports tests. Every analysis records provider, model, rubric and adapter versions for reproducibility.
