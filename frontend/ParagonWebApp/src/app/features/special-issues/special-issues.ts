import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { SpecialIssue, SpecialIssueType } from '../../models/special-issue.model';
import { SpecialIssueService } from '../../core/services/special-issue.service';
import { RouterModule } from '@angular/router';
import { LoaderService } from '../../shared/services/loader.service';

interface IssueTab {
  label: string;
  value: SpecialIssueType | 'all';
}

@Component({
  selector: 'app-special-issues',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './special-issues.html',
})
export class SpecialIssues implements OnInit {

  issues: SpecialIssue[] = [];
  filtered: SpecialIssue[] = [];

  years: string[] = [];

  latestIssue?: SpecialIssue;

  /** Active filter */
  activeType: SpecialIssueType | 'all' = 'all';

  /** Tabs for UI (STRICTLY typed) */
  tabs: IssueTab[] = [
    { label: 'All', value: 'all' },
    { label: 'Tabloid', value: 'Tabloid' },
    { label: 'Newsletter', value: 'Newsletter' },
    { label: 'Literary Folio', value: 'Literary Folio' },
  ];

  constructor(private issuesService: SpecialIssueService, private loader: LoaderService) {}

  ngOnInit(): void {
    this.loader.show();

    this.issuesService.refresh().subscribe({
      next: () => {
        this.applyIssues(this.issuesService.getAll());
        this.loader.hide();
      },
      error: () => {
        this.applyIssues([]);
        this.loader.hide();
      },
    });
  }

   filterBy(type: SpecialIssueType | 'all'): void {
    this.activeType = type;

    const base =
      type === 'all'
        ? this.issues
        : this.issues.filter(i => i.type === type);

     this.latestIssue = base.length ? base[0] : undefined;
    this.filtered = base.slice(1);

     this.years = [
      ...new Set(this.filtered.map(i => i.academicYear))
    ].sort ((a, b) => b.localeCompare(a)); // Sort years in descending order
  }

  getIssuesByYear(year: string): SpecialIssue[] {
    return this.filtered.filter(i => i.academicYear === year);
  }

  get totalIssues(): number {
    return this.filtered.length + (this.latestIssue ? 1 : 0);
  }

  private applyIssues(list: SpecialIssue[]): void {
    this.issues = [...list].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    this.latestIssue = this.issues[0];
    this.filtered = this.issues.slice(1);
    this.years = [...new Set(this.issues.map((i) => i.academicYear))].sort((a, b) => b.localeCompare(a));
  }
}
