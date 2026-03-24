import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { map, Observable } from "rxjs";
import { ActivityLog, ActivityLogFilters } from "../../models/activity-log.model";

type ApiActivityLog = {
  id?: string;
  userId?: string;
  user_id?: string;
  userName?: string;
  user_name?: string;
  username?: string;
  action?: string;
  module?: string;
  resourceType?: string;
  resource_type?: string;
  description?: string;
  details?: unknown;
  metadata?: unknown;
  entityId?: string;
  entity_id?: string;
  resourceId?: string;
  resource_id?: string;
  entityType?: string;
  entity_type?: string;
  ipAddress?: string;
  ip_address?: string;
  userAgent?: string;
  user_agent?: string;
  createdAt?: string | Date;
  created_at?: string | Date;
};

@Injectable({
  providedIn: 'root'
})
export class ActivityLogsService {
  private readonly apiUrl = '/api/activity-logs';

  constructor(private http: HttpClient) { }

  private normalizeLog(log: ApiActivityLog): ActivityLog {
    const metadata =
      (typeof log.metadata === 'object' && log.metadata !== null
        ? log.metadata
        : typeof log.details === 'object' && log.details !== null
          ? log.details
          : undefined) as ActivityLog['metadata'];

    const moduleValue = log.module ?? log.resourceType ?? log.resource_type ?? 'SYSTEM';
    const entityTypeValue = log.entityType ?? log.entity_type ?? log.resourceType ?? log.resource_type ?? 'SYSTEM';

    return {
      id: String(log.id ?? ''),
      userId: String(log.userId ?? log.user_id ?? ''),
      userName: log.userName ?? log.user_name ?? log.username ?? 'Unknown user',
      action: (log.action ?? 'UNKNOWN').toUpperCase(),
      module: String(moduleValue).toUpperCase(),
      description: log.description ?? this.buildDescription(log),
      entityId: String(log.entityId ?? log.entity_id ?? log.resourceId ?? log.resource_id ?? ''),
      entityType: String(entityTypeValue).toUpperCase(),
      metadata,
      ipAddress: String(log.ipAddress ?? log.ip_address ?? ''),
      userAgent: log.userAgent ?? log.user_agent ?? undefined,
      createdAt: this.toIsoString(log.createdAt ?? log.created_at),
    };
  }

  private buildDescription(log: ApiActivityLog): string {
    if (typeof log.details === 'string' && log.details.trim()) return log.details;
    const action = (log.action ?? 'ACTION').toUpperCase();
    const target = log.resourceType ?? log.resource_type ?? log.module ?? 'RESOURCE';
    return `${action} ${String(target).toUpperCase()}`;
  }

  private toIsoString(value: string | Date | undefined): string {
    if (!value) return new Date().toISOString();
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  private buildParams(filters?: ActivityLogFilters): HttpParams {
    let params = new HttpParams();
    if (!filters) return params;

    if (filters.module) params = params.set('module', filters.module);
    if (filters.action) params = params.set('action', filters.action);
    if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters.search) params = params.set('search', filters.search);

    return params;
  }

  getLogs(filters?: ActivityLogFilters): Observable<ActivityLog[]> {
    return this.http
      .get<ApiActivityLog[] | { data?: ApiActivityLog[]; items?: ApiActivityLog[] }>(this.apiUrl, {
        params: this.buildParams(filters),
      })
      .pipe(
        map((response) => {
          const list = Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
              ? response.data
              : Array.isArray(response?.items)
                ? response.items
                : [];
          return list.map((log) => this.normalizeLog(log));
        })
      );
  }
}
