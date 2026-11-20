import { PageLoaderComponent } from '../../../shared/components/page-loader/page-loader';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ProfileOverview } from './components/profile-overview/profile-overview';
import { CommonModule } from '@angular/common';
import { PersonalInformation } from './components/personal-information/personal-information';
import {
  AdminAuthService,
  AdminMeResponse,
} from '../../../core/services/admin-auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProfileSecuritySettings } from './components/security-settings/profile-security-settings';
import { EMPTY, Subject, catchError, defer, finalize, switchMap } from 'rxjs';
import { RouterLink } from '@angular/router';
import { SocketService } from '../../../core/services/socket.service';

@Component({
  selector: 'app-admin-profile',
  standalone: true,
  imports: [PageLoaderComponent,
    CommonModule,
    ProfileOverview,
    ProfileSecuritySettings,
    PersonalInformation,
    RouterLink,
  ],
  templateUrl: './admin-profile.html',
  styleUrl: './admin-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProfile implements OnInit {
  private readonly auth = inject(AdminAuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly socket = inject(SocketService);
  private readonly refreshRequests = new Subject<void>();

  readonly profile = signal<AdminMeResponse | null>(null);
  readonly profileLoading = signal(true);
  readonly profileRefreshing = signal(false);
  readonly profileError = signal('');

  ngOnInit(): void {
    this.refreshRequests.pipe(
      switchMap(() => defer(() => {
        this.profileLoading.set(this.profile() === null);
        this.profileRefreshing.set(this.profile() !== null);
        this.profileError.set('');

        // Always bypass the shared cache, including when returning to this page.
        return this.auth.me(true).pipe(
          catchError(error => {
            if (error?.status === 401) this.profile.set(null);
            this.profileError.set(
              error?.status === 401
                ? 'Your account session could not be verified. Please sign in again.'
                : 'We could not load your profile details. Check your connection and try again.',
            );
            return EMPTY;
          }),
          finalize(() => {
            this.profileLoading.set(false);
            this.profileRefreshing.set(false);
          }),
        );
      })),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(response => this.profile.set(response));

    const removeStaffListener = this.socket.onStaffUpdated(() => this.refreshProfile());
    const removeConnectListener = this.socket.on<void>('connect', () => this.refreshProfile());
    const removeDisconnectListener = this.socket.on<string>('disconnect', reason => {
      // Security changes can revoke this session before a private event arrives.
      if (reason === 'io server disconnect') this.refreshProfile();
    });
    this.destroyRef.onDestroy(() => {
      removeStaffListener();
      removeConnectListener();
      removeDisconnectListener();
    });
    this.refreshProfile();
  }

  refreshProfile(): void {
    this.refreshRequests.next();
  }
}
