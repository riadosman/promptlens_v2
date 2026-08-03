# Incident response runbook

1. Classify severity and appoint an incident commander.
2. Preserve structured logs, audit events, deployment metadata, and database timelines without exporting prompt content broadly.
3. Contain the affected boundary: revoke connector families, user sessions, provider keys, or deployment credentials as appropriate.
4. Determine tenant and record scope using identifiers and audit metadata. Instance support access does not grant prompt-content access.
5. Notify affected operators/users according to contractual and legal timelines.
6. Patch, add regression coverage, rotate affected secrets, and restore service through a reviewed change.
7. Publish a blameless postmortem with timeline, root causes, control failures, and owned follow-ups.

For suspected tenant exposure, freeze nonessential exports and retain relevant audit records. For a compromised connector release, remove the artifact, revoke its credentials, publish checksums for the fixed build, and communicate the affected version range.
