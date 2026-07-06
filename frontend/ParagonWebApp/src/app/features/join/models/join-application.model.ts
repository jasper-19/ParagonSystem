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

  selectedPositions: {
    positionId: string;
    categories: string[];
  }[];

  motivation: string;

  additionalNotes?: string;
}
