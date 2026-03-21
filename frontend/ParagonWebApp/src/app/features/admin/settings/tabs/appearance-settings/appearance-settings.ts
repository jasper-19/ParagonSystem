import { Component, OnInit } from "@angular/core";
import { ReactiveFormsModule, FormBuilder, FormGroup } from "@angular/forms";
import { AppearanceSettingsService } from "../../../../../core/services/appearance-settings.service";
import { AppearanceSettings } from "../../../../../models/appearance-settings.model";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";



@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterModule],
  templateUrl: './appearance-settings.html',
})

export class AppearanceSettingsComponent implements OnInit {
  form!: FormGroup;

  previewTheme: 'light' | 'dark' | 'system' = 'light';

  readonly themeOptions: { value: 'light' | 'dark' | 'system'; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'system',label: 'System',icon: '💻' }
    ];

  constructor(
    private fb: FormBuilder,
    private appearanceSettingsService: AppearanceSettingsService
  ) {}



  ngOnInit(): void {
    const settings = this.appearanceSettingsService.getSettings();

    this.form = this.fb.group({
      theme: [settings.theme],
      primaryColor: [settings.primaryColor],
      accentColor: [settings.accentColor],
      sidebarCollapsed: [settings.sidebarCollapsed],
      fontFamily: [settings.fontFamily],
      fontSize: [settings.fontSize],
      borderRadius: [settings.borderRadius],
      compactMode: [settings.compactMode],
      animationsEnabled: [settings.animationsEnabled],
      dashboardLayout: [settings.dashboardLayout],
    });

    this.previewTheme = settings.theme;
  }

  onThemeChange(value: 'light' | 'dark' | 'system') {
    if (value === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.previewTheme = isDark ? 'dark' : 'light';
    } else {
      this.previewTheme = value;
    }
  }

  save(): void {
    const newSettings: Partial<AppearanceSettings> = this.form.value;
    this.appearanceSettingsService.updateSettings(newSettings);
  }
}
