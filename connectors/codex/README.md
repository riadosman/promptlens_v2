# PromptLens for Codex

This connector uses Codex's documented `UserPromptSubmit` lifecycle hook. It uses PKCE device
authorization, the operating system credential vault, an idempotent offline queue, and no UI or DOM
scraping.

```bash
pnpm --filter @promptlens/connector-codex build
pnpm --filter @promptlens/connector-codex exec promptlens-codex install
pnpm --filter @promptlens/connector-codex exec promptlens-codex connect
```

After installation, open `/hooks` in Codex to review and trust the user hook.
