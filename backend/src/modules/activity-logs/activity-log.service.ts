import { emitActivityLogsUpdated } from "../../realtime/socket.events";
import * as repository from "./activity-log.repository";
import { ActivityLog, ActivityLogFilters, CreateActivityLogInput, PaginatedActivityLogs } from "./activity-log.types";

export async function listActivityLogs(
  filters: ActivityLogFilters
): Promise<PaginatedActivityLogs> {
  return repository.findAll(
    filters
  );
}

export async function createActivityLog(
  input: CreateActivityLogInput
): Promise<ActivityLog> {
  const created =
    await repository.create(input);

  try {
    emitActivityLogsUpdated({
      activityLogId:
        created.id,

      action:
        created.action,

      module:
        created.module,
    });
  } catch (error) {
    if (
      process.env.NODE_ENV !==
      "test"
    ) {
      console.error(
        "Failed to emit activity-log update:",
        error
      );
    }
  }

  return created;
}

export async function getActivityLogFilterOptions(): Promise<{
  modules: string[];
  actions: string[]; 
}> {
  return repository.getFilterOptions();
}