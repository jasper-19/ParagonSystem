export interface AuthStaffProfile {
  id: string;
  applicationId?: string;
  fullName: string;
  email: string;
  studentId?: string;
  yearLevel?: string;
  collegeId?: string;
  programId?: string;
  positionId?: string;
  subRole?: string;
  assignedSection?: string;
  assignedRole?: string;
  createdAt?: Date;
}

export type UserRole = "admin" | "staff";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  staffId?: string;
  twoFaEnabled?: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PublicUser = Omit<User, "passwordHash">;

export interface ManagedUser extends PublicUser {
  staff: AuthStaffProfile | null;
}

export interface EligibleAdminStaff extends AuthStaffProfile {
  boardSection: string;
  boardRole: string;
}

export interface UserWithStaff {
  user: User;
  staff: AuthStaffProfile | null;
}
