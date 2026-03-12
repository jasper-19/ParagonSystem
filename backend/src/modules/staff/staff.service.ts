import * as repository from "./staff.repository";

export async function getStaffMembers() {
  return repository.findAll();
}

/** Returns only non-4th-year staff members (eligible for board assignment). */
export async function getEligibleStaffMembers() {
  return repository.findEligibleForBoard();
}

export async function getStaffMember(id: string) {

  if (!id) {
    throw new Error("Staff id required");
  }

  return repository.findById(id);
}

export async function createStaffFromApplication(
  applicationId: string,
  section: string,
  role: string
) {
  if (!applicationId || !section || !role) {
    throw new Error("applicationId, section, and role are required");
  }

  return repository.createFromApplication(applicationId, section, role);
}

export async function deleteStaffMember(id: string) {
  if (!id) {
    throw new Error("Staff id required");
  }

  const deleted = await repository.remove(id);
  if (!deleted) {
    const err = Object.assign(new Error("Staff member not found"), { statusCode: 404 });
    throw err;
  }
}