export type UserRole = "admin" | "staff";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  staffId?: string;
  twoFaEnabled?: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PublicUser = Omit<User, "passwordHash">;
