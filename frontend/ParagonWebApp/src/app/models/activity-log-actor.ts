import { ActivityLog } from './activity-log.model';

export function activityActorName(log: ActivityLog): string {
  if (log.userName?.trim()) return log.userName.trim();
  if (log.metadata?.['actorType'] === 'environment_admin') return 'Environment administrator';
  if (log.metadata?.['actorType'] === 'anonymous') return 'Unauthenticated visitor';
  if (log.userId || log.metadata?.['actorType'] === 'user') return 'User account';
  return 'System activity';
}

export function activityActorType(log: ActivityLog): string {
  if (log.metadata?.['actorType'] === 'environment_admin') return 'Administrator';
  if (log.metadata?.['actorType'] === 'anonymous') return 'Unauthenticated visitor';
  if (log.metadata?.['actorRole'] === 'admin') return 'Administrator';
  if (log.metadata?.['actorRole'] === 'staff') return 'Staff';
  if (log.userId || log.userName || log.metadata?.['actorType'] === 'user') return 'User account';
  return 'Automated system';
}
