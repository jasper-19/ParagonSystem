import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { SpecialIssue, SpecialIssueType } from '../../models/special-issue.model';
import { SpecialIssueService } from '../../core/services/special-issue.service';
import { RouterModule } from '@angular/router';
import { LoaderService } from '../../shared/services/loader.service';
import { SocketService } from '../../core/services/socket.service';
import { EMPTY, Subject, catchError, switchMap, takeUntil, tap } from 'rxjs';

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
export class SpecialIssues implements OnInit, OnDestroy {
  private readonly reloads = new Subject<void>();
  private readonly destroyed = new Subject<void>();
  private stopUpdates?: () => void;
  private stopConnect?: () => void;
  private loaderVisible = false;

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
    private socket: SocketService,
  ) {}

  ngOnInit(): void {
    this.reloads.pipe(
      switchMap(() => this.issuesService.refresh().pipe(
        tap(() => {
          this.applyIssues(this.issuesService.getAll());
          this.loadError = '';
          this.finishLoading();
        }),
        catchError(() => {
          this.loadError = 'Special issues could not be loaded. Please try again.';
          this.finishLoading();
          return EMPTY;
        }),
      )),
      takeUntil(this.destroyed),
    ).subscribe();
    this.stopUpdates = this.socket.onSpecialIssuesUpdated(() => this.reloads.next());
    this.stopConnect = this.socket.on<void>('connect', () => this.reloads.next());
    this.loadIssues();
  }

  loadIssues(): void {
    this.loading = true;
    this.loadError = '';
    this.loader.show();
    this.loaderVisible = true;
    this.reloads.next();
  }

  private finishLoading(): void {
    this.loading = false;
    this.hideLoader();
    this.cdr.markForCheck();
  }

  private hideLoader(): void {
    if (this.loaderVisible) this.loader.hide();
    this.loaderVisible = false;
  }

  ngOnDestroy(): void {
    this.stopUpdates?.();
    this.stopConnect?.();
    this.destroyed.next();
    this.destroyed.complete();
    this.reloads.complete();
    this.hideLoader();
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
