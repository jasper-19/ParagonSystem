import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription, take, timer } from 'rxjs';
import { AdminAuthService, LoginResult } from '../../../core/services/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.scss',
})
export class AdminLoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private resendCountdown?: Subscription;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly capsLockOn = signal(false);
  readonly verificationPage = this.route.snapshot.data?.['verification'] === true;
  readonly emailStep = signal(false);
  readonly routeReturnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
  readonly digitSlots = [0, 1, 2, 3, 4, 5];
  readonly googleLinkStep = signal(false);
  readonly maskedEmail = signal('');
  readonly message = signal('');
  readonly resendSeconds = signal(0);

  readonly codeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.has('twoFaChanged')) {
      this.message.set('Two-factor authentication was updated. Please sign in again.');
    }
    const google = this.verificationPage ? null : this.route.snapshot.queryParamMap.get('google');
    if (google === 'error') {
      this.error.set('Google sign-in could not be completed. Please try again using your registered staff Gmail account.');
      return;
    }
    this.loading.set(true);
    if (google === 'success') {
      // The URL is only a status hint. Confirm the server session before entering admin.
      this.auth.finishGoogleLogin().pipe(
        finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: response => response.user ? this.navigateAfterLogin() : this.error.set('Please sign in again.'),
        error: () => this.error.set('Your Google session could not be verified. Please sign in again.'),
      });
      return;
    }
    this.auth.loginChallenge().pipe(
      finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: challenge => {
        if (challenge.kind === 'email' && !this.verificationPage) {
          this.openVerification();
          return;
        }
        if (this.verificationPage && challenge.kind !== 'email') {
          this.error.set('No email verification is pending. Return to sign in.');
          return;
        }
        this.maskedEmail.set(challenge.maskedEmail);
        this.googleLinkStep.set(challenge.kind === 'google-link');
        this.emailStep.set(challenge.kind === 'email');
        if (challenge.kind === 'email') { this.startResendCountdown(); this.focusCode(); }
      },
      error: (err: HttpErrorResponse) => {
        if (this.verificationPage || google === 'link' || google === 'verify' || err.status !== 404) {
          this.error.set('Your sign-in request expired or could not be loaded. Please sign in again.');
        }
      },
    });
  }

  startGoogleLogin(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.startGoogleLogin().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        const url = new URL(result.authorizationUrl);
        if (url.origin !== 'https://accounts.google.com') {
          this.loading.set(false);
          this.error.set('Unable to start Google sign-in.');
          return;
        }
        window.location.assign(url.href);
      },
      error: err => { this.loading.set(false); this.error.set(this.getLoginErrorMessage(err)); },
    });
  }

  updateCode(input: HTMLInputElement): void {
    const original = input.value;
    const caret = input.selectionStart ?? original.length;
    const digits = original.replace(/[^0-9]/g, '').slice(0, 6);
    if (original !== digits) {
      input.value = digits;
      const position = Math.min(digits.length, original.slice(0, caret).replace(/[^0-9]/g, '').length);
      input.setSelectionRange(position, position);
    }
    this.codeForm.controls.code.setValue(digits);
    this.codeForm.controls.code.markAsDirty();
  }

  verifyCode(): void {
    if (!this.emailStep() || this.loading()) return;
    if (this.codeForm.invalid) { this.codeForm.markAllAsTouched(); this.focusCode(); return; }
    this.loading.set(true);
    this.error.set(null);
    this.auth.verifyLoginCode(this.codeForm.getRawValue().code).pipe(
      finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef)
    ).subscribe({ next: result => this.handleLoginResult(result), error: err => this.error.set(this.getLoginErrorMessage(err)) });
  }

  resendCode(): void {
    if (!this.emailStep() || this.loading() || this.resendSeconds() > 0) return;
    this.loading.set(true);
    this.error.set(null);
    this.message.set('');
    this.auth.resendLoginCode().pipe(
      finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: result => {
        this.maskedEmail.set(result.maskedEmail);
        this.codeForm.reset();
        this.message.set('A new code has been sent. Use the most recent email.');
        this.startResendCountdown(); this.focusCode();
      },
      error: err => this.error.set(this.getLoginErrorMessage(err)),
    });
  }

  backToLogin(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.auth.cancelLogin().pipe(
      finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.resendCountdown?.unsubscribe(); this.resendSeconds.set(0);
        this.emailStep.set(false); this.googleLinkStep.set(false);
        this.codeForm.reset(); this.form.reset(); this.error.set(null); this.message.set('');
        void this.router.navigate(['/admin/login'], { queryParams: this.returnQuery(), replaceUrl: true });
      },
      error: err => this.error.set(this.getLoginErrorMessage(err)),
    });
  }

  private startResendCountdown(): void {
    this.resendCountdown?.unsubscribe();
    this.resendSeconds.set(60);
    this.resendCountdown = timer(1000, 1000).pipe(take(60), takeUntilDestroyed(this.destroyRef)).subscribe(tick => this.resendSeconds.set(59 - tick));
  }

  private focusCode(): void {
    queueMicrotask(() => document.getElementById('admin-email-code')?.focus());
  }

  private handleLoginResult(result: LoginResult): void {
    this.form.controls.password.reset();
    if ('twoFactorRequired' in result) {
      this.openVerification();
    } else if (result.ok) this.navigateAfterLogin();
  }

  private returnQuery(): { returnUrl: string | null } {
    return { returnUrl: this.route.snapshot.queryParamMap.get('returnUrl') };
  }

  private openVerification(): void {
    void this.router.navigate(['/admin/login/verify'], { queryParams: this.returnQuery(), replaceUrl: true });
  }

  private navigateAfterLogin(): void {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    const path = requested?.split(/[?#]/)[0];
    const safe = path === '/admin' || (path?.startsWith('/admin/') && path !== '/admin/login' && path !== '/admin/login/verify');
    void this.router.navigateByUrl(safe && requested ? requested : '/admin');
  }

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
    if (this.verificationPage || this.loading()) {
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

    const request = this.googleLinkStep()
      ? this.auth.linkGoogleAccount(username.trim(), password)
      : this.auth.login(username.trim(), password);
    request
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
      next: result => this.handleLoginResult(result),
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

    if ((error.status === 401 || error.status === 403) && !this.emailStep() && !this.googleLinkStep()) {
      return 'The username or password is incorrect.';
    }

    return (
      error.error?.error ??
      error.error?.message ??
      'Unable to sign in. Please try again.'
    );
  }
}
