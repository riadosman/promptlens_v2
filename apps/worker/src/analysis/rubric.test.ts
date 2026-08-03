import { describe, expect, it } from 'vitest';
import { analysisSchema } from './openai-analysis.provider.js';
import { calculateScore } from './rubric.js';

describe('analysis contract and rubric', () => {
  it('computes the versioned weighted score server-side', () => {
    expect(
      calculateScore({
        goalClarity: 100,
        context: 80,
        constraints: 60,
        outputFormat: 40,
        verifiability: 20,
        safety: 100,
      }),
    ).toBe(69);
  });

  it('rejects malformed or out-of-range model output', () => {
    expect(() =>
      analysisSchema.parse({
        dimensions: {
          goalClarity: 101,
          context: 50,
          constraints: 50,
          outputFormat: 50,
          verifiability: 50,
          safety: 50,
        },
        strengths: [],
        weaknesses: [],
        suggestions: [],
        improvedPrompt: 'valid',
      }),
    ).toThrow();
  });
});
