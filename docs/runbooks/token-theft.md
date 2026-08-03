# Token theft runbook

## Trigger and containment

Treat a reported connector refresh token, access token, session cookie, or password-reset token as compromised. Record incident time, reporter, tenant, installation/session identifier, and request IDs without copying the token into tickets or logs.

1. Tenant owners revoke the affected connector from **Admin → Connectors**. For a stolen web session, the user deletes the affected session from the session list; disable the user through instance administration when scope is unknown.
2. Revoke the entire connector token family. A reused refresh token does this automatically; do not rely on access-token expiry alone.
3. Rotate the user's password when account takeover is possible and invalidate all remaining sessions.
4. Search audit events for login, connector authorization, refresh reuse, ingest, export, membership, and deletion activity from the first suspected exposure time.
5. Preserve relevant redacted API logs and traces. Never preserve raw bearer tokens.

## Recovery and verification

Reconnect the device through a new PKCE device flow, verify old ingest returns `401`, and confirm the new connector is bound only to the intended project. Notify affected tenants under the applicable disclosure timeline and add a regression test before closing the incident.
