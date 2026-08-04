# Task 5 Report: Editorial Tenant and Instance Administration

## Delivered

- Derives the administration heading from instance availability: `Instance operations` for instance data and `Workspace administration` otherwise.
- Reordered administration content to tenant metrics, instance-only health/queue/users, workspace policy/export/deletion, metadata-only support, then members/audit/connectors.
- Kept all existing admin API operations, confirmations, destructive wording, metadata-only support copy, and no cross-tenant prompt request.
- Replaced the administration layout with paper/ink editorial sections, acid actions, signal destructive actions, compact records, and a 760px action stack.
- Updated the critical flow for the new project route and instance heading assertion.
- Corrected the accessibility contrast found by the existing critical-flow scans for dashboard session text, legacy device-authorisation controls, and administration form labels/controls.

## Verification

- `node_modules\\.bin\\tsc.cmd -p apps\\web\\tsconfig.json --noEmit` — passed; restored `apps/web/tsconfig.tsbuildinfo` afterward.
- `set E2E_WEB_ORIGIN=http://localhost:3001&& node_modules\\.bin\\playwright.cmd test critical-flow.spec.ts` — dashboard and device-consent axe scans passed after the scoped contrast corrections.
- The final required instance-heading assertion remains red in this reused local database: a newly registered user receives no `overview.instance`, so the intentionally derived fallback heading is `Workspace administration`.
- A later rerun was blocked before assertions by API registration rate limiting (`Rate limit exceeded, retry in 5 minutes.`).

## Environment Notes

- The initial red run could not reach the web server until the isolated local app was started on port 3001.
- A fresh E2E database where the registering user has instance data is required for the final `Instance operations` assertion to pass.
