import { z } from 'zod';

export const membershipRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
export const addMemberSchema = z.object({
  email: z.email().max(320),
  role: membershipRoleSchema.exclude(['OWNER']).default('MEMBER'),
});
export const updateMemberSchema = z.object({ role: membershipRoleSchema });
export const switchTenantSchema = z.object({ tenantId: z.uuid() });
export const tenantSettingsSchema = z.object({
  retentionDays: z.number().int().min(1).max(3650),
  aiProvider: z.enum(['fake', 'openai', 'anthropic', 'nvidia']),
  aiModel: z.string().trim().min(1).max(160),
  aiMonthlyTokenBudget: z.number().int().min(1_000).max(2_000_000_000),
});
export const scheduleTenantDeletionSchema = z.object({
  confirmation: z.string().min(1).max(200),
});
export const requestSupportGrantSchema = z.object({
  tenantId: z.uuid(),
  reason: z.string().trim().min(10).max(500),
});

export type AddMemberRequest = z.infer<typeof addMemberSchema>;
export type UpdateMemberRequest = z.infer<typeof updateMemberSchema>;
export type TenantSettingsRequest = z.infer<typeof tenantSettingsSchema>;
export type ScheduleTenantDeletionRequest = z.infer<typeof scheduleTenantDeletionSchema>;
export type RequestSupportGrantRequest = z.infer<typeof requestSupportGrantSchema>;
export type SwitchTenantRequest = z.infer<typeof switchTenantSchema>;
