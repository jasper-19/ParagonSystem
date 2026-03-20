export interface UserSession {
  id: string;
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  lastActiveAt: Date;
  revokedAt?: Date;
}

