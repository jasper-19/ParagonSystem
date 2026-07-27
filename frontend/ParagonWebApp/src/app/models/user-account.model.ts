export interface AccountStaffProfile {
  id: string;
  fullName: string;
  email: string;
  assignedSection?: string;
  assignedRole?: string;
}

export interface ManagedUserAccount {
  id: string;
  username: string;
  role: 'admin' | 'staff';
  isActive: boolean;
  staffId?: string;
  twoFaEnabled?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
  staff: AccountStaffProfile | null;
}

export interface EligibleAdminStaff extends AccountStaffProfile {
  boardSection: string;
  boardRole: string;
}

export interface CreateAdminAccount {
  staffId: string;
  username: string;
  password: string;
  role: 'admin';
}

