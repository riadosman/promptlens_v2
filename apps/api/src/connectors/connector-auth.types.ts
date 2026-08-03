export interface AuthenticatedConnector {
  readonly installationId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly defaultProjectId: string;
  readonly platform: string;
}
