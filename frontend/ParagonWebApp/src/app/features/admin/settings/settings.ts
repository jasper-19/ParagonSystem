import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { GeneralSettingsComponent } from "./tabs/general-settings/general-settings";
import { RouterModule } from "@angular/router";
import { UsersSettingsComponent } from "./tabs/users-settings/users-settings";
import { SecuritySettingsComponent } from "./tabs/security-settings/security-settings";

type SettingsTab = 'general' | 'users' | 'security' | 'content' | 'appearance' | 'notifications' | 'maintenance' | 'integrations';
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, GeneralSettingsComponent, RouterModule,
    UsersSettingsComponent,
    SecuritySettingsComponent,
  ],
  templateUrl: './settings.html',
})

export class SettingsComponent {
  tabs: SettingsTab[] = ['general', 'users', 'security', 'content', 'appearance', 'notifications', 'maintenance', 'integrations'];
  activeTab: string = 'general';
  implementTabs: SettingsTab[] = ['general', 'users']; // Only implement these tabs for now
  setTab(tab: SettingsTab) {
    this.activeTab = tab;
  }
}
