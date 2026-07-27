import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';
import { UserModalComponent, UserFormValue } from './components/user-modal/user-modal';
import { UserAccountsService } from '../../../../../core/services/user-accounts.service';
import { SocketService } from '../../../../../core/services/socket.service';
import {
  EligibleAdminStaff,
  ManagedUserAccount,
} from '../../../../../models/user-account.model';
import { ConfirmationService } from '../../../../../shared/components/confirmation-modal/confirmation.service';

@Component({
  selector: 'app-users-settings',
  standalone: true,
  imports: [CommonModule, UserModalComponent],
  templateUrl: './users-settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersSettingsComponent implements OnInit {
  private readonly accountsService = inject(UserAccountsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly socket = inject(SocketService);
  private readonly confirm = inject(ConfirmationService);

  readonly accounts = signal<ManagedUserAccount[]>([]);
  readonly eligibleStaff = signal<EligibleAdminStaff[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly searchTerm = signal('');
  readonly modalOpen = signal(false);
  readonly updatingAccountId = signal('');
  readonly message = signal('');
  readonly messageKind = signal<'success' | 'error' | ''>('');
  readonly realtimeRefreshing = signal(false);
  private refreshQueued = false;

  readonly filteredAccounts = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    if (!query) return this.accounts();
    return this.accounts().filter(account =>
      [
        account.username,
        account.staff?.fullName,
        account.staff?.email,
        account.staff?.assignedRole,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query)),
    );
  });

  readonly activeCount = computed(
    () => this.accounts().filter(account => account.isActive).length,
  );

  ngOnInit(): void {
    this.load();
    const unsubscribeBoard = this.socket.onEditorialBoardUpdated(() =>
      this.refreshFromRealtime('Active board membership changed. Available staff are up to date.'),
    );
    const unsubscribeUsers = this.socket.onUserAccountsUpdated(() =>
      this.refreshFromRealtime('User accounts were updated in another session.'),
    );
    this.destroyRef.onDestroy(() => {
      unsubscribeBoard();
      unsubscribeUsers();
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      accounts: this.accountsService.list(),
      eligibleStaff: this.accountsService.listEligibleStaff(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ accounts, eligibleStaff }) => {
          this.accounts.set(accounts);
          this.eligibleStaff.set(eligibleStaff);
        },
        error: error => {
          console.error('Unable to load user accounts:', error);
          this.loadError.set('User accounts could not be loaded. Please try again.');
        },
      });
  }

  private refreshFromRealtime(message: string): void {
    if (this.realtimeRefreshing()) {
      this.refreshQueued = true;
      return;
    }

    this.realtimeRefreshing.set(true);
    forkJoin({
      accounts: this.accountsService.list(),
      eligibleStaff: this.accountsService.listEligibleStaff(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.realtimeRefreshing.set(false);
          if (this.refreshQueued) {
            this.refreshQueued = false;
            this.refreshFromRealtime(message);
          }
        }),
      )
      .subscribe({
        next: ({ accounts, eligibleStaff }) => {
          this.accounts.set(accounts);
          this.eligibleStaff.set(eligibleStaff);
          this.loadError.set('');
          this.message.set(message);
          this.messageKind.set('success');
        },
        error: error => {
          console.error('Unable to apply the real-time user account update:', error);
          this.message.set('A live update was received, but the latest staff list could not be loaded.');
          this.messageKind.set('error');
        },
      });
  }

  searchChanged(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  openCreateModal(): void {
    this.message.set('');
    this.modalOpen.set(true);
  }

  closeCreateModal(): void {
    this.modalOpen.set(false);
  }

  accountCreated(value: UserFormValue): void {
    const staff = this.eligibleStaff().find(item => item.id === value.staffId);
    if (!staff) return;
    this.modalOpen.set(false);
    this.load();
    this.message.set(`Administrator access was created for ${staff.fullName}.`);
    this.messageKind.set('success');
  }

  async requestAccessChange(account: ManagedUserAccount): Promise<void> {
    if (this.updatingAccountId()) return;
    this.message.set('');
    const name = account.staff?.fullName ?? account.username;
    const restoring = !account.isActive;
    const confirmed = await this.confirm.confirm({
      title: restoring
        ? 'Restore administrator access?'
        : 'Deactivate administrator access?',
      message: restoring
        ? `${name} will be able to sign in again using the existing credentials.`
        : `Existing sessions for ${name} will be revoked and future sign-ins will be blocked.`,
      confirmText: restoring ? 'Restore access' : 'Deactivate access',
      cancelText: 'Cancel',
      variant: restoring ? 'default' : 'danger',
    });
    if (!confirmed) return;
    this.applyAccessChange(account);
  }

  private applyAccessChange(account: ManagedUserAccount): void {
    this.updatingAccountId.set(account.id);
    this.accountsService
      .setActive(account.id, !account.isActive)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.updatingAccountId.set('')),
      )
      .subscribe({
        next: updated => {
          this.accounts.update(accounts =>
            accounts.map(item => (item.id === updated.id ? { ...item, ...updated } : item)),
          );
          this.message.set(
            `${account.staff?.fullName ?? account.username} is now ${
              updated.isActive ? 'active' : 'deactivated'
            }.`,
          );
          this.messageKind.set('success');
        },
        error: error => {
          this.message.set(error?.error?.error ?? 'Account access could not be changed.');
          this.messageKind.set('error');
        },
      });
  }

  trackAccount(_index: number, account: ManagedUserAccount): string {
    return account.id;
  }
}
