import { z } from 'zod';

export const createDeviceAuthorizationRequestSchema = z
  .object({
    platform: z.string().trim().min(1).max(80),
    displayName: z.string().trim().min(1).max(120),
    protocolVersion: z.literal('1.0'),
    codeChallenge: z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .optional(),
    codeChallengeMethod: z.literal('S256').optional(),
  })
  .refine((input) => Boolean(input.codeChallenge) === Boolean(input.codeChallengeMethod), {
    message: 'PKCE challenge and method must be supplied together.',
  });

export const deviceAuthorizationResponseSchema = z.object({
  deviceCode: z.string().min(32),
  userCode: z.string().min(8).max(12),
  verificationUri: z.url(),
  expiresIn: z.number().int().positive(),
  interval: z.number().int().positive(),
});

export const approveDeviceRequestSchema = z.object({
  userCode: z.string().trim().min(8).max(12),
  projectId: z.uuid(),
});

export const pollDeviceTokenRequestSchema = z.object({
  deviceCode: z.string().min(32),
  codeVerifier: z.string().min(43).max(128).optional(),
});

export const refreshConnectorTokenRequestSchema = z.object({
  refreshToken: z.string().min(32),
});

export const connectorTokenResponseSchema = z.object({
  accessToken: z.string().min(32),
  refreshToken: z.string().min(32),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
  installationId: z.uuid(),
  projectId: z.uuid(),
});

export type CreateDeviceAuthorizationRequest = z.infer<
  typeof createDeviceAuthorizationRequestSchema
>;
export type DeviceAuthorizationResponse = z.infer<typeof deviceAuthorizationResponseSchema>;
export type ApproveDeviceRequest = z.infer<typeof approveDeviceRequestSchema>;
export type PollDeviceTokenRequest = z.infer<typeof pollDeviceTokenRequestSchema>;
export type RefreshConnectorTokenRequest = z.infer<typeof refreshConnectorTokenRequestSchema>;
export type ConnectorTokenResponse = z.infer<typeof connectorTokenResponseSchema>;
