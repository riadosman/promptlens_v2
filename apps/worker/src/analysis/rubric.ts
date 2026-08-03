import type { AnalysisDimensions } from './analysis-provider.js';

const WEIGHTS: Readonly<Record<keyof AnalysisDimensions, number>> = {
  goalClarity: 0.25,
  context: 0.2,
  constraints: 0.15,
  outputFormat: 0.15,
  verifiability: 0.15,
  safety: 0.1,
};

export function calculateScore(dimensions: AnalysisDimensions): number {
  return Math.round(
    Object.entries(WEIGHTS).reduce(
      (total, [dimension, weight]) =>
        total + dimensions[dimension as keyof AnalysisDimensions] * weight,
      0,
    ),
  );
}
