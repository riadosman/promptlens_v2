export type AdminSection =
  | 'overview'
  | 'members'
  | 'settings'
  | 'connectors'
  | 'audit'
  | 'support'
  | 'operations'
  | 'instance-users';

export function isAdminSection(value: string): value is AdminSection {
  return (
    value === 'overview' ||
    value === 'members' ||
    value === 'settings' ||
    value === 'connectors' ||
    value === 'audit' ||
    value === 'support' ||
    value === 'operations' ||
    value === 'instance-users'
  );
}
