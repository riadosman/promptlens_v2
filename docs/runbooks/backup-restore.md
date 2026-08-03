# Backup and restore runbook

## Backup

Run `./promptlens backup` or `.\promptlens.ps1 backup`. The command creates a PostgreSQL custom-format dump in the ignored `backups/` directory without stopping the application. Copy the resulting file to encrypted, access-controlled storage and apply the deployment retention policy.

Object-store exports must be backed up separately. Prompt records themselves remain in PostgreSQL.

## Restore drill into a new environment

Never test restore by overwriting the only production database.

1. Provision an isolated PromptLens stack with the same or newer supported release.
2. Stop its API and worker so no writes occur.
3. Provision the `promptlens_owner`, `promptlens_app`, and `promptlens_worker` roles using the target release's database role-setup script. The roles must exist before ACLs from the dump are restored.
4. Copy the selected dump into the isolated PostgreSQL container.
5. Restore with `pg_restore --clean --if-exists --no-owner --role=promptlens_owner`.
6. Run `prisma migrate deploy` from the target release, re-apply role grants, then start API and worker.
7. Verify tenant, membership, project, prompt, analysis, audit, and connector counts. Connector credentials should be revoked when a restored environment is not the original production endpoint.
8. Run `node scripts/acceptance.mjs` using a new acceptance tenant.
9. Record RPO, RTO, dump checksum, release versions, and verifier identity.

Production restore requires an approved incident/change record and a fresh backup of the current state. Secrets are not contained in the database dump and must be restored from the secret manager.
