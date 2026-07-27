import assert from "node:assert/strict";
import test from "node:test";

import {
  academicYearStart,
  deriveNextBoardStaffLifecycle,
  shouldApplyStaffTransition,
} from "./editorial-board-transition";

test("parses only canonical editorial-board academic years", () => {
  assert.equal(academicYearStart("2026-2027"), 2026);
  assert.equal(academicYearStart("2026–2027"), 2026);
  assert.equal(academicYearStart(" 2026–2027 "), 2026);
  assert.equal(academicYearStart("invalid"), null);
  assert.equal(academicYearStart(undefined), null);
});

test("applies staff advancement only on a forward board transition", () => {
  assert.equal(
    shouldApplyStaffTransition({
      currentAcademicYear: "2025-2026",
      targetAcademicYear: "2026-2027",
    }),
    true
  );

  assert.equal(
    shouldApplyStaffTransition({
      currentAcademicYear: "2025–2026",
      targetAcademicYear: "2026-2027",
    }),
    true
  );

  assert.equal(
    shouldApplyStaffTransition({
      currentAcademicYear: "2026-2027",
      targetAcademicYear: "2025-2026",
    }),
    false
  );

  assert.equal(
    shouldApplyStaffTransition({
      currentAcademicYear: "2026-2027",
      targetAcademicYear: "2026-2027",
    }),
    false
  );
});

test("does not reapply an already-recorded board transition", () => {
  assert.equal(
    shouldApplyStaffTransition({
      currentAcademicYear: "2025-2026",
      targetAcademicYear: "2026-2027",
      targetTransitionAppliedAt: new Date(),
    }),
    false
  );
});

test("derives the current lifecycle from a late source-board year edit", () => {
  assert.deepEqual(
    deriveNextBoardStaffLifecycle("1st_year"),
    {
      yearLevel: "2nd_year",
      isBoardEligible: true,
    }
  );
  assert.deepEqual(
    deriveNextBoardStaffLifecycle("3rd_year"),
    {
      yearLevel: "4th_year",
      isBoardEligible: true,
    }
  );
  assert.deepEqual(
    deriveNextBoardStaffLifecycle("4th_year"),
    {
      yearLevel: "4th_year",
      isBoardEligible: false,
    }
  );
});
