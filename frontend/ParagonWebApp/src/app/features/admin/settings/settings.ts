import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { GeneralSettingsComponent } from "./tabs/general-settings/general-settings";
import { RouterModule } from "@angular/router";
import { UsersSettingsComponent } from "./tabs/users-settings/users-settings";
import { SiteSecuritySettingsComponent } from "./tabs/security-settings/site-security-settings";
import { ContentSettingsComponent } from "./tabs/content-settings/content-settings";
import { AppearanceSettingsComponent } from "./tabs/appearance-settings/appearance-settings";
import { NotificationSettingsComponent } from "./tabs/notification-settings/notification-settings";
import { MaintenanceSettingsComponent } from "./tabs/maintenance-settings/maintenance-settings";


type SettingsTab = 'general' | 'users' | 'security' | 'content' | 'appearance' | 'notifications' | 'maintenance';
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, GeneralSettingsComponent, RouterModule,
    UsersSettingsComponent,
    SiteSecuritySettingsComponent,
    ContentSettingsComponent,
    AppearanceSettingsComponent,
    NotificationSettingsComponent,
    MaintenanceSettingsComponent,
  ],
  templateUrl: './settings.html',
})

export class SettingsComponent {
  tabs: SettingsTab[] = ['general', 'users', 'security', 'content', 'appearance', 'notifications', 'maintenance'];
  activeTab: string = 'general';
  implementTabs: SettingsTab[] = ['general', 'users', 'appearance', 'security', 'content']; // Only implement these tabs for now
  setTab(tab: SettingsTab) {
    this.activeTab = tab;
  }
}
