import { Injectable } from '@angular/core';
import { MaintenanceSettings } from '../../models/maintenance-settings.model';
@Injectable({
  providedIn: 'root'
})

export class MiaintenanceSettingsService {

  private settings: MaintenanceSettings = {
    maintenanceMode: false,
    maintenanceMessage: 'The site is currently undergoing maintenance. Please check back later.',
    allowAdminBypass: true,

    autoBackupEnabled: false,
    backupFrequency: 'weekly',
    lastBackupDate: null,

    loggingEnabled: true,
    logRetentionDays: 30,

    autoClearCache: false,
  };

  constructor() { 
    this.loadSettings();
  }

  getSettings(): MaintenanceSettings {
    return this.settings;
  }

  updateSettings(data: Partial<MaintenanceSettings>) {
    this.settings = { ...this.settings, ...data };
    this.saveSettings();
  }

  triggerBackup() {
    console.log('Backup triggered...');
    this.settings.lastBackupDate = new Date().toISOString();
    this.saveSettings();
  }

  clearCache() {
    console.log('Cache cleared');
  }

  clearLogs() {
    console.log('Logs cleared');
  }

  private saveSettings() {
    localStorage.setItem('maintenanceSettings', JSON.stringify(this.settings));
  }

  private loadSettings() {
    const data = localStorage.getItem('maintenance-settings');
    if (data) {
      this.settings = {
        ...this.settings,
        ...JSON.parse(data)
      };
    }
  }
}