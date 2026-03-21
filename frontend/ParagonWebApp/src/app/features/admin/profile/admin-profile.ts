import { ChangeDetectionStrategy, Component, ViewChild, computed, inject } from '@angular/core';
import { ProfileOverview } from './components/profile-overview/profile-overview';
import { SecuritySettings } from './components/security-settings/security-settings';
import { CommonModule } from '@angular/common';
import { PersonalInformation } from './components/personal-information/personal-information';
import { AdminAuthService } from '../../../core/services/admin-auth.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-admin-profile',
  standalone: true,
  imports: [
    CommonModule,
    ProfileOverview, 
    SecuritySettings,
    PersonalInformation,
  ],
  templateUrl: './admin-profile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProfile {
  @ViewChild(PersonalInformation) personalInformation?: PersonalInformation;

  private auth = inject(AdminAuthService);
  private me = toSignal(this.auth.me(), { initialValue: null as any });

  readonly staffMember = computed(() => this.me()?.staff ?? null);

  openPersonalInfoModal() {
    this.personalInformation?.openModal();
  }

}
