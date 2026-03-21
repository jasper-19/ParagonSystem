import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { DashboardCard } from "../dashboard-card/dashboard-card";

@Component ({
  selector: 'app-special-issues-summary',
  standalone: true,
  imports: [CommonModule, DashboardCard],
  templateUrl: './special-issues-summary.html',
})
export class SpecialIssuesSummary {

  @Input() totalIssues!: number;
  @Input() publishedIssues!: number;
  @Input() draftIssues!: number;
  @Input() archivedIssues!: number;
}
