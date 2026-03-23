import { Injectable } from '@angular/core';
import { MaintenanceSettings } from '../../models/maintenance-settings.model';

// =====================================================
// Maintenance Settings Service
// - Holds runtime maintenance configuration in-memory
// - Persists settings to localStorage
// - Provides utilities for backup, log and cache operations
// NOTE: This file intentionally preserves existing keys and behavior
// (including storage key names) to avoid changing runtime semantics.
// =====================================================

@Injectable({
  providedIn: 'root'
})
export class MiaintenanceSettingsService {

  // ----- Default in-memory settings -----
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

  // ----- Lifecycle -----
  constructor() {
    // Load persisted settings (if present) on service construction
    this.loadSettings();
  }

  // =====================================================
  // Public API - Accessors
  // =====================================================
  getSettings(): MaintenanceSettings {
    return this.settings;
  }

  // Update subset of settings and persist immediately
  updateSettings(data: Partial<MaintenanceSettings>) {
    this.settings = { ...this.settings, ...data };
    this.saveSettings();
  }

  // =====================================================
  // Public API - Operations (no-op placeholders with console logs)
  // These functions encapsulate maintenance actions and update
  // in-memory state where applicable, then persist.
  // =====================================================
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

  // =====================================================
  // Persistence helpers
  // - `saveSettings` writes the current settings to localStorage
  // - `loadSettings` attempts to merge persisted settings
  // =====================================================
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
