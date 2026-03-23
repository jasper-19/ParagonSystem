export interface ActivityLog {
  id: string;
  userId: string;
  userName?: string;

  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'PUBLISH';

  module:
    | 'ARTICLES'
    | 'USERS'
    | 'SETTINGS'
    | 'APPLICATIONS'
    | 'NOTIFICATIONS'
    | 'SPECIAL_ISSUES';


  description: string;

  entityId: string;
  entityType: string;

  metadata?: {
    before?: any;
    after?: any;
  };

  ipAddress: string;
  userAgent?:  string;

  createdAt: string;
}
