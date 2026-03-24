import * as repository from "./activity-log.repository";
import { ActivityLog, ActivityLogFilters, CreateActivityLogInput } from "./activity-log.types";

export async function listActivityLogs(filters: ActivityLogFilters): Promise<ActivityLog[]> {
  return repository.findAll(filters);
}

export async function createActivityLog(input: CreateActivityLogInput): Promise<ActivityLog> {
  return repository.create(input);
}
