import { describe, expect, it } from 'vitest';
import { createDeviceAuthorizationRequestSchema } from './device.js';

describe('connector protocol compatibility', () => {
  it('rejects unsupported protocol versions', () => {
    expect(() =>
      createDeviceAuthorizationRequestSchema.parse({
        platform: 'test',
        displayName: 'Old connector',
        protocolVersion: '0.9',
      }),
    ).toThrow();
  });

  it('requires the PKCE method and challenge as a pair', () => {
    expect(() =>
      createDeviceAuthorizationRequestSchema.parse({
        platform: 'test',
        displayName: 'Incomplete PKCE connector',
        protocolVersion: '1.0',
        codeChallenge: 'a'.repeat(43),
      }),
    ).toThrow();
  });
});
