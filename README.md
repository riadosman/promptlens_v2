# PromptLens

PromptLens captures prompts from authorized AI connectors, assigns every prompt to a project, analyzes quality asynchronously, and keeps the original, recommendations, score, and professionally improved version in a tenant-isolated workspace.

The project is an Apache-2.0 licensed, self-hostable TypeScript platform. It contains the web application, API, analysis worker, PostgreSQL schema, Redis queue, connector SDK, and administration surfaces in one repository.

## What works

- Revocable server-side authentication with Argon2id passwords, email verification and one-time password reset tokens.
- Multiple workspaces per user, OWNER/ADMIN/MEMBER/VIEWER policies, project lifecycle, and PostgreSQL row-level security.
- PKCE-protected Device Authorization connector consent, short-lived access tokens, rotating refresh tokens, reuse detection, and connector revocation.
- Offline-capable connector SDK with idempotency, exponential backoff, token refresh, and health diagnostics.
- Transactional prompt/outbox creation, BullMQ delivery, deterministic test provider, and OpenAI/Anthropic structured-output adapters.
- Prompt scoring, strengths, weaknesses, suggestions, improved versions, usage records, FTS/trigram search, filters, and cursor pagination.
- Responsive user and tenant/instance administration panels.
- Non-root containers and separate migration, API, and worker database roles.

The authoritative scope and remaining release gates are tracked in [the roadmap](docs/ROADMAP.md). A passing build does not by itself imply that every v1.0 operational gate has been certified.

## One-command installation

Requirements:

- Docker Desktop or Docker Engine with Compose v2.
- At least 4 GB free memory and ports `3000`, `4000`, `55435`, and `6379` available on loopback.
- On Linux/macOS, OpenSSL and a POSIX shell.

Clone the repository and run one command.

Linux/macOS:

```bash
git clone <repository-url> promptlens
cd promptlens
./promptlens install
```

Windows PowerShell:

```powershell
git clone <repository-url> promptlens
cd promptlens
.\promptlens.ps1 install
```

The installer performs a Docker preflight, creates `.env` with cryptographically random local secrets, builds pinned application images, creates least-privilege database roles, runs all migrations, and waits for service health. It then detects Claude Code and Codex, installs matching prompt hooks, opens browser consent, and waits for device login. If neither CLI is detected, an interactive installation asks which connector to install. The process is idempotent and does not remove volumes.

Headless automation can set `PROMPTLENS_CONNECTORS=none`, or choose `claude-code`, `codex`, or `all`. `PROMPTLENS_CONNECTOR_LOGIN=always|never|auto` controls browser authentication; `auto` logs in only on an interactive terminal. Source connector installation requires Node.js plus Corepack/pnpm, which are normally already present with the supported AI CLIs.
Invalid connector or login-mode values fail fast before any hook is changed.

Open:

- Web: <http://localhost:3000>
- API liveness: <http://localhost:4000/v1/health/live>
- API readiness (PostgreSQL + Redis): <http://localhost:4000/v1/health/ready>
- OpenAPI 3.1 JSON: <http://localhost:4000/v1/openapi.json>

Operational commands:

```powershell
.\promptlens.ps1 start
.\promptlens.ps1 status
.\promptlens.ps1 logs
.\promptlens.ps1 stop
.\promptlens.ps1 doctor
.\promptlens.ps1 backup
.\promptlens.ps1 upgrade
.\promptlens.ps1 connectors
```

Use `./promptlens` with the same command names on Linux/macOS. `stop` stops containers but preserves all named volumes.

## First use

1. Create the first account at `/register`. The first account becomes its workspace owner and instance administrator.
2. Create or select a project in the dashboard.
3. Start a compatible connector. It requests a device code and opens `/connect`.
4. Sign in, choose the project, and approve the connector.
5. Submitted prompts are accepted idempotently and analyzed by the worker. Results appear in prompt history.

The one-command installer performs this automatically. Manual source connector setup is also available:

For a complete clean-machine walkthrough—including every environment variable, migration path,
health check, connector verification step, test command, troubleshooting scenario, and architecture
map—see the [detailed installation guide](docs/INSTALLATION.md).

```bash
# Claude Code (documented UserPromptSubmit hook)
pnpm --filter @promptlens/connector-claude-code build
pnpm --filter @promptlens/connector-claude-code exec promptlens-claude install
pnpm --filter @promptlens/connector-claude-code exec promptlens-claude connect

# Codex (documented UserPromptSubmit lifecycle hook)
pnpm --filter @promptlens/connector-codex build
pnpm --filter @promptlens/connector-codex exec promptlens-codex install
pnpm --filter @promptlens/connector-codex exec promptlens-codex connect
```

Both connectors use the OS credential vault, queue safely during outages, and avoid UI/DOM scraping.

Every connector is restricted to its approved tenant, platform, and default project. Revoking it from Administration invalidates all active credentials.

Workspace owners can configure retention, AI provider/model, and monthly token budget in Administration. The same surface provides a versioned full-data export and a seven-day, cancellable workspace deletion flow. Retention enforcement and due deletions run in the worker.

Instance support access is owner-approved, metadata-only, audited, revocable, and expires after one hour. Prompt and analysis content is never returned by the support endpoint.

## Configuration

The installer-generated `.env` is ignored by Git. Important options:

| Variable                                  | Default                    | Purpose                                                            |
| ----------------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| `DEPLOYMENT_MODE`                         | `local`                    | Use `public` to enable internet-facing configuration safeguards    |
| `WEB_ORIGIN`                              | `http://localhost:3000`    | Exact browser origin used by CORS, CSRF, cookies, and action links |
| `TRUST_PROXY`                             | `false`                    | Trust reverse-proxy client IP headers; required in public mode     |
| `PUBLIC_API_URL`                          | `http://localhost:4000/v1` | API URL embedded in the web build                                  |
| `AI_PROVIDER`                             | `fake`                     | `fake`, `openai`, or `anthropic`                                   |
| `AI_MODEL`                                | `gpt-5.6-luna`             | Provider model identifier                                          |
| `OPENAI_API_KEY`                          | unset                      | Required only when `AI_PROVIDER=openai`                            |
| `ANTHROPIC_API_KEY`                       | unset                      | Required only when `AI_PROVIDER=anthropic`                         |
| `ANTHROPIC_MODEL`                         | `claude-sonnet-5`          | Pinned Anthropic model identifier                                  |
| `EMAIL_VERIFICATION_REQUIRED`             | `false`                    | Require verification before login; set `true` with SMTP configured |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`   | unset, `587`, `false`      | SMTP transport                                                     |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | unset                      | Optional SMTP authentication and sender                            |
| `LOG_LEVEL`                               | `info`                     | Structured log level                                               |
| `OTEL_EXPORTER_OTLP_ENDPOINT`             | unset                      | Full OTLP/HTTP traces endpoint; telemetry stays local when unset   |

For an internet-facing deployment:

- Put web and API behind a TLS reverse proxy and set HTTPS `WEB_ORIGIN`/`PUBLIC_API_URL` values before building.
- Set `DEPLOYMENT_MODE=public` and `TRUST_PROXY=true`; unsafe public configuration fails at startup.
- Set `EMAIL_VERIFICATION_REQUIRED=true` and configure SMTP.
- Replace local `.env` storage with the deployment platform’s secret manager.
- Configure encrypted PostgreSQL backups and restrict infrastructure ports.
- Use a real AI provider only after reviewing its retention and regional policies.

Never commit `.env`, database dumps, provider keys, connector tokens, or prompt exports.

For the complete server, DNS, HTTPS, SMTP, AI provider, migration, backup, monitoring,
update, and rollback procedure, follow the
[production deployment guide](docs/PRODUCTION_DEPLOYMENT.md).

## Development

Requirements are Node.js 22.14+, Corepack/pnpm 10, and Docker Compose.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm infra:up
pnpm --filter @promptlens/database db:deploy
pnpm dev
```

Development infrastructure uses the separate `promptlensv-dev` Compose project and PostgreSQL port `55435`; it does not share production installer volumes.

Run every repository quality gate:

```bash
pnpm validate
pnpm acceptance
pnpm e2e
pnpm restore:drill
```

`validate` runs formatting, lint, strict TypeScript checks, tests, and optimized builds for all workspaces. The additional commands exercise the live critical path, browser accessibility, and isolated backup/restore flow.

## Repository layout

```text
apps/
  api/       NestJS/Fastify HTTP API
  web/       Next.js user and administration UI
  worker/    BullMQ analysis/outbox worker
  cli/       diagnostics and local commands
connectors/
  sdk/         versioned connector protocol client
  claude-code/ official Claude Code hook connector
  codex/       official Codex lifecycle-hook connector
packages/
  config/ contracts/ database/ domain/ observability/
infra/
  compose/ postgres/
docs/
  adr/ runbooks/
```

Read [architecture](docs/ARCHITECTURE.md), [security model](docs/SECURITY.md), [release policy](docs/RELEASES.md), [service objectives](docs/SLO.md), and [contribution guide](CONTRIBUTING.md) before changing public contracts or trust boundaries.

## Security

Prompt content is restricted data. The runtime uses:

- opaque HTTP-only browser sessions and origin validation for cookie-authenticated mutations;
- endpoint-specific Redis-backed abuse limits;
- connector credentials stored only as SHA-256 token digests, with rotation and family revocation;
- provider API keys supplied only as deployment secrets and never stored in tenant records;
- explicit application policies plus forced PostgreSQL RLS under non-superuser roles;
- parameterized database access, strict request schemas, security headers, exact-origin CORS, and bounded bodies;
- structured logging that excludes prompt and credential contents;
- non-root application containers with dropped Linux capabilities and `no-new-privileges`.

Playwright and axe cover the dashboard, consent, and administration critical paths. The CI k6 smoke gate enforces ingest/search p95 and p99 latency budgets without bypassing production rate limits.

Report vulnerabilities privately according to [SECURITY.md](SECURITY.md). Do not open a public issue containing exploit details or sensitive data.

## License

Copyright 2026 PromptLens contributors. Licensed under the [Apache License 2.0](LICENSE).
