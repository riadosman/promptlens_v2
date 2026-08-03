# Tenant data exposure runbook

## Immediate response

1. Declare a critical security incident and freeze the affected API path or deployment when cross-tenant access may still be active.
2. Revoke implicated sessions, connector families, support grants, and administrator access. Preserve database and audit snapshots before remediation.
3. Determine actor tenant, target tenant, resource IDs, request/trace IDs, first/last access, and whether content or metadata was returned. Do not reproduce prompt content in the incident record.
4. Validate PostgreSQL RLS policies and the application tenant context using the application database role, not the owner role.

## Remediation and return to service

Patch both the policy/use-case check and RLS defense where applicable. Add a negative tenant-escape regression covering list, direct-ID, search, export, admin, worker, and connector paths. Restore traffic only after the regression, dependency scan, and focused review pass. Tenant/legal notification follows jurisdictional and contractual deadlines; record the decision and affected data classes.
