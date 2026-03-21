export type YearLevel =
  | '1st_year'
  | '2nd_year'
  | '3rd_year'
  | '4th_year';

export interface JoinApplication {
  fullName: string;
  email: string;
  studentId: string;
  yearLevel: YearLevel;

  collegeId: string;
  programId: string;

  positionId: string;
  subRole?: string;

  motivation: string;

  portfolioUrl?: string;

  resumeFile?: File; // only for upload stage
  additionalNotes?: string;
}
