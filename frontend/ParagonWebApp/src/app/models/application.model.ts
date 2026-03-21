export type ApplicationStatus =
  | 'pending'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'accepted'
  | 'rejected';

export type YearLevel =
  | '1st_year'
  | '2nd_year'
  | '3rd_year'
  | '4th_year'
  | 'unspecified';

export interface Application {
  id?: string;

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
  resumeFileUrl?: string;
  additionalNotes?: string;

  status?: ApplicationStatus;
  createdAt?: Date;

  interviewDate?: Date | null;
  interviewNotes?: string | null;
  interviewed?: boolean;

  assigned?: boolean;
  assignedRole?: string | null;
  assignedSection?: string | null;
}
