import { Injectable } from "@angular/core";
import { NotificationSettings } from "../../models/notification-settings.model";

// =====================================================
// NotificationSettingsService
// - Holds notification preferences in-memory
// - Persists preferences to localStorage under key 'notificationSettings'
// - Provides accessor and update helper for application use
// =====================================================

@Injectable({
  providedIn: 'root'
})
export class NotificationSettingsService {

  // ----- Default notification settings -----
  private settings: NotificationSettings = {
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,

    userRegistrationAlerts: true,
    systemErrorAlerts: true,
    securityAlerts: true,

    adminLoginAlerts: true,
    dataChangeAlerts: false,

    newContentPublished: true,
    contentUpdated: true,

    digestFrequency: 'daily',

    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '06:00'
   };

  // ----- Lifecycle -----
  constructor() {
    // Merge persisted settings (if any) into defaults
    this.loadSettings();
  }

  // =====================================================
  // Public API - Access
  // =====================================================
  getSettings(): NotificationSettings {
    return this.settings;
   }

  // Update provided fields and persist
  updateSettings(data:  Partial<NotificationSettings>) {
    this.settings = {
      ...this.settings,
      ...data
    };

    this.saveSettings();
   }

  // =====================================================
  // Persistence helpers
  // =====================================================
    private saveSettings()
  {
    localStorage.setItem(
      'notificationSettings',
      JSON.stringify(this.settings)
    );
  }

  private loadSettings() {
    const data = localStorage.getItem('notificationSettings');
    if (data) {
      this.settings = {
        ...this.settings,
        ...JSON.parse(data)
      };
    }
  }
}
