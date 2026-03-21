export interface MaintenanceSettings {

  // Maintenance mode
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowAdminBypass: boolean;

  // Backup
  autoBackupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  lastBackupDate: string | null;

  // logs
  loggingEnabled: boolean;
  logRetentionDays: number;

  // Cache
  autoClearCache: boolean;
}