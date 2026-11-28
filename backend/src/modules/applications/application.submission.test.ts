import assert from "node:assert/strict";
import { mock, test } from "node:test";
import db from "../../config/db";
import { create } from "./application.repository";

test("submission acquires a settings row lock before inserting and rejects a closed window", async () => {
  const statements: string[] = [];
  let released = false;
  const connection = mock.method(db, "connect", async () => ({
    query: async (statement: string) => {
      statements.push(statement);
      return { rows: statement.includes("FOR SHARE") ? [{ is_open: false, announcement: "Recruitment has ended." }] : [] };
    },
    release: () => { released = true; },
  }));
  try {
    await assert.rejects(create({}), { statusCode: 403, message: "Recruitment has ended." });
    assert.deepEqual(statements, [
      "BEGIN",
      "SELECT is_open, announcement FROM application_settings WHERE id = 1 FOR SHARE",
      "ROLLBACK",
    ]);
    assert.equal(released, true);
  } finally {
    connection.mock.restore();
  }
});
