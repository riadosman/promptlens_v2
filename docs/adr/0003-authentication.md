# ADR-0003: Server sessions and OAuth connector authorization

- Status: Accepted
- Date: 2026-07-30

## Context

Browsers and installed connectors have different security properties. Sharing web cookies or collecting user passwords in connectors would expand credential exposure.

## Decision

Use revocable server-side sessions in secure cookies for the web application. Use Authorization Code with PKCE for browser-capable extensions and a standards-aligned Device Authorization flow for installed connectors. Connector access tokens are short-lived; refresh tokens rotate with reuse detection and are stored in the operating-system credential vault.

## Consequences

The platform needs consent, device management and revocation UI. Password grant and tokens in URLs are prohibited. Authentication does not imply resource authorization; every use case still evaluates policy.
