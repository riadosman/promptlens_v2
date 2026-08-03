import type { MembershipRole } from '@promptlens/database';

export interface AuthenticatedActor {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: MembershipRole;
  readonly sessionId: string;
  readonly isInstanceAdmin: boolean;
}
