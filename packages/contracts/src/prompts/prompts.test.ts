import { describe, expect, it } from 'vitest';
import { ingestPromptRequestSchema } from './prompts.js';

const valid = {
  clientEventId: '2e51de79-640a-44f6-b715-e832593640a1',
  projectId: 'e87e8d0a-c601-40db-9f6c-ab95a3b731b5',
  content: 'Create a deployment plan',
  platform: 'test',
  model: 'test-model',
  occurredAt: '2026-07-31T00:00:00.000Z',
  timezone: 'UTC',
};

describe('prompt ingest limits', () => {
  it('accepts the maximum supported content size', () => {
    expect(
      ingestPromptRequestSchema.parse({ ...valid, content: 'x'.repeat(100_000) }).content,
    ).toHaveLength(100_000);
  });

  it('rejects oversized content and excessive tags', () => {
    expect(() =>
      ingestPromptRequestSchema.parse({ ...valid, content: 'x'.repeat(100_001) }),
    ).toThrow();
    expect(() =>
      ingestPromptRequestSchema.parse({
        ...valid,
        tags: Array.from({ length: 21 }, (_, index) => `tag-${index}`),
      }),
    ).toThrow();
  });
});
