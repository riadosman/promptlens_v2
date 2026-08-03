import { z } from 'zod';

export const promptListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  projectId: z.uuid().optional(),
  platform: z.string().trim().max(80).optional(),
  model: z.string().trim().max(160).optional(),
  tag: z.string().trim().max(60).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const analysisSummarySchema = z.object({
  id: z.uuid(),
  status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']),
  score: z.number().int().nullable(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggestions: z.array(z.string()),
  improvedPrompt: z.string().nullable(),
});

export const promptListItemSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  projectName: z.string(),
  content: z.string(),
  platform: z.string(),
  model: z.string(),
  occurredAt: z.iso.datetime(),
  tags: z.array(z.string()),
  analysis: analysisSummarySchema.nullable(),
});

export const promptListResponseSchema = z.object({
  items: z.array(promptListItemSchema),
  nextCursor: z.uuid().nullable(),
});

export const promptDetailResponseSchema = promptListItemSchema.extend({
  timezone: z.string(),
  createdAt: z.iso.datetime(),
});

export const dashboardStatsSchema = z.object({
  projects: z.number().int().nonnegative(),
  prompts: z.number().int().nonnegative(),
  analysesCompleted: z.number().int().nonnegative(),
  averageScore: z.number().nullable(),
  promptsLast7Days: z.number().int().nonnegative(),
  scoreTrend: z.array(z.object({ date: z.string(), score: z.number() })),
  modelDistribution: z.array(z.object({ name: z.string(), count: z.number().int() })),
  projectDistribution: z.array(z.object({ name: z.string(), count: z.number().int() })),
});

export type PromptListQuery = z.infer<typeof promptListQuerySchema>;
export type PromptListResponse = z.infer<typeof promptListResponseSchema>;
export type PromptDetailResponse = z.infer<typeof promptDetailResponseSchema>;
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
