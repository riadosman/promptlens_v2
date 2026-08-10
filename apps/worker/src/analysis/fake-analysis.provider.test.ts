import { describe, expect, it } from 'vitest';
import { FakeAnalysisProvider } from './fake-analysis.provider.js';

describe('FakeAnalysisProvider', () => {
  it('identifies missing context, constraints, format and verification', async () => {
    const result = await new FakeAnalysisProvider().analyze('Write a launch plan');

    expect(result.weaknesses).toHaveLength(4);
    expect(result.dimensions.context).toBe(45);
    expect(result.improvedPrompt).toContain('Success criteria:');
  });

  it('rewards explicit, contextual and verifiable instructions', async () => {
    const prompt =
      'Create a markdown table for this production migration. You must limit downtime, include the project context and verify every step with acceptance tests. '.repeat(
        2,
      );
    const result = await new FakeAnalysisProvider().analyze(prompt);

    expect(result.weaknesses).toEqual([]);
    expect(result.dimensions).toMatchObject({
      context: 80,
      constraints: 82,
      outputFormat: 85,
      verifiability: 88,
    });
  });
});
