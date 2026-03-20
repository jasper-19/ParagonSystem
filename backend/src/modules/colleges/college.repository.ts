import db from "../../config/db";

type CollegeRow = {
  college_id: string;
  college_name: string;
  program_id: string | null;
  program_name: string | null;
};

export type CollegeDto = {
  id: string;
  name: string;
  programs: Array<{ id: string; name: string }>;
};

export async function findAll(): Promise<CollegeDto[]> {
  const result = await db.query<CollegeRow>(
    `
    SELECT
      c.id   AS college_id,
      c.name AS college_name,
      p.id   AS program_id,
      p.name AS program_name
    FROM colleges c
    LEFT JOIN programs p
      ON p.college_id = c.id
     AND p.is_active = TRUE
    WHERE c.is_active = TRUE
    ORDER BY c.sort_order ASC, c.name ASC, p.sort_order ASC, p.name ASC
    `
  );

  const byCollege = new Map<string, CollegeDto>();

  for (const row of result.rows) {
    const id = String(row.college_id);
    const existing = byCollege.get(id);
    const college: CollegeDto =
      existing ??
      ({
        id,
        name: row.college_name,
        programs: [],
      } satisfies CollegeDto);

    if (!existing) byCollege.set(id, college);

    if (row.program_id && row.program_name) {
      college.programs.push({ id: String(row.program_id), name: row.program_name });
    }
  }

  return Array.from(byCollege.values());
}

