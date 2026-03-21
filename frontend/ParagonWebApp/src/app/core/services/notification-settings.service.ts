import { Injectable } from "@angular/core";
import { NotificationSettings } from "../../models/notification-settings.model";

@Injectable({
  providedIn: 'root'
})

export class NotificationSettingsService {

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

   constructor() {
    this.loadSettings();
   }

   getSettings(): NotificationSettings {
    return this.settings;
   }

   updateSettings(data:  Partial<NotificationSettings>) {
    this.settings = {
      ...this.settings,
      ...data
    };

    this.saveSettings();
   }

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
