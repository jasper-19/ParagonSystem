import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { map, Observable } from "rxjs";
import { ActivityLog, ActivityLogFilters } from "../../models/activity-log.model";

import { API_ENDPOINTS } from "../config/api.config";

export interface PaginatedActivityLogs {
  items: ActivityLog[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

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

export type ActivityLogFilterOptions = {
  modules: string[];
  actions: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ActivityLogsService {
  private readonly apiUrl = API_ENDPOINTS.activityLogs;

  constructor(private http: HttpClient) { }

  private normalizeLog(
    log: ApiActivityLog
  ): ActivityLog {
    const metadata =
      (
        typeof log.metadata ===
          'object' &&
        log.metadata !== null
          ? log.metadata
          : typeof log.details ===
                'object' &&
              log.details !== null
            ? log.details
            : undefined
      ) as ActivityLog['metadata'];

    const moduleValue =
      log.module ??
      log.resourceType ??
      log.resource_type ??
      'SYSTEM';

    const entityTypeValue =
      log.entityType ??
      log.entity_type ??
      log.resourceType ??
      log.resource_type ??
      'SYSTEM';

    const userName =
      this.normalizeString(
        log.userName ??
        log.user_name ??
        log.username
      );

    return {
      id:
        this.normalizeString(
          log.id
        ),

      userId:
        this.normalizeString(
          log.userId ??
          log.user_id
        ),

      userName:
        userName || undefined,

      action:
        this.normalizeString(
          log.action || 'UNKNOWN'
        ).toUpperCase(),

      module:
        this.normalizeString(
          moduleValue
        ).toUpperCase(),

      description:
        this.normalizeString(
          log.description
        ) ||
        this.buildDescription(log),

      entityId:
        this.normalizeString(
          log.entityId ??
          log.entity_id ??
          log.resourceId ??
          log.resource_id
        ),

      entityType:
        this.normalizeString(
          entityTypeValue
        ).toUpperCase(),

      metadata,

      ipAddress:
        this.normalizeString(
          log.ipAddress ??
          log.ip_address
        ),

      userAgent:
        this.normalizeString(
          log.userAgent ??
          log.user_agent
        ) || undefined,

      createdAt:
        this.toIsoString(
          log.createdAt ??
          log.created_at
        ),
    };
  }

  private buildDescription(log: ApiActivityLog): string {
    if (typeof log.details === 'string' && log.details.trim()) return log.details;
    const action = (log.action ?? 'ACTION').toUpperCase();
    const target = log.resourceType ?? log.resource_type ?? log.module ?? 'RESOURCE';
    return `${action} ${String(target).toUpperCase()}`;
  }

  private normalizeString(
    value: unknown
  ): string {
    return typeof value === 'string'
      ? value.trim()
      : value == null
        ? ''
        : String(value).trim();
  }

  private toIsoString(
    value:
      | string
      | Date
      | undefined
  ): string {
    if (!value) {
      return '';
    }

    const date =
      value instanceof Date
        ? value
        : new Date(value);

    return Number.isNaN(
      date.getTime()
    )
      ? ''
      : date.toISOString();
  }

  private buildParams(
    filters?: ActivityLogFilters
  ): HttpParams {
    let params = new HttpParams();

    if (!filters) {
      return params;
    }

    const module =
      filters.module?.trim();

    const action =
      filters.action?.trim();

    const dateFrom =
      filters.dateFrom?.trim();

    const search =
      filters.search?.trim();

    if (module) {
      params = params.set(
        'module',
        module
      );
    }

    if (action) {
      params = params.set(
        'action',
        action
      );
    }

    if (dateFrom) {
      params = params.set(
        'dateFrom',
        dateFrom
      );
    }

    if (search) {
      params = params.set(
        'search',
        search
      );
    }

    if (
      filters.page !== undefined
    ) {
      params = params.set(
        'page',
        String(filters.page)
      );
    }

    if (
      filters.limit !== undefined
    ) {
      params = params.set(
        'limit',
        String(filters.limit)
      );
    }

    return params;
  }

  getLogs(
    filters?: ActivityLogFilters
  ): Observable<PaginatedActivityLogs> {
    return this.http
      .get<{
        items?: ApiActivityLog[];
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
      }>(
        this.apiUrl,
        {
          params:
            this.buildParams(
              filters
            ),
        }
      )
      .pipe(
        map(response => ({
          items:
            (
              response.items ?? []
            ).map(log =>
              this.normalizeLog(log)
            ),

          page:
            Number(
              response.page ?? 1
            ),

          limit:
            Number(
              response.limit ?? 25
            ),

          total:
            Number(
              response.total ?? 0
            ),

          totalPages:
            Number(
              response.totalPages ??
              1
            ),
        }))
      );
  }

  getFilterOptions():
    Observable<ActivityLogFilterOptions> {
    return this.http
      .get<ActivityLogFilterOptions>(
        `${this.apiUrl}/filter-options`
      )
      .pipe(
        map(options => ({
          modules:
            [
              ...new Set(
                (options.modules ?? [])
                  .map(value =>
                    String(value)
                      .trim()
                      .toUpperCase()
                  )
                  .filter(Boolean)
              ),
            ].sort(),

          actions:
            [
              ...new Set(
                (options.actions ?? [])
                  .map(value =>
                    String(value)
                      .trim()
                      .toUpperCase()
                  )
                  .filter(Boolean)
              ),
            ].sort(),
        }))
      );
  }
}
