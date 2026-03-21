import { Component, OnInit } from '@angular/core';
import { MiaintenanceSettingsService } from '../../../../../core/services/maintenance-settings.service';
import { MaintenanceSettings } from '../../../../../models/maintenance-settings.model';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component ({
  selector: 'app-maintenance-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './maintenance-settings.html',
})

export class MaintenanceSettingsComponent implements OnInit {

  settings!: MaintenanceSettings;

  readonly backupOptions: { value: 'daily' | 'weekly' | 'monthly'; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  constructor(private maintenanceService: MiaintenanceSettingsService) {}

  ngOnInit() {
    this.settings = this.maintenanceService.getSettings();
  }

  updateSettings() {
    this.maintenanceService.updateSettings(this.settings);
  }

  triggerBackup() {
    this.maintenanceService.triggerBackup();
    this.settings = this.maintenanceService.getSettings(); // Refresh settings to get updated backup date
  }

  clearCache() {
    this.maintenanceService.clearCache();
  }

  clearLogs() {
    this.maintenanceService.clearLogs();
  }
}