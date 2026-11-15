import { activityActorName, activityActorType } from './activity-log-actor';
import { ActivityLog } from './activity-log.model';

describe('Activity log actor attribution', () => {
  const base = { id: 'log', action: 'CREATE', module: 'APPLICATIONS', description: '', createdAt: '' } as ActivityLog;
  it('distinguishes public activity and environment administrators from automated activity', () => {
    const visitor = { ...base, metadata: { actorType: 'anonymous' } };
    expect(activityActorName(visitor)).toBe('Unauthenticated visitor');
    expect(activityActorType(visitor)).toBe('Unauthenticated visitor');
    const admin = { ...base, metadata: { actorType: 'environment_admin' } };
    expect(activityActorName(admin)).toBe('Environment administrator');
    expect(activityActorType(admin)).toBe('Administrator');
    expect(activityActorType(base)).toBe('Automated system');
  });
  it('uses the recorded role and preserves account identity without a username', () => {
    const staff = { ...base, userId: 'user', userName: 'Staff Writer', metadata: { actorType: 'user', actorRole: 'staff' } };
    expect(activityActorName(staff)).toBe('Staff Writer');
    expect(activityActorType(staff)).toBe('Staff');
    expect(activityActorName({ ...base, userId: 'user' })).toBe('User account');
  });
});
