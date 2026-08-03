# Community connector example

This minimal example shows the stable SDK boundary. Production connectors should combine it with
PKCE device authorization and encrypted OS secret storage, as demonstrated by the Claude Code and
Codex reference connectors.

```ts
import { ConnectorClient } from '@promptlens/connector-sdk';

const client = new ConnectorClient({ apiUrl, storage });
const authorization = await client.beginAuthorization({
  platform: 'community-tool',
  displayName: 'Community Tool',
});

// Open authorization.verificationUri, show authorization.userCode, then poll at the advertised
// interval. The selected project is returned with the connector tokens.
await client.pollAuthorization(authorization);
await client.enqueue({
  clientEventId: crypto.randomUUID(),
  projectId: (await storage.loadTokens())!.projectId,
  content: 'The captured prompt',
  platform: 'community-tool',
  model: 'unknown',
  occurredAt: new Date().toISOString(),
  timezone: 'UTC',
  tags: [],
});
await client.flush();
```

See `connectors/sdk/src/connector-client.test.ts` for deterministic offline, duplicate, and token
rotation examples.
