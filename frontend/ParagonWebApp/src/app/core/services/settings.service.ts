import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GeneralSettings } from '../../models/general-settings.model';

// =====================================================
// SettingsService
// - Manages application general settings using Angular Signals
// - Currently uses a mocked settings payload; TODOs mark API integration points
// - Exposes a computed `settings` signal and helpers to read/update values
// =====================================================

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  // private apiUrl = '/api/settings';

  // ----- Reactive state using Angular Signals -----
  private _settings = signal<GeneralSettings | null>(null);

  // Public readonly computed accessor for consumers
  settings = computed(() => this._settings());

  constructor() {}

  // =====================================================
  // Load settings (API or local)
  // - Currently populates with mock settings; replace with API call
  // =====================================================
  loadSettings() {
    // TODO: Replace with actual API call
    const mockSettings: GeneralSettings = {
      logo: null,
      timezone: 'Asia/Manila',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: 'hh:mm A',
      pagination: 10,
      landingPage: 'home',
      breadcrumbs: true,
    };

    this._settings.set(mockSettings);
  }

  // =====================================================
  // Update settings
  // - Replace with API save call when backend is available
  // =====================================================
  updateSettings(updatedSettings: GeneralSettings) {
    // TODO: Replace with actual API call to save settings
    this._settings.set(updatedSettings);
  }

  // =====================================================
  // Utilities
  // - getSetting: Returns a single setting value or null if not set
  // =====================================================
  getSetting<K extends keyof GeneralSettings>(key: K): GeneralSettings[K] | null {
    return this._settings()?.[key] ?? null;
  }
}
