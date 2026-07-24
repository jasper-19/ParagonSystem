import * as repository from "./application.repository";

export type GetApplicationsQuery = repository.ApplicationListQuery;

const ALLOWED_STATUSES = [
  "pending",
  "interview_scheduled",
  "interview_completed",
  "accepted",
  "rejected",
] as const;

type ApplicationStatus = (typeof ALLOWED_STATUSES)[number];

/** Retrieve all applications, optionally filtered by status. */
export async function getApplications(query: repository.ApplicationListQuery) {
  return repository.findAll(query);
}

/** Retrieve a single application by ID. */
export async function getApplicationById(id: string) {
  return repository.findById(id);
}

/** Submit a new application. */
export async function createApplication(data: unknown) {
  const settings = await repository.findApplicationSettings();

  if (!settings.isOpen) {
    throw Object.assign(
      new Error(
        settings.announcement ||
          "Applications are currently closed."
      ),
      { statusCode: 403 }
    );
  }

  return repository.create(data);
}

/**
 * Update an application's status.
 * The Zod schema already validates the enum value; this provides
 * a defence-in-depth check at the service layer.
 */
export async function updateApplicationStatus(id: string, status: string) {
  if (!ALLOWED_STATUSES.includes(status as ApplicationStatus)) {
    const err = Object.assign(new Error("Invalid status value"), { statusCode: 400 });
    throw err;
  }
  return repository.updateStatus(id, status);
}

/** Schedule an interview for an applicant. */
export async function scheduleInterview(id: string, interviewDate: string) {
  return repository.scheduleInterview(id, interviewDate);
}

/** Mark an application's interview as completed. */
export async function markInterviewed(id: string) {
  return repository.markInterviewed(id);
}

/** Add or update interviewer notes on an application. */
export async function addInterviewNotes(id: string, notes: string) {
  return repository.addInterviewNotes(id, notes);
}

/**
 * Accept an application.
 * Marks the applicant as interviewed and optionally saves final interview notes.
 */
export async function acceptApplication(id: string, interviewNotes?: string) {
  return repository.acceptApplication(id, interviewNotes);
}

/** Reject an application. */
export async function rejectApplication(id: string) {
  return repository.rejectApplication(id);
}

/** Assign an accepted applicant to a publication section and role. */
export async function assignApplication(id: string, section: string, role: string) {
  return repository.assignApplication(id, section, role);
}

/** Permanently delete an application by ID. */
export async function deleteApplication(id: string) {
  return repository.remove(id);
}

/** Retrieve the current application settings. */
export async function getApplicationSettings() {
  return repository.findApplicationSettings();
}

/** Update the application settings. */
export async function updateApplicationSettings(
  input: repository.UpdateApplicationSettingsInput
) {
  const patch: repository.UpdateApplicationSettingsInput = {};

  if (typeof input.isOpen === "boolean") {
    patch.isOpen = input.isOpen;
  }

  if (typeof input.announcement === "string") {
    const announcement = input.announcement.trim();

    if (announcement.length < 10) {
      throw Object.assign(
        new Error("Announcement must be at least 10 characters long"),
        { statusCode: 400 }
      );
    }

    if (announcement.length > 500) {
      throw Object.assign(
        new Error("Announcement must not exceed 500 characters"),
        { statusCode: 400 }
      );
    }

    patch.announcement = announcement;
  }

  return repository.updateApplicationSettings(patch);
}