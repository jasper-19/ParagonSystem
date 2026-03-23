/**
 * AppearanceSettingsService
 * - Purpose: store and apply UI appearance preferences for the application.
 * - Notes: Only formatting and explanatory comments were added. No logic changes.
 */

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
  // Default settings used until user overrides them (or when localStorage is empty)
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
    // Load any persisted user settings, then apply appearance to the document
    this.loadSettings();
    this.applyAppearance();
  }

  // Return the current in-memory settings object
  getSettings(): AppearanceSettings {
    return this.settings;
  }

  // Merge partial updates into current settings, persist, and apply immediately
  updateSettings(newSettings: Partial<AppearanceSettings>) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };

    this.saveSettings();
    this.applyAppearance();
  }

  // Apply visual values (CSS variables, classes) based on current settings
  private applyAppearance() {
    const root = document.documentElement;

    // Update CSS custom properties used throughout the app styles
    root.style.setProperty('--primary-color', this.settings.primaryColor);
    root.style.setProperty('--accent-color', this.settings.accentColor);

    // Toggle dark class on body for theme switching
    document.body.classList.toggle(
      'dark',
      this.settings.theme === 'dark'
    );
  }

  // Persist current settings to localStorage
  private saveSettings() {
    localStorage.setItem('appearanceSettings', JSON.stringify(this.settings));
  }

  // Load persisted settings from localStorage (if present) and merge them in
  private loadSettings() {
    const saved = localStorage.getItem('appearanceSettings');
    if (saved) {
      this.settings = {
        ...this.settings,
        ...JSON.parse(saved)
      };
    }
  }
}
