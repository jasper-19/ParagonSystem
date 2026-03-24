export interface ActivityLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  module: string;
  description: string;
  entityId?: string;
  entityType: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ActivityLogFilters {
  module?: string;
  action?: string;
  dateFrom?: string;
  search?: string;
  limit?: number;
}

export interface CreateActivityLogInput {
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
