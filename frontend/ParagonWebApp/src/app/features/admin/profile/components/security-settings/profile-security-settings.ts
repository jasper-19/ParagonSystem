import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AdminAuthService, ActiveSession } from '../../../../../core/services/admin-auth.service';
import { ConfirmationModal } from '../../../../../shared/components/confirmation-modal/confirmation-modal';
import { SuccessModal } from '../../../../../shared/components/feedback-modal/success-modal';
import { ErrorModal } from '../../../../../shared/components/feedback-modal/error-modal';

@Component({
  selector: 'app-security-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModal, SuccessModal, ErrorModal],
  templateUrl: './profile-security-settings.html'
})
export class ProfileSecuritySettings implements OnInit {
  private readonly auth = inject(AdminAuthService);

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  twoFAEnabled = false;
  twoFaUpdating = false;
  twoFaMessage = '';

  activeSessions: ActiveSession[] = [];
  sessionsLoading = false;
  loggingOutSessionIds: Record<string, boolean> = {};

  changingPassword = false;
  passwordMessage = '';
  passwordMessageKind: 'success' | 'error' | '' = '';

  confirmPasswordModalOpen = false;
  successPasswordModalOpen = false;
  errorPasswordModalOpen = false;
  errorPasswordModalMessage = '';

  ngOnInit(): void {
    this.loadTwoFaSetting();
    this.loadSessions();
  }

  private loadTwoFaSetting(): void {
    this.auth.me().subscribe({
      next: (res) => {
        this.twoFAEnabled = !!res?.user?.twoFaEnabled;
      },
    });
  }

  private loadSessions(): void {
    this.sessionsLoading = true;
    this.auth
      .getSessions()
      .pipe(finalize(() => (this.sessionsLoading = false)))
      .subscribe({
        next: (sessions) => {
          this.activeSessions = sessions;
        },
        error: () => {
          this.activeSessions = [];
        },
      });
  }

  setTwoFA(enabled: boolean): void {
    const previous = this.twoFAEnabled;
    this.twoFAEnabled = enabled;
    this.twoFaUpdating = true;
    this.twoFaMessage = '';

    this.auth
      .setTwoFaEnabled(enabled)
      .pipe(finalize(() => (this.twoFaUpdating = false)))
      .subscribe({
        next: (res) => {
          this.twoFAEnabled = !!res?.twoFaEnabled;
          this.twoFaMessage = this.twoFAEnabled ? '2FA enabled.' : '2FA disabled.';
        },
        error: (err) => {
          this.twoFAEnabled = previous;
          this.twoFaMessage = err?.error?.error || 'Failed to update 2FA setting.';
        },
      });
  }

  changePassword(): void {
    this.passwordMessage = '';
    this.passwordMessageKind = '';

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.passwordMessage = 'Please fill out all fields.';
      this.passwordMessageKind = 'error';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordMessage = 'New password and confirmation do not match.';
      this.passwordMessageKind = 'error';
      return;
    }

    this.confirmPasswordModalOpen = true;
  }

  cancelPasswordChange(): void {
    if (this.changingPassword) return;
    this.confirmPasswordModalOpen = false;
  }

  confirmPasswordChange(): void {
    if (this.changingPassword) return;

    this.successPasswordModalOpen = false;
    this.errorPasswordModalOpen = false;
    this.errorPasswordModalMessage = '';

    // Close the confirmation modal immediately after "Yes, change" is clicked.
    this.confirmPasswordModalOpen = false;

    this.changingPassword = true;
    this.auth
      .changePassword(this.currentPassword, this.newPassword)
      .pipe(finalize(() => (this.changingPassword = false)))
      .subscribe({
        next: () => {
          this.successPasswordModalOpen = true;
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
        },
        error: (err) => {
          this.errorPasswordModalMessage = err?.error?.error || 'Failed to change password.';
          this.errorPasswordModalOpen = true;
        },
      });
  }

  closePasswordSuccess(): void {
    this.successPasswordModalOpen = false;
  }

  closePasswordError(): void {
    this.errorPasswordModalOpen = false;
  }

  togglePasswordVisibility(field: 'current' | 'new' | 'confirm'): void {
    if (field === 'current') this.showCurrentPassword = !this.showCurrentPassword;
    if (field === 'new') this.showNewPassword = !this.showNewPassword;
    if (field === 'confirm') this.showConfirmPassword = !this.showConfirmPassword;
  }

  logoutSession(index: number): void {
    const session = this.activeSessions[index];
    if (!session) return;

    this.loggingOutSessionIds[session.id] = true;
    this.auth
      .logoutSession(session.id)
      .pipe(finalize(() => (this.loggingOutSessionIds[session.id] = false)))
      .subscribe({
        next: () => {
          this.activeSessions = this.activeSessions.filter((s) => s.id !== session.id);
          if (session.current) {
            this.auth.logout();
          }
        },
        error: () => undefined,
      });
  }
}
