import { describe, expect, it } from 'vitest';
import { parseNvidiaAnalysis } from './nvidia-analysis.provider.js';

describe('NVIDIA analysis provider', () => {
  it('validates a fenced structured response', () => {
    const result = parseNvidiaAnalysis(`\`\`\`json
{
  "dimensions": {
    "goalClarity": 80,
    "context": 70,
    "constraints": 60,
    "outputFormat": 90,
    "verifiability": 75,
    "safety": 100
  },
  "strengths": ["Clear output request"],
  "weaknesses": ["Missing context"],
  "suggestions": ["Add audience details"],
  "improvedPrompt": "Write a concise launch plan for the stated audience."
}
\`\`\``);

    expect(result.dimensions.safety).toBe(100);
    expect(result.improvedPrompt).toContain('launch plan');
  });

  it('rejects an invalid structured response', () => {
    expect(() => parseNvidiaAnalysis('{"dimensions":{}}')).toThrow();
  });
});
