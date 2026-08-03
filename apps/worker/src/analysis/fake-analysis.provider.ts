import type { AnalysisProvider, AnalysisResult } from './analysis-provider.js';

function bounded(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export class FakeAnalysisProvider implements AnalysisProvider {
  readonly name = 'fake';
  readonly model = 'deterministic-v1';

  analyze(prompt: string): Promise<AnalysisResult> {
    const hasFormat = /json|markdown|table|format|liste|tablo/i.test(prompt);
    const hasConstraints = /must|should|limit|without|zorunlu|gerekiyor|kısıt/i.test(prompt);
    const hasContext = prompt.length >= 120;
    const hasVerification = /test|verify|acceptance|doğrula|kabul kriter/i.test(prompt);
    const goalClarity = bounded(45 + Math.min(prompt.length / 8, 45));
    const dimensions = {
      goalClarity,
      context: hasContext ? 80 : 45,
      constraints: hasConstraints ? 82 : 40,
      outputFormat: hasFormat ? 85 : 35,
      verifiability: hasVerification ? 88 : 42,
      safety: 90,
    };
    const weaknesses = [
      ...(hasContext ? [] : ['The prompt needs more project and audience context.']),
      ...(hasConstraints ? [] : ['Constraints and non-goals are not explicit.']),
      ...(hasFormat ? [] : ['The expected output format is not specified.']),
      ...(hasVerification ? [] : ['Success criteria are not measurable.']),
    ];
    return Promise.resolve({
      dimensions,
      strengths: ['The requested action is identifiable.', 'The prompt is concise.'],
      weaknesses,
      suggestions: weaknesses.map((item) => `Address this gap: ${item}`),
      improvedPrompt: `${prompt.trim()}\n\nContext: [Add relevant project and audience context.]\nConstraints: [List hard constraints and non-goals.]\nOutput format: [Define the exact structure.]\nSuccess criteria: [Add verifiable acceptance checks.]`,
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil((prompt.length + 220) / 4),
    });
  }
}
