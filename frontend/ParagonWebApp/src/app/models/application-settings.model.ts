export interface ApplicationSettings {
  isOpen: boolean;
  announcement: string;
  updatedAt: string;
}

export type UpdateApplicationSettings = Partial<Pick<ApplicationSettings, 'isOpen' | 'announcement'>>;
