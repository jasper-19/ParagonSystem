import assert from "node:assert/strict";
import test from "node:test";
import { adminArticlesQuerySchema } from "./article.schema";

test("admin article queries receive safe pagination defaults", () => {
  const result = adminArticlesQuerySchema.parse({});

  assert.deepEqual(result, {
    page: 1,
    limit: 20,
    sort: "latest",
  });
});

test("admin article queries normalize supported filters", () => {
  const result = adminArticlesQuerySchema.parse({
    page: "3",
    limit: "10",
    status: "Published",
    category: "News",
    featured: "false",
    search: "  campus  ",
    sort: "mostViewed",
    tags: "breaking,student-life",
  });

  assert.equal(result.page, 3);
  assert.equal(result.limit, 10);
  assert.equal(result.featured, false);
  assert.equal(result.search, "campus");
  assert.deepEqual(result.tags, ["breaking", "student-life"]);
});

test("admin article queries reject unbounded or unsupported input", () => {
  assert.equal(
    adminArticlesQuerySchema.safeParse({ limit: "100" }).success,
    false
  );
  assert.equal(
    adminArticlesQuerySchema.safeParse({ sort: "random" }).success,
    false
  );
  assert.equal(
    adminArticlesQuerySchema.safeParse({ status: "Deleted" }).success,
    false
  );
});
