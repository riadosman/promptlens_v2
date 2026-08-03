import { z } from 'zod';

export const ingestPromptRequestSchema = z.object({
  clientEventId: z.uuid(),
  projectId: z.uuid(),
  content: z.string().min(1).max(100_000),
  platform: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(160),
  occurredAt: z.iso.datetime({ offset: true }),
  timezone: z.string().trim().min(1).max(80),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  context: z.record(z.string(), z.unknown()).default({}),
});

export const promptResponseSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  clientEventId: z.uuid().nullable(),
  analysisId: z.uuid(),
  analysisStatus: z.literal('QUEUED'),
  duplicate: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type IngestPromptRequest = z.infer<typeof ingestPromptRequestSchema>;
export type PromptResponse = z.infer<typeof promptResponseSchema>;
