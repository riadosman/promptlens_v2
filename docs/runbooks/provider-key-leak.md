# AI provider key leak runbook

1. Revoke the key in the provider console immediately and record only its provider-side identifier or last four characters.
2. Disable the affected tenant/provider selection or stop workers if scope is global. Inspect provider usage, IP, model, token, and cost telemetry for anomalous activity.
3. Create a least-privilege replacement key in the deployment secret manager, update `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, and restart workers. Never place the key in `.env` artifacts, diagnostics, tickets, or chat.
4. Run a controlled analysis smoke test and verify budget/circuit-breaker metrics and redacted logs.
5. Remove old secret versions according to secret-manager policy, determine exposure scope, notify affected parties, and document how the key left its trust boundary.
