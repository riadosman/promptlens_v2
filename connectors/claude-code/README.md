# PromptLens for Claude Code

This connector uses Claude Code's documented `UserPromptSubmit` hook. It does not inspect or modify
Claude's UI. OAuth-style device authorization is protected with PKCE, tokens are stored in the OS
credential vault, and prompts are queued locally during network failures.

```bash
pnpm --filter @promptlens/connector-claude-code build
pnpm --filter @promptlens/connector-claude-code exec promptlens-claude install
pnpm --filter @promptlens/connector-claude-code exec promptlens-claude connect
```

Set `PROMPTLENS_API_URL` when the API is not available at `http://localhost:4000/v1`.
