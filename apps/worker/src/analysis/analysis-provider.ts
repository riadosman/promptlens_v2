export interface AnalysisDimensions {
  readonly goalClarity: number;
  readonly context: number;
  readonly constraints: number;
  readonly outputFormat: number;
  readonly verifiability: number;
  readonly safety: number;
}

export interface AnalysisResult {
  readonly dimensions: AnalysisDimensions;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly suggestions: readonly string[];
  readonly improvedPrompt: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface AnalysisProvider {
  readonly name: string;
  readonly model: string;
  analyze(prompt: string): Promise<AnalysisResult>;
}
