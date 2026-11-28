import assert from "node:assert/strict";
import { after, test, type TestContext } from "node:test";
import db from "../../config/db";
import { activateBoard } from "./editorial-board.repository";
import { deleteBoard } from "./editorial-board.service";

after(() => db.end());

const boardId = "11111111-1111-4111-8111-111111111111";
const lockBoard = "SELECT is_active FROM editorial_boards WHERE id = $1 FOR UPDATE";
const deleteMembers = "DELETE FROM editorial_board_members WHERE board_id = $1";
const deleteParent = "DELETE FROM editorial_boards WHERE id = $1 RETURNING id";

function mockTransaction(
  t: TestContext,
  active?: boolean,
  deleteError?: Error
) {
  const queries: string[] = [];
  t.mock.method(db, "connect", async () => ({
    query: async (statement: string, args?: string[]) => {
      const sql = statement.replace(/\s+/g, " ").trim();
      queries.push(sql);
      if (sql === lockBoard) {
        assert.deepEqual(args, [boardId]);
        return { rows: active === undefined ? [] : [{ is_active: active }] };
      }
      if (sql === deleteMembers || sql === deleteParent) {
        assert.deepEqual(args, [boardId]);
      }
      if (sql === deleteParent) {
        if (deleteError) throw deleteError;
        return { rows: [{ id: boardId }] };
      }
      return { rows: [] };
    },
    release: () => queries.push("release"),
  }));
  return queries;
}

test("activation and deletion take the same transaction lock before reading the board", async (t) => {
  const queries = mockTransaction(t, false);
  await activateBoard(boardId);
  const [, activationLock, activationRead] = queries.splice(0);
  assert.ok(activationLock && activationRead);
  assert.match(activationLock, /pg_advisory_xact_lock/);
  assert.match(activationRead, /FOR UPDATE$/);

  await deleteBoard(boardId);
  assert.deepEqual(queries, ["BEGIN", activationLock, lockBoard, deleteMembers, deleteParent, "COMMIT", "release"]);
});

test("deletion leaves the roster alone when the locked board is active or missing", async (t) => {
  for (const [active, statusCode] of [[true, 400], [undefined, 404]] as const) {
    const queries = mockTransaction(t, active);
    await assert.rejects(deleteBoard(boardId), { statusCode });
    assert.deepEqual(queries.slice(2), [lockBoard, "ROLLBACK", "release"]);
    t.mock.restoreAll();
  }
});

test("failure deleting the parent rolls back the roster deletion", async (t) => {
  const failure = new Error("board deletion failed");
  const queries = mockTransaction(t, false, failure);
  await assert.rejects(deleteBoard(boardId), failure);
  assert.deepEqual(queries.slice(2), [lockBoard, deleteMembers, deleteParent, "ROLLBACK", "release"]);
});
