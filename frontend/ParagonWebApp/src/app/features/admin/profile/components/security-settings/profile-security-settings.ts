import { Component, OnInit,  OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize, Subject, takeUntil, catchError, retry, throwError, timeout, timer } from 'rxjs';
import { AdminAuthService, ActiveSession } from '../../../../../core/services/admin-auth.service';
import { SuccessModal } from '../../../../../shared/components/feedback-modal/success-modal';
import { ErrorModal } from '../../../../../shared/components/feedback-modal/error-modal';

@Component({
  selector: 'app-security-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, SuccessModal, ErrorModal, ReactiveFormsModule],
  templateUrl: './profile-security-settings.html'
})
export class ProfileSecuritySettings implements OnInit, OnDestroy {
  private readonly auth = inject(AdminAuthService);
  private readonly destroy$ = new Subject<void>();
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);

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
  sessionsError = '';
  loggingOutSessionIds: Record<string, boolean> = {};

  changingPassword = false;
  passwordMessage = '';
  passwordMessageKind: 'success' | 'error' | '' = '';

  successPasswordModalOpen = false;
  errorPasswordModalOpen = false;
  errorPasswordModalMessage = '';

  readonly passwordForm =
    this.fb.nonNullable.group(
      {
        currentPassword: [
          '',
          [
            Validators.required,
          ],
        ],

        newPassword: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            this.passwordComplexityValidator,
          ],
        ],

        confirmPassword: [
          '',
          [
            Validators.required,
          ],
        ],
      },
      {
        validators: [
          this.passwordsMatchValidator,
          this.newPasswordDifferentValidator,
        ],
      }
    );

  ngOnInit(): void {
    this.loadTwoFaSetting();
    this.loadSessions();

    this.passwordForm
      .valueChanges
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (
          this.passwordMessage
        ) {
          this.passwordMessage = '';
          this.passwordMessageKind = '';
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTwoFaSetting(): void {
    this.auth
      .me()
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: response => {
          this.twoFAEnabled =
            Boolean(
              response.user
                ?.twoFaEnabled
            );

            this.cdr.markForCheck();
        },

        error: error => {
          console.error(
            'Unable to load two-factor authentication setting:',
            error
          );

          this.twoFAEnabled =
            false;

          this.cdr.markForCheck();
        },
      });
  }

  private loadSessions(): void {
    if (this.sessionsLoading) {
      return;
    }

    this.sessionsLoading = true;
    this.sessionsError = '';

    this.auth
      .getSessions()
      .pipe(
        // Never allow the loading state to remain pending forever.
        timeout(10_000),

        // Retry once for a transient initial authentication failure.
        retry({
          count: 1,

          delay: (
            error,
            retryCount
          ) => {
            const status =
              Number(
                error?.status ?? 0
              );

            const retryable =
              status === 0 ||
              status === 401 ||
              status === 503;

            if (!retryable) {
              return throwError(
                () => error
              );
            }

            console.warn(
              `Retrying active sessions request (${retryCount}/1)...`,
              error
            );

            return timer(300);
          },
        }),

        takeUntil(this.destroy$),

        catchError(error => {
          console.error(
            'Unable to load active sessions:',
            error
          );

          this.activeSessions = [];

          if (
            error?.name ===
            'TimeoutError'
          ) {
            this.sessionsError =
              'The active sessions request took too long. Please try again.';
          } else if (
            error?.status === 401
          ) {
            this.sessionsError =
              'Your session could not be verified. Please sign in again.';
          } else {
            this.sessionsError =
              'Unable to load active sessions.';
          }

          this.cdr.markForCheck();

          return throwError(
            () => error
          );
        }),

        finalize(() => {
          this.sessionsLoading =
            false;

            this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: sessions => {
          this.activeSessions =
            sessions;

          this.sessionsError =
            '';

            this.cdr.markForCheck();
        },

        error: () => {
          // The message and state were already
          // handled in catchError().
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
      .pipe(
        finalize(() => {
          this.twoFaUpdating =
            false;
        }),

        takeUntil(this.destroy$)
      )
      .subscribe({
        next: response => {
          this.twoFAEnabled =
            Boolean(
              response.twoFaEnabled
            );

          this.twoFaMessage =
            this.twoFAEnabled
              ? '2FA enabled.'
              : '2FA disabled.';

          this.auth.invalidateMeCache();
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

    if (
      this.changingPassword
    ) {
      return;
    }

    if (
      this.passwordForm.invalid ||
      !this.passwordForm.dirty
    ) {
      this.passwordForm
        .markAllAsTouched();

      this.passwordMessage =
        'Review the password requirements before continuing.';

      this.passwordMessageKind =
        'error';

      this.cdr.markForCheck();

      return;
    }

    this.successPasswordModalOpen =
      false;

    this.errorPasswordModalOpen =
      false;

    this.errorPasswordModalMessage =
      '';

    const {
      currentPassword,
      newPassword,
    } =
      this.passwordForm
        .getRawValue();

    this.changingPassword =
      true;

    this.auth
      .changePassword(
        currentPassword,
        newPassword
      )
      .pipe(
        takeUntil(this.destroy$),

        finalize(() => {
          this.changingPassword =
            false;

          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.successPasswordModalOpen =
            true;

          this.passwordForm.reset();
          this.passwordForm.markAsPristine();
          this.passwordForm.markAsUntouched();

          this.passwordMessage = '';
          this.passwordMessageKind = '';

          this.showCurrentPassword =
            false;

          this.showNewPassword =
            false;

          this.showConfirmPassword =
            false;

          this.loadSessions();

          this.cdr.markForCheck();
        },

        error: error => {
          this.errorPasswordModalMessage =
            error?.error?.error ||
            'Failed to change password.';

          this.errorPasswordModalOpen =
            true;

          this.cdr.markForCheck();
        },
      });
  }


  closePasswordSuccess(): void {
    this.successPasswordModalOpen =
      false;

    this.cdr.markForCheck();
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
      .pipe(
        finalize(() => {
          this.loggingOutSessionIds[
            session.id
          ] = false;
        }),

        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          this.activeSessions =
            this.activeSessions.filter(
              activeSession =>
                activeSession.id !==
                session.id
            );

          if (session.current) {
            this.auth.invalidateMeCache();
          }
        },

        error: error => {
          console.error(
            'Unable to log out session:',
            error
          );
        },
      });
  }

  retrySessions(): void {
    this.loadSessions();
  }

  requirementClass(
    satisfied: boolean
  ): string {
    return satisfied
      ? 'text-green-700'
      : 'text-[#000035]/45';
  }

  // Convenience getters for form controls
  get currentPasswordControl() {
    return this.passwordForm.controls
      .currentPassword;
  }

  get newPasswordControl() {
    return this.passwordForm.controls
      .newPassword;
  }

  get confirmPasswordControl() {
    return this.passwordForm.controls
      .confirmPassword;
  }

  // Convenience getters for password complexity checks and strength scoring
  get newPasswordValue(): string {
    return this.newPasswordControl.value;
  }

  get hasMinimumLength(): boolean {
    return this.newPasswordValue.length >= 8;
  }

  get hasUppercase(): boolean {
    return /[A-Z]/.test(
      this.newPasswordValue
    );
  }

  get hasLowercase(): boolean {
    return /[a-z]/.test(
      this.newPasswordValue
    );
  }

  get hasNumber(): boolean {
    return /\d/.test(
      this.newPasswordValue
    );
  }

  get hasSpecialCharacter(): boolean {
    return /[^A-Za-z0-9]/.test(
      this.newPasswordValue
    );
  }

  // Returns a score from 0 to 5 based on the number of password complexity requirements met.
  get passwordStrengthScore(): number {
    return [
      this.hasMinimumLength,
      this.hasUppercase,
      this.hasLowercase,
      this.hasNumber,
      this.hasSpecialCharacter,
    ].filter(Boolean).length;
  }

  // Returns a human-readable label for the password strength based on the score.
  get passwordStrengthLabel(): string {
    const score =
      this.passwordStrengthScore;

    if (score <= 1) {
      return 'Very weak';
    }

    if (score === 2) {
      return 'Weak';
    }

    if (score === 3) {
      return 'Fair';
    }

    if (score === 4) {
      return 'Strong';
    }

    return 'Very strong';
  }

  // Returns a CSS width percentage for the password strength bar based on the score (0-5).
  get passwordStrengthWidth(): string {
    return `${
      this.passwordStrengthScore * 20
    }%`;
  }

  // Returns a CSS class for the password strength bar based on the score (0-5).
  get passwordStrengthClass(): string {
    const score =
      this.passwordStrengthScore;

    if (score <= 1) {
      return 'bg-red-500';
    }

    if (score === 2) {
      return 'bg-orange-500';
    }

    if (score === 3) {
      return 'bg-yellow-500';
    }

    if (score === 4) {
      return 'bg-blue-500';
    }

    return 'bg-green-500';
  }

  // Convenience getters for confirm password validation
  get confirmPasswordValue(): string {
    return this.confirmPasswordControl.value;
  }

  get passwordsMatch(): boolean {
    const newPassword =
      this.newPasswordControl.value;

    const confirmPassword =
      this.confirmPasswordControl.value;

    return (
      newPassword.length > 0 &&
      confirmPassword.length > 0 &&
      newPassword === confirmPassword
    );
  }

  // Returns true if the confirm password field has been filled and the passwords do not match.
  get passwordsDoNotMatch(): boolean {
    const newPassword =
      this.newPasswordControl.value;

    const confirmPassword =
      this.confirmPasswordControl.value;

    return (
      confirmPassword.length > 0 &&
      newPassword !== confirmPassword
    );
  }

  // Returns true if the password form is valid, dirty, and not currently changing the password.
  get canSubmitPasswordChange(): boolean {
    return (
      this.passwordForm.valid &&
      this.passwordForm.dirty &&
      !this.changingPassword
    );
  }

  private passwordComplexityValidator(
    control: AbstractControl
  ): ValidationErrors | null {
    const value =
      String(
        control.value ?? ''
      );

    if (!value) {
      return null;
    }

    const hasUppercase =
      /[A-Z]/.test(value);

    const hasLowercase =
      /[a-z]/.test(value);

    const hasNumber =
      /\d/.test(value);

    const hasSpecialCharacter =
      /[^A-Za-z0-9]/.test(value);

    return (
      hasUppercase &&
      hasLowercase &&
      hasNumber &&
      hasSpecialCharacter
    )
      ? null
      : {
          passwordComplexity:
            true,
        };
  }

  private passwordsMatchValidator(
    control: AbstractControl
  ): ValidationErrors | null {
    const newPassword =
      control.get(
        'newPassword'
      )?.value;

    const confirmPassword =
      control.get(
        'confirmPassword'
      )?.value;

    if (
      !newPassword ||
      !confirmPassword
    ) {
      return null;
    }

    return newPassword ===
      confirmPassword
      ? null
      : {
          passwordsMismatch:
            true,
        };
  }

  private newPasswordDifferentValidator(
    control: AbstractControl
  ): ValidationErrors | null {
    const currentPassword =
      control.get(
        'currentPassword'
      )?.value;

    const newPassword =
      control.get(
        'newPassword'
      )?.value;

    if (
      !currentPassword ||
      !newPassword
    ) {
      return null;
    }

    return currentPassword !==
      newPassword
      ? null
      : {
          passwordUnchanged:
            true,
        };
  }

}
