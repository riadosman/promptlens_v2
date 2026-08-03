# Release readiness record

This record captures the latest local release-candidate verification. CI remains the authoritative, reproducible gate for a tagged release.

## 2026-07-31 verification

- `pnpm validate`: passed (format, lint, strict typecheck, unit/contract tests, production builds).
- `pnpm acceptance`: passed all applicable critical-path checks, including connector refresh rotation/reuse defense and tenant lifecycle. The fresh-database CI run is authoritative for the first-owner instance-admin break-glass branch.
- `pnpm e2e`: passed in Chromium, including axe checks on dashboard, consent, and administration pages.
- k6 smoke: 30 shared ingest/search iterations, 3 VUs, 0% failed requests, p95 272.30 ms (750 ms budget).
- Redis fault injection: readiness changed from 200 to 503 during interruption and recovered to 200 after restart.
- Dependency audit: no known vulnerabilities at the configured high-severity gate.
- Secret scan: no high-confidence committed secrets found.
- SPDX SBOM: generated with 522 packages.
- Backup/restore drill: PostgreSQL custom dump restored into an isolated PostgreSQL 17.6 environment. Tenant, project, prompt, analysis, audit-event, and connector-credential counts matched the source. Dump SHA-256: `351DB2D4A21E1F948AA05DC120743FF86AEF518D51A6DD13AD48459F2D097212`.

## 2026-08-03 verification

- `pnpm validate`: passed after hardening the worker control-store fixtures and rebuilding all production targets.
- `pnpm security:secrets`, `pnpm sbom`, and `pnpm audit --prod --audit-level high`: passed; the SBOM contains 522 packages and no high-severity dependency findings were reported.
- POSIX and PowerShell installer syntax checks: passed. Connector/login mode validation now fails before modifying hooks when an unsupported value is supplied.
- Live acceptance passed on the rebuilt stack (registration, sessions, connector, idempotency, analysis, admin, tenant isolation/RBAC, search/export, reanalysis, deletion, revoke, and refresh-token reuse defense). A disposable clean Compose project also passed the first-owner instance-admin and metadata-only break-glass branch (`breakGlassSupport:true`); its volumes were removed afterward and the original stack was restored.
- RLS audit passed for 12 protected tables: cross-tenant reads/writes and role escalation were blocked.
- Playwright Chromium/axe critical flow passed (`1 passed`).
- k6 smoke passed: 30 iterations, 3 VUs, 0% failed requests, p95 23.98 ms, p99 below the 1.5 s budget.
- Redis fault injection passed: readiness returned 503 while Redis was stopped and 200 after restart.
- Backup/restore drill passed with 39 tenants, 48 projects, 47 prompts, 60 analyses, 164 audit events, and 26 connector credentials restored and counted.

## External release controls

A public v1.0 tag still requires the repository-hosted CI gates, protected-tag approval, signed artifacts/provenance, supported-OS clean-machine runs, and an independent penetration test. These controls cannot be replaced by a local development-environment result.
