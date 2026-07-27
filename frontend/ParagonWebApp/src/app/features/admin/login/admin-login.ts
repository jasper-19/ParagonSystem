import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AdminAuthService } from '../../../core/services/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-login.html',
})
export class AdminLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly capsLockOn = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  updateCapsLock(event: KeyboardEvent): void {
    this.capsLockOn.set(event.getModifierState('CapsLock'));
  }

  clearCapsLockState(): void {
    this.capsLockOn.set(false);
  }

  submit(): void {
    if (this.loading()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalidField();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { username, password } = this.form.getRawValue();

    this.auth
      .login(username.trim(), password)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
      next: () => {
        const requestedReturnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl');
        const returnUrl =
          requestedReturnUrl?.startsWith('/admin') &&
          !requestedReturnUrl.startsWith('//')
            ? requestedReturnUrl
            : '/admin';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err: unknown) => {
        this.error.set(this.getLoginErrorMessage(err));
      },
    });
  }

  private focusFirstInvalidField(): void {
    queueMicrotask(() => {
      const invalidField = document.querySelector<HTMLElement>(
        'app-admin-login input.ng-invalid'
      );
      invalidField?.focus();
    });
  }

  private getLoginErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return error instanceof Error
        ? error.message
        : 'Unable to sign in. Please try again.';
    }

    if (error.status === 0) {
      return 'Unable to reach the server. Check your connection and try again.';
    }

    if (error.status === 429) {
      return 'Too many sign-in attempts. Please wait a moment and try again.';
    }

    if (error.status === 401 || error.status === 403) {
      return 'The username or password is incorrect.';
    }

    return (
      error.error?.error ??
      error.error?.message ??
      'Unable to sign in. Please try again.'
    );
  }
}
