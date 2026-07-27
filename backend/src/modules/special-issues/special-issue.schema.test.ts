import assert from "node:assert/strict";
import test from "node:test";
import { specialIssueListQuerySchema } from "./special-issue.schema";

test("Special Issue lists receive bounded deterministic defaults", () => {
  const result = specialIssueListQuerySchema.parse({});

  assert.deepEqual(result, {
    page: 1,
    limit: 50,
    sortBy: "publishedAt",
    sortOrder: "desc",
  });
});

test("Special Issue list queries normalize supported filters", () => {
  const result = specialIssueListQuerySchema.parse({
    page: "3",
    limit: "25",
    search: "  campus paper  ",
    type: "Newsletter",
    status: "draft",
    sortBy: "title",
    sortOrder: "asc",
  });

  assert.equal(result.page, 3);
  assert.equal(result.limit, 25);
  assert.equal(result.search, "campus paper");
  assert.equal(result.type, "Newsletter");
  assert.equal(result.status, "draft");
  assert.equal(result.sortBy, "title");
  assert.equal(result.sortOrder, "asc");
});

test("Special Issue list queries reject unbounded and unsafe input", () => {
  assert.equal(
    specialIssueListQuerySchema.safeParse({ limit: "101" }).success,
    false
  );
  assert.equal(
    specialIssueListQuerySchema.safeParse({ page: "0" }).success,
    false
  );
  assert.equal(
    specialIssueListQuerySchema.safeParse({ sortBy: "random()" }).success,
    false
  );
  assert.equal(
    specialIssueListQuerySchema.safeParse({ limit: ["10", "20"] }).success,
    false
  );
});
