import { z } from 'zod';

export const registerRequestSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(1).max(120),
  tenantName: z.string().trim().min(1).max(120),
});

export const loginRequestSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(128),
});

export const requestPasswordResetSchema = z.object({ email: z.email().max(320) });
export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(200),
  password: z.string().min(12).max(128),
});
export const verifyEmailSchema = z.object({ token: z.string().min(32).max(200) });
export const resendVerificationSchema = z.object({ email: z.email().max(320) });

export const sessionResponseSchema = z.object({
  user: z.object({ id: z.uuid(), email: z.email(), displayName: z.string() }),
  tenant: z.object({ id: z.uuid(), name: z.string(), role: z.string() }),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RequestPasswordReset = z.infer<typeof requestPasswordResetSchema>;
export type ResetPassword = z.infer<typeof resetPasswordSchema>;
export type VerifyEmail = z.infer<typeof verifyEmailSchema>;
export type ResendVerification = z.infer<typeof resendVerificationSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
