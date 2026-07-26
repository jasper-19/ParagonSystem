import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProfileOverview } from './components/profile-overview/profile-overview';
import { CommonModule } from '@angular/common';
import { PersonalInformation } from './components/personal-information/personal-information';
import { AdminAuthService } from '../../../core/services/admin-auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProfileSecuritySettings } from './components/security-settings/profile-security-settings';

@Component({
  selector: 'app-admin-profile',
  standalone: true,
  imports: [
    CommonModule,
    ProfileOverview,
    ProfileSecuritySettings,
    PersonalInformation,
  ],
  templateUrl: './admin-profile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProfile {
  private readonly auth = inject(AdminAuthService);
  private readonly me = toSignal(this.auth.me(),{initialValue: null,});

  readonly staffMember = computed(() => this.me()?.staff ?? null);
  readonly adminUser = computed(() => this.me()?.user ?? null);

  refreshProfile(): void {
    this.auth
      .refreshMe()
      .subscribe({
        error: error => {
          console.error(
            'Unable to refresh profile:',
            error
          );
        },
      });
  }

}
