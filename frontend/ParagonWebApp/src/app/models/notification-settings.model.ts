 export interface NotificationSettings {

  //Globaltoggles
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;

  // Event-based notifications
  userRegistrationAlerts: boolean;
  systemErrorAlerts: boolean;
  securityAlerts: boolean;

  // Admin activity logs
  adminLoginAlerts: boolean;
  dataChangeAlerts: boolean;

  // Content-related notifications
  newContentPublished: boolean;
  contentUpdated: boolean;

  // Frequency Settings
  digestFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string; // e.g. "22:00"
  quietHoursEnd: string; // e.g. "06:00"
 }
