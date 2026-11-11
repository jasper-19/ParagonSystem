import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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
  styleUrl: './special-issues.scss',
})
export class SpecialIssues implements OnInit {

  issues: SpecialIssue[] = [];
  filtered: SpecialIssue[] = [];

  years: string[] = [];

  latestIssue?: SpecialIssue;
  loading = true;
  loadError = '';
  readonly failedCovers = new Set<string>();

  /** Active filter */
  activeType: SpecialIssueType | 'all' = 'all';

  /** Tabs for UI (STRICTLY typed) */
  tabs: IssueTab[] = [
    { label: 'All', value: 'all' },
    { label: 'Tabloid', value: 'Tabloid' },
    { label: 'Newsletter', value: 'Newsletter' },
    { label: 'Literary Folio', value: 'Literary Folio' },
  ];

  constructor(
    private issuesService: SpecialIssueService,
    private loader: LoaderService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadIssues();
  }

  loadIssues(): void {
    this.loading = true;
    this.loadError = '';
    this.loader.show();

    this.issuesService.refresh().subscribe({
      next: () => {
        this.applyIssues(this.issuesService.getAll());
        this.loading = false;
        this.loader.hide();
        this.cdr.markForCheck();
      },
      error: () => {
        this.applyIssues([]);
        this.loading = false;
        this.loadError = 'Special issues could not be loaded. Please try again.';
        this.loader.hide();
        this.cdr.markForCheck();
      },
    });
  }

  onCoverError(issue: SpecialIssue): void {
    this.failedCovers.add(issue.id);
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
    this.filterBy(this.activeType);
  }
}
