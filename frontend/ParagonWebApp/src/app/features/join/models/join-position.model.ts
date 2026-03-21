export type JoinDepartment =
  | 'Editorial'
  | 'Creative'
  | 'Documentation'
  | 'Broadcast';

export interface JoinSubRole {
  name: string;
  description: string;
}

export interface JoinPosition {
  id: string;
  title: string;
  department: string;
  description: string;
  requirements?: string[];
  subRoles?: JoinSubRole[];
  slots?: number;
  isOpen: boolean;
}
