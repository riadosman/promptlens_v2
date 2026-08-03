# Queue flood runbook

## Diagnose

Use **Admin → Operations** and Redis/BullMQ metrics to record waiting, active, delayed, failed, retry, and oldest-job age. Correlate growth with tenant, connector installation, provider response class, API rate-limit events, and recent releases without logging prompt content.

## Contain and recover

1. Revoke an abusive connector or disable the responsible user; tighten the deployment ingress limit when traffic is distributed.
2. Stop workers only when processing amplifies provider cost or data corruption. Keep API idempotency/outbox writes intact unless storage saturation is imminent.
3. Open the provider circuit for sustained 429/5xx responses and enforce tenant token budgets. Scale workers only after checking PostgreSQL, Redis, and provider capacity.
4. Retry failed jobs through the admin operation only after the cause is removed. Never bulk-retry malformed/non-retryable output.
5. Verify queue age returns within the SLO, accepted prompts receive exactly one analysis, and no tenant exceeded budget. Preserve aggregate metrics for the postmortem.
