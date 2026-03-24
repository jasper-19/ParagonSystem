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
