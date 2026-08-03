# Connector revoke runbook

Tenant administrators revoke a connector from **Admin → Connectors**. Revocation sets the installation and all active credential-family records to revoked in one tenant-scoped transaction and writes an audit event.

After revocation, verify both the current and any rotated access token receive `401` from prompt ingest. The local connector may retain an encrypted offline queue, but it cannot flush until the user completes a new device authorization and explicitly selects a project. Do not delete the queue during incident handling unless the owner has approved loss of unsynchronized prompts.
