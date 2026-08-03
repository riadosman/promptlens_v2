# Upgrade runbook

1. Read release notes and the migration compatibility matrix.
2. Create and verify an encrypted backup.
3. Run the target version in staging against a restored production-sized dataset.
4. Run `./promptlens upgrade` or `.\promptlens.ps1 upgrade`. Migrations run before application containers are replaced.
5. Verify health, queue age, error rate, login, connector ingest, analysis completion, and tenant isolation.
6. Roll application images back if necessary only when release notes declare the migration backward compatible. Database rollback is restore-based; migrations are never silently reversed.

Do not skip major versions unless the support matrix explicitly permits it.
