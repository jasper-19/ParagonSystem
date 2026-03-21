import { ConfirmationService } from '../../../../../shared/components/confirmation-modal/confirmation.service';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { SpecialIssueService } from '../../../../../core/services/special-issue.service';
import { SpecialIssue } from '../../../../../models/special-issue.model';
import { SpecialIssueViewModal } from '../../../../../shared/components/special-issue-view-modal/special-issue-view-modal';

type IssueStatus = 'all' | 'published' | 'draft' | 'archived';
type SortField = 'title' | 'type' | 'academicYear' | 'status' | 'publishedAt';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-all-special-issues',
  standalone: true,
  imports: [CommonModule, RouterModule, SpecialIssueViewModal],
  templateUrl: './all-special-issues.html'
})
export class AllSpecialIssuesComponent {

  private issueService = inject(SpecialIssueService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private confirm = inject(ConfirmationService);

  readonly currentPage = signal(1);
  readonly pageSize = signal(5);

  readonly searchQuery = signal('');

  readonly statuses: IssueStatus[] = [
    'all',
    'published',
    'draft',
    'archived'
  ];

  // ---- Status Filter ----
  readonly statusFilter = signal<IssueStatus>('all');

  //---- Sort Filter ----
  readonly sortField = signal<SortField>('publishedAt');
  readonly sortDirection = signal<SortDirection>('desc');

  //---- Page Size Options ----
  readonly pageSizeOptions = [5, 10, 20, 50];

  readonly selectedIssue = signal<SpecialIssue | null>(null);

  private issuesStream = toSignal(this.issueService.issues$, { initialValue: [] });

  constructor() {
    this.issueService.refresh().subscribe({ error: () => {} });

    // Sync query param → signal
    effect(() => {
      const status = this.route.snapshot.queryParamMap.get('status') as IssueStatus | null;
      if (status && ['published', 'draft', 'archived'].includes(status)) {
        this.statusFilter.set(status);
      } else {
        this.statusFilter.set('all');
      }
    });

    // Reset page when filter/search/sort changes
    effect(() => {
      this.statusFilter();
      this.searchQuery();
      this.sortField();
      this.sortDirection();
      this.currentPage.set(1);
    });

    // Reset page when page size changes
    effect(() => {
      this.pageSize();
      this.currentPage.set(1);
    });
  }

  // ---- Computed ----
  readonly filteredIssues = computed(() => {
    const status = this.statusFilter();
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.issuesStream();

    return list.filter(issue => {
      const matchesStatus =
        status === 'all' || issue.status === status;

      const matchesSearch =
        query === '' ||
        issue.title.toLowerCase().includes(query) ||
        issue.type.toLowerCase().includes(query) ||
        issue.academicYear.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  });

  readonly sortedIssues = computed(() => {
    const list = [...this.filteredIssues()];
    const field = this.sortField();
    const direction = this.sortDirection();

    return list.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (field) {
        case 'title':
          valueA = a.title.toLowerCase();
          valueB = b.title.toLowerCase();
          break;

        case 'type':
          valueA = a.type.toLowerCase();
          valueB = b.type.toLowerCase();
          break;

        case 'academicYear':
          valueA = a.academicYear;
          valueB = b.academicYear;
          break;

        case 'status':
          valueA = a.status;
          valueB = b.status;
          break;

        case 'publishedAt':
          valueA = new Date(a.publishedAt).getTime();
          valueB = new Date(b.publishedAt).getTime();
          break;
      }

      if (valueA < valueB) return direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  });

  readonly totalPages = computed(() => {
    return Math.max(
      1,
      Math.ceil(this.sortedIssues().length / this.pageSize())
    );
  });

  readonly paginatedIssues = computed(() => {
    const page = this.currentPage();
    const size = this.pageSize();
    const list = this.sortedIssues();

    const start = (page - 1) * size;
    const end = start + size;

    return list.slice(start, end);
  });

  readonly pageNumbers = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1)
  );

  readonly totalResults = computed(() => this.sortedIssues().length);

  readonly rangeStart = computed(() => {
    if (this.totalResults() === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  readonly rangeEnd = computed(() => {
    const end = this.currentPage() * this.pageSize();
    return Math.min(end, this.totalResults());
  });

  openIssue(issue: SpecialIssue): void {
    this.selectedIssue.set(issue);
  }

  setStatus(status: IssueStatus): void {
    this.statusFilter.set(status);

    this.router.navigate([], {
      queryParams: { status: status === 'all' ? null : status },
      queryParamsHandling: 'merge'
    });
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  setSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.set(
        this.sortDirection() === 'asc' ? 'desc' : 'asc'
      );
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  onPageSizeChange(event: Event): void {
    const select = event.target as HTMLSelectElement | null;
    if (!select) return;

    this.pageSize.set(+select.value);
  }

  //request archive
  async requestArchive(issue: SpecialIssue): Promise<void> {
    if (issue.status === 'archived') return;
    const ok = await this.confirm.confirm({
      title: 'Archive Issue',
      message: `Are you sure you want to archive ${issue.title}?`,
      confirmText: 'Archive',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!ok) return;

    this.issueService.updateIssueStatus(issue.id, 'archived').subscribe({
      error: (err) => console.error('Failed to archive issue:', err),
    });

  }

  async requestDelete(issue: SpecialIssue): Promise<void> {
    if (issue.status !== 'archived') return;

    const ok = await this.confirm.confirm({
      title: 'Delete Issue',
      message: `Delete ${issue.title} permanently? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!ok) return;

    this.issueService.deleteIssue(issue.id).subscribe({
      error: (err) => console.error('Failed to delete issue:', err),
    });
  }
}
