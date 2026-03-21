import { Component, OnInit } from '@angular/core';
import { NotificationSettingsService } from '../../../../../core/services/notification-settings.service';
import { NotificationSettings } from '../../../../../models/notification-settings.model';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-notification-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './notification-settings.html',
})

export class NotificationSettingsComponent implements OnInit {

  settings!: NotificationSettings;

  constructor(private settingsService: NotificationSettingsService) {}

  readonly digestOptions: { value: 'realtime'|'hourly'|'daily'|'weekly'; label: string }[] = [
  { value: 'realtime', label: 'Realtime' },
  { value: 'hourly',   label: 'Hourly' },
  { value: 'daily',    label: 'Daily' },
  { value: 'weekly',   label: 'Weekly' }
];

  ngOnInit() {
    this.settings = this.settingsService.getSettings();
  }

  updateSettings() {
    this.settingsService.updateSettings(this.settings);
  }

}
