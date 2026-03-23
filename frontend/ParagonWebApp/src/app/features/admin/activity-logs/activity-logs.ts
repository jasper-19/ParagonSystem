import { Component, OnInit } from "@angular/core";
import { ActivityLogsService } from "../../../core/services/activity-logs.service";
import { ActivityLog } from "../../../models/activity-log.model";
import { RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { ActivityLogTableComponent } from "./components/activity-log-table";
import { ActivityLogFiltersComponent } from "./components/activity-log-filters";
import { ActivityLogDetailsModalComponent } from "../../../shared/components/activity-log-details-modal/activity-log-details-modal";

@Component({
  selector: 'app-activity-logs',
  standalone: true,
  imports: [CommonModule, RouterModule,
    ActivityLogTableComponent,
    ActivityLogFiltersComponent,
    ActivityLogDetailsModalComponent,
  ],
  templateUrl: './activity-logs.html',
})
export class ActivityLogsComponent implements OnInit {
  logs: ActivityLog[] = [];
  selectedLog: ActivityLog | null = null;

  // Pagination state
  pageSizeOptions: number[] = [10, 25, 50];
  pageSize = 10;
  currentPage = 1;

  constructor(private activityLogsService: ActivityLogsService) { }

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.activityLogsService.getLogs().subscribe(data => {
      this.logs = data;
      this.currentPage = 1;
    });
  }

  // Derived values / helpers
  get totalResults(): number {
    return this.logs.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalResults / this.pageSize));
  }

  rangeStart(): number {
    return this.totalResults === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  rangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalResults);
  }

  pageNumbers(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) pages.push(i);
    return pages;
  }

  get paginatedLogs(): ActivityLog[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.logs.slice(start, start + this.pageSize);
  }

  onPageSizeChange(value: string | number) {
    this.pageSize = Number(value) || this.pageSize;
    this.currentPage = 1;
  }

  viewDetails(log: ActivityLog): void {
    this.selectedLog = log;
  }

  closeModal(): void {
    this.selectedLog = null;
  }
}
