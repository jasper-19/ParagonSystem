export type BoardTransitionCandidate = {
  currentAcademicYear?: string | null;
  targetAcademicYear?: string | null;
  targetTransitionAppliedAt?: unknown;
};

export function academicYearStart(
  academicYear: unknown
): number | null {
  const match = String(academicYear ?? "")
    .trim()
    .match(/^(\d{4})[-\u2013]\d{4}$/);

  return match ? Number(match[1]) : null;
}

/**
 * Year levels advance only when moving to a newer academic-year board.
 * A persisted target marker makes retries and later reactivation idempotent.
 */
export function shouldApplyStaffTransition(
  candidate: BoardTransitionCandidate
): boolean {
  const currentStart =
    academicYearStart(candidate.currentAcademicYear);
  const targetStart =
    academicYearStart(candidate.targetAcademicYear);

  return (
    currentStart !== null &&
    targetStart !== null &&
    targetStart > currentStart &&
    !candidate.targetTransitionAppliedAt
  );
}

export function deriveNextBoardStaffLifecycle(
  sourceYearLevel: string | null
): {
  yearLevel: string | null;
  isBoardEligible: boolean;
} {
  switch (sourceYearLevel) {
    case "1st_year":
      return {
        yearLevel: "2nd_year",
        isBoardEligible: true,
      };
    case "2nd_year":
      return {
        yearLevel: "3rd_year",
        isBoardEligible: true,
      };
    case "3rd_year":
      return {
        yearLevel: "4th_year",
        isBoardEligible: true,
      };
    case "4th_year":
      return {
        yearLevel: "4th_year",
        isBoardEligible: false,
      };
    default:
      return {
        yearLevel: sourceYearLevel,
        isBoardEligible: true,
      };
  }
}
