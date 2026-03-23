import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { ActivityLog } from "../../models/activity-log.model";

@Injectable({
  providedIn: 'root'
})
export class ActivityLogsService {

  constructor() { }

  getLogs(): Observable<ActivityLog[]> {
    return of([
      {
        id: '1',
        userId: 'u1',
        userName: 'Admin User',
        action: 'CREATE',
        module: 'ARTICLES',
        description: 'Created article: AI in 2026',
        createdAt: new Date().toISOString(),
        ipAddress: '192.168.1.1',
        entityId: 'a1',
        entityType: 'ARTICLE'
      },
      {
        id: '2',
        userId: 'u2',
        userName: 'Editor',
        action: 'UPDATE',
        module: 'SETTINGS',
        description: 'Updated site appearance',
        createdAt: new Date().toISOString(),
        ipAddress: '192.168.1.2',
        entityId: 's1',
        entityType: 'SETTING'
      }
    ]);
  }
}
