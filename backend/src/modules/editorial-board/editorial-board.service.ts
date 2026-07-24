import * as repository from "./editorial-board.repository";
import { BOARD_SECTION_ROLES, AssignApplicationToBoardInput } from "./editorial-board.schema";

const SINGLE_PERSON_EXEC_ROLES =
  new Set<string>([
    "Senior Editor-In-Chief",
    "Junior Editor-In-Chief",
    "Associate Editor (Print)",
    "Associate Editor (Online)",
    "Associate Editor (Broadcast)",
    "Managing Editor",
  ]);

  
// ── boards ────────────────────────────────────────────────────────────────────

export async function getAllBoards() {
  return repository.findAllBoards();
}

export async function getBoardById(id: string) {
  if (!id) throw new Error("Board id required");
  return repository.findBoardById(id);
}

export async function getActiveBoard() {
  return repository.findActiveBoard();
}

export async function activateBoard(id: string) {
  if (!id) throw new Error("Board id required");
  const board = await repository.findBoardById(id);
  if (!board) {
    throw Object.assign(new Error("Editorial board not found"), { statusCode: 404 });
  }
  return repository.activateBoard(id);
}

export async function isActiveBoard(id: string): Promise<boolean> {
  if (!id) return false;

  const board = await repository.findBoardById(id);

  return board?.isActive === true;
}

export async function createBoard(academicYear: string, adviserName: string) {
  if (!academicYear || !adviserName) {
    throw Object.assign(new Error("academicYear and adviserName are required"), { statusCode: 400 });
  }
  const existing = await repository.findBoardByAcademicYear(academicYear.trim());
  if (existing) {
    throw Object.assign(
      new Error(`A board for academic year "${academicYear.trim()}" already exists`),
      { statusCode: 409 }
    );
  }
  return repository.createBoard(academicYear.trim(), adviserName.trim());
}

export async function deleteBoard(id: string) {
  if (!id) throw new Error("Board id required");
  const board = await repository.findBoardById(id);
  if (!board) {
    throw Object.assign(new Error("Editorial board not found"), { statusCode: 404 });
  }
  if (board.isActive) {
    throw Object.assign(new Error("Cannot delete the active board"), { statusCode: 400 });
  }
  await repository.removeBoard(id);
}

// ── members ───────────────────────────────────────────────────────────────────

export async function getBoardMembers(boardId: string) {
  if (!boardId) throw new Error("Board id required");
  return repository.findMembersByBoard(boardId);
}

export async function addBoardMember(boardId: string, staffId: string, section: string, role: string) {
  if (!boardId || !staffId || !section || !role) {
    throw Object.assign(new Error("boardId, staffId, section, and role are required"), { statusCode: 400 });
  }

  const board = await repository.findBoardById(boardId);
  if (!board) {
    throw Object.assign(new Error("Editorial board not found"), { statusCode: 404 });
  }

  return repository.addMember(boardId, staffId, section, role);
}

export async function removeBoardMember(memberId: string) {
  if (!memberId) throw new Error("Member id required");
  const deleted = await repository.removeMember(memberId);
  if (!deleted) {
    throw Object.assign(new Error("Board member not found"), { statusCode: 404 });
  }
}

export async function updateBoardMember(boardId: string, memberId: string, section: string, role: string) {
  if (!boardId || !memberId || !section || !role) {
    throw Object.assign(new Error("boardId, memberId, section, and role are required"), { statusCode: 400 });
  }

  const board = await repository.findBoardById(boardId);
  if (!board) {
    throw Object.assign(new Error("Editorial board not found"), { statusCode: 404 });
  }

  const updated = await repository.updateMember(boardId, memberId, section.trim(), role.trim());
  if (!updated) {
    throw Object.assign(new Error("Board member not found"), { statusCode: 404 });
  }

  return updated;
}

export async function revokeBoardMember(boardId: string, memberId: string) {
  if (!boardId || !memberId) throw new Error("boardId and memberId are required");
  const success = await repository.revokeMember(boardId, memberId);
  if (!success) {
    throw Object.assign(new Error("Board member not found"), { statusCode: 404 });
  }
}

export async function satisfyBoard(id: string, satisfied: boolean) {
  if (!id) throw new Error("Board id required");
  const board = await repository.findBoardById(id);
  if (!board) {
    throw Object.assign(new Error("Editorial board not found"), { statusCode: 404 });
  }
  return repository.satisfyBoard(id, satisfied);
}

export async function assignApplicationToBoard(
  boardId: string,
  input: AssignApplicationToBoardInput
) {
  if (!boardId) {
    throw Object.assign(
      new Error("Board id is required"),
      { statusCode: 400 }
    );
  }

  const section =
    input.section.trim();

  const role =
    input.role.trim();

  const allowedRoles =
    BOARD_SECTION_ROLES[
      section as keyof typeof BOARD_SECTION_ROLES
    ];

  if (!allowedRoles) {
    throw Object.assign(
      new Error(
        `"${section}" is not a valid editorial-board section`
      ),
      { statusCode: 400 }
    );
  }

  const roleIsAllowed =
    (allowedRoles as readonly string[])
      .includes(role);

  if (!roleIsAllowed) {
    throw Object.assign(
      new Error(
        `"${role}" is not valid for ${section}`
      ),
      { statusCode: 400 }
    );
  }

  const singlePersonRole =
    section === "Executive Editors" &&
    SINGLE_PERSON_EXEC_ROLES.has(role);

  return repository
    .assignApplicationToBoard({
      boardId,
      applicationId:
        input.applicationId,
      section,
      role,
      singlePersonRole,
    });
}

//Public Mapper

export function toPublicBoard(board: any) {
  return{
    academicYear: board.academicYear,
    adviserName: board.adviserName,
    members: board.members.map(toPublicBoardMember)
  };
}

export function toPublicBoardMember(member: any) {
  return {
    fullName: member.fullName,
    section: member.section,
    role: member.role,
  };
}

export type ResolvedActiveBoardMember = {
  staffId: string;
  fullName: string;
};

export async function resolveActiveBoardMembers(
  staffIds: string[]
): Promise<ResolvedActiveBoardMember[]> {
  const uniqueIds = [
    ...new Set(
      staffIds
        .map(id => String(id).trim())
        .filter(Boolean)
    ),
  ];

  if (!uniqueIds.length) {
    return [];
  }

  const activeMembers =
    await repository.findActiveBoardMembersByStaffIds(
      uniqueIds
    );

  const activeIds = new Set(
    activeMembers.map(member => member.staffId)
  );

  const invalidIds = uniqueIds.filter(
    id => !activeIds.has(id)
  );

  if (invalidIds.length) {
    throw Object.assign(
      new Error(
        "Only members of the active editorial board can be credited."
      ),
      {
        statusCode: 400,
        invalidStaffIds: invalidIds,
      }
    );
  }

  return activeMembers;
}