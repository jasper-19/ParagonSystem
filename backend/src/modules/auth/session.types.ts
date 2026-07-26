export interface UserSession {
  id: string;
  userId: string;
  userAgent?: string;
  ipAddress?: string;

  browserName?: string;
  browserVersion?: string;

  osName?: string;
  osVersion?: string;

  deviceType?: string;

  createdAt: Date;
  lastActiveAt: Date;
  revokedAt?: Date;
}

export interface CreateUserSessionInput {
  userId: string;
  userAgent?: string;
  ipAddress?: string;

  browserName?: string;
  browserVersion?: string;

  osName?: string;
  osVersion?: string;

  deviceType?: string;
}

export interface SessionMetadataPatch {
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
  deviceType: string;
}