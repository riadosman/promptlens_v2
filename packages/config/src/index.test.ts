import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig } from './index.js';

describe('runtime configuration', () => {
  it('keeps localhost development defaults usable', () => {
    const config = parseRuntimeConfig({});

    expect(config.DEPLOYMENT_MODE).toBe('local');
    expect(config.TRUST_PROXY).toBe(false);
  });

  it('rejects an unsafe public production deployment', () => {
    expect(() =>
      parseRuntimeConfig({
        NODE_ENV: 'production',
        DEPLOYMENT_MODE: 'public',
        WEB_ORIGIN: 'http://promptlens.example.com',
      }),
    ).toThrow();
  });

  it('accepts an explicitly hardened public production deployment', () => {
    const config = parseRuntimeConfig({
      NODE_ENV: 'production',
      DEPLOYMENT_MODE: 'public',
      WEB_ORIGIN: 'https://promptlens.example.com',
      TRUST_PROXY: 'true',
      SESSION_HASH_SECRET: 'a-production-secret-that-is-long-and-random',
      EMAIL_VERIFICATION_REQUIRED: 'true',
      SMTP_HOST: 'smtp.example.com',
    });

    expect(config.DEPLOYMENT_MODE).toBe('public');
    expect(config.TRUST_PROXY).toBe(true);
  });

  it('accepts NVIDIA as an AI provider', () => {
    const config = parseRuntimeConfig({
      AI_PROVIDER: 'nvidia',
      NVIDIA_API_KEY: 'nvapi-test-key-that-is-long-enough',
    });

    expect(config.AI_PROVIDER).toBe('nvidia');
    expect(config.NVIDIA_BASE_URL).toBe('https://integrate.api.nvidia.com/v1');
  });
});
