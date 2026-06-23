import { CommonModule } from '@angular/common';
import { Component, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ActivityLogFilters {
  module?: string;
  action?: string;
  dateFrom?: string;
  search?: string;
}

@Component({
  selector: 'app-activity-log-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './activity-log-filters.html'
})
export class ActivityLogFiltersComponent {

  @Output() filtersChange = new EventEmitter<ActivityLogFilters>();

  filters: ActivityLogFilters = {
    module: '',
    action: '',
    dateFrom: '',
    search: ''
  };

  modules = [
    'ARTICLES',
    'MEDIA',
    'APPLICATIONS',
    'SPECIAL_ISSUES',
    'EDITORIAL_BOARD',
    'STAFF',
    'AUTH',
    'SETTINGS',
    'USERS',
    'NOTIFICATIONS',
    'SYSTEM',
  ];

  actions = [
    'CREATE',
    'UPDATE',
    'UPDATE_STATUS',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'PUBLISH',
    'ARCHIVE',
    'UPLOAD',
    'ACCEPT',
    'REJECT',
    'ASSIGN',
    'SCHEDULE_INTERVIEW',
    'MARK_INTERVIEWED',
    'ADD_NOTES'
  ];

  constructor() {}

  onFilterChange() {
    this.filtersChange.emit(this.filters);
  }

  clearFilters() {
    this.filters = {
      module: '',
      action: '',
      dateFrom: '',
      search: ''
    };
    this.onFilterChange();
  }
}
