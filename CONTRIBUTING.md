# Contributing to PromptLens

PromptLens welcomes focused issues and pull requests. Security vulnerabilities must be reported through the process in `SECURITY.md`, not in a public issue.

## Local checks

Use Node.js 22 and pnpm 10, then run:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm validate
```

Changes to architecture, public contracts, authentication, tenant isolation or persisted data require an ADR or an update to an existing ADR. Every feature must include authorization tests and must not log prompt content or credentials.

## Pull requests

- Keep changes scoped and explain user-visible behavior.
- Add or update tests and documentation.
- Use conventional commit subjects where practical.
- Do not commit generated secrets, local `.env` files or production data.
- Confirm migrations are forward-compatible and safe for rolling deployments.
