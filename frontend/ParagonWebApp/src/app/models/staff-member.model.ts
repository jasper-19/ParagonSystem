export interface StaffMember {
  id: string;
  applicationId?: string;
  fullName: string;
  email: string;
  studentId?: string;
  yearLevel?: string;
  isBoardEligible?: boolean;
  graduatedAt?: Date;
  collegeId?: string;
  programId?: string;
  positionId?: string;
  subRole?: string;
  assignedSection?: string;
  assignedRole?: string;
  createdAt?: Date;
}
