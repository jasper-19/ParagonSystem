import * as repository from "./special-issue.repository";
import { ISSUE_STATUS_VALUES, type IssueStatus } from "./special-issue.schema";

export async function getIssues(status?: string) {
  if (status && !ISSUE_STATUS_VALUES.includes(status as IssueStatus)) {
    throw Object.assign(new Error(`Invalid status: ${status}`), { statusCode: 400 });
  }
  return repository.findAll(status);
}

export async function getIssueBySlug(slug: string) {
  return repository.findBySlug(slug);
}

export async function getIssuesByType(type: string) {
  return repository.findByType(type);
}

export async function createIssue(data: unknown) {
  return repository.create(data);
}

export async function updateIssue(id: string, data: unknown) {
  return repository.update(id, data);
}

export async function deleteIssue(id: string) {
  return repository.remove(id);
}

export async function updateIssueStatus(id: string, status: string) {
  if (!ISSUE_STATUS_VALUES.includes(status as IssueStatus)) {
    throw Object.assign(new Error(`Invalid status: ${status}`), { statusCode: 400 });
  }

  return repository.update(id, { status });
}
