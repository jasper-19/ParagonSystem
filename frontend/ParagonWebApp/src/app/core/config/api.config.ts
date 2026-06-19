import { environment } from '../../../environments/environment';

export const API_ENDPOINTS = {
  base: environment.apiUrl,

  auth: `${environment.apiUrl}/auth`,
  articles: `${environment.apiUrl}/articles`,
  applications: `${environment.apiUrl}/applications`,
  activityLogs: `${environment.apiUrl}/activity-logs`,
  editorialBoard: `${environment.apiUrl}/editorial-board`,
  media: `${environment.apiUrl}/media`,
  notifications: `${environment.apiUrl}/notifications`,
  specialIssues: `${environment.apiUrl}/special-issues`,
  staff: `${environment.apiUrl}/staff`,
  colleges: `${environment.apiUrl}/colleges`,
  users: `${environment.apiUrl}/users`,
};
