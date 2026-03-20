import * as repository from "./editorial-board.repository";

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
