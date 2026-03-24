export type ActivityAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PUBLISH'
  | string;

export type ActivityModule =
  | 'ARTICLES'
  | 'USERS'
  | 'SETTINGS'
  | 'APPLICATIONS'
  | 'NOTIFICATIONS'
  | 'SPECIAL_ISSUES'
  | string;

export interface ActivityLog {
  id: string;
  userId: string;
  userName?: string;
  action: ActivityAction;
  module: ActivityModule;
  description: string;
  entityId: string;
  entityType: string;
  metadata?: {
    before?: unknown;
    after?: unknown;
    [key: string]: unknown;
  };
  ipAddress: string;
  userAgent?: string;
  createdAt: string;
}

export interface ActivityLogFilters {
  module?: string;
  action?: string;
  dateFrom?: string;
  search?: string;
}
