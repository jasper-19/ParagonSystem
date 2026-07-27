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
import { finalize } from 'rxjs';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-profile',
  standalone: true,
  imports: [
    CommonModule,
    ProfileOverview,
    ProfileSecuritySettings,
    PersonalInformation,
    RouterLink,
  ],
  templateUrl: './admin-profile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProfile implements OnInit {
  private readonly auth = inject(AdminAuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = signal<AdminMeResponse | null>(null);
  readonly profileLoading = signal(true);
  readonly profileRefreshing = signal(false);
  readonly profileError = signal('');

  ngOnInit(): void {
    this.loadProfile(false);
  }

  refreshProfile(): void {
    this.loadProfile(true);
  }

  private loadProfile(forceRefresh: boolean): void {
    if (forceRefresh) {
      this.profileRefreshing.set(true);
    } else {
      this.profileLoading.set(true);
    }
    this.profileError.set('');

    this.auth.me(forceRefresh)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.profileLoading.set(false);
          this.profileRefreshing.set(false);
        }),
      )
      .subscribe({
        next: response => this.profile.set(response),
        error: error => {
          console.error('Unable to load profile:', error);
          this.profileError.set(
            error?.status === 401
              ? 'Your account session could not be verified. Please sign in again.'
              : 'We could not load your profile details. Check your connection and try again.',
          );
        },
      });
  }
}
