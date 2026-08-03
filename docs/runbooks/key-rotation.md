# Key rotation runbook

PromptLens self-hosting uses separate session/IP HMAC secrets and provider credentials. Provider keys are never stored in the application database.

1. Take and verify a database backup, announce a maintenance window, and stop API/worker writes.
2. Generate new high-entropy `SESSION_HASH_SECRET` and `IP_HASH_SECRET` values in the deployment secret manager or protected `.env` file. Do not print them to the terminal transcript.
3. Replace provider keys independently in the secret manager and revoke old provider keys after a smoke analysis succeeds.
4. Restart the stack with `./promptlens upgrade` or `.\promptlens.ps1 upgrade`. Changing the session HMAC secret intentionally invalidates all web sessions; users must sign in again.
5. Verify readiness, login, connector ingest, analysis, redacted logging, and audit events. Existing connector hashes do not require re-encryption; revoke/reconnect connector families when their token material may be exposed.
6. Destroy retired secret versions only after rollback approval expires and record verifier, time, affected services, and secret version identifiers.
