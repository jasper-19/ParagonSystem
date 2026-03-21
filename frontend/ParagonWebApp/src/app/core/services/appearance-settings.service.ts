import { Injectable } from "@angular/core";

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';

  primaryColor: string; // Hex color code
  accentColor: string;
  sidebarCollapsed: boolean;
  fontFamily: 'inter' | 'roboto' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  borderRadius: 'none' | 'small' | 'medium' | 'large';
  compactMode: boolean;
  animationsEnabled: boolean;
  dashboardLayout: 'default' | 'modern' | 'compact';
}

@Injectable({
  providedIn: 'root'
})

export class AppearanceSettingsService {
  private settings: AppearanceSettings = {
    theme: 'light',
    primaryColor: '#f4bd00',
    accentColor: '#000035',
    sidebarCollapsed: false,
    fontFamily: 'inter',
    fontSize: 'medium',
    borderRadius: 'medium',
    compactMode: false,
    animationsEnabled: true,
    dashboardLayout: 'default'
  };

  constructor() {
    this.loadSettings();
    this.applyAppearance()
  }

  getSettings(): AppearanceSettings {
    return this.settings;
  }

  updateSettings(newSettings: Partial<AppearanceSettings>) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };

    this.saveSettings();
    this.applyAppearance();
  }

  private applyAppearance() {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', this.settings.primaryColor);
    root.style.setProperty('--accent-color', this.settings.accentColor);

    document.body.classList.toggle(
      'dark',
      this.settings.theme === 'dark'
    );
  }

  private saveSettings() {
    localStorage.setItem('appearanceSettings', JSON.stringify(this.settings));
  }

  private loadSettings() {
    const saved = localStorage.getItem('appearanceSettings');
    if (saved) {
      this.settings = {
      ...this.settings,
      ...JSON.parse(saved)
      }
    };
  }
}
