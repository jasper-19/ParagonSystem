import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { EligibleAdminStaff } from '../../../../../../../models/user-account.model';
import { UserAccountsService } from '../../../../../../../core/services/user-accounts.service';

export interface UserFormValue {
  staffId: string;
  username: string;
}

@Component({
  selector: 'app-user-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './user-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(UserAccountsService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() isOpen = false;
  @Input() eligibleStaff: EligibleAdminStaff[] = [];
  @Output() readonly save = new EventEmitter<UserFormValue>();
  @Output() readonly close = new EventEmitter<void>();
  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    staffId: ['', Validators.required],
    username: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(100),
        Validators.pattern(/^[a-zA-Z0-9._-]+$/),
      ],
    ],
    password: [
      '',
      [Validators.required, Validators.minLength(12), Validators.maxLength(72)],
    ],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['isOpen'] || !this.isOpen) return;
    queueMicrotask(() => {
      this.dialog?.nativeElement.querySelector<HTMLElement>('select')?.focus();
    });
  }

  @HostListener('document:keydown', ['$event'])
  handleDialogKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    this.keepFocusInDialog(event);
  }

  staffChanged(): void {
    const staff = this.eligibleStaff.find(item => item.id === this.form.controls.staffId.value);
    if (!staff) return;
    const emailUsername = staff.email.split('@')[0] ?? '';
    const fallback = staff.fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '');
    this.form.controls.username.setValue(emailUsername || fallback);
    this.form.controls.username.markAsDirty();
  }

  generatePassword(): void {
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    const random = new Uint32Array(16);
    crypto.getRandomValues(random);
    const password = Array.from(random, value => alphabet[value % alphabet.length]).join('');
    this.form.controls.password.setValue(password);
    this.form.controls.password.markAsDirty();
    this.showPassword.set(true);
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set('');
    const value = this.form.getRawValue();
    this.service
      .createAdmin({ ...value, role: 'admin' })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmitting.set(false)),
      )
      .subscribe({
        next: () => {
          this.save.emit({ staffId: value.staffId, username: value.username });
          this.form.reset();
          this.showPassword.set(false);
        },
        error: error => {
          this.errorMessage.set(
            error?.error?.error ?? 'The administrator account could not be created.',
          );
        },
      });
  }

  onClose(): void {
    if (this.isSubmitting()) return;
    this.errorMessage.set('');
    this.form.reset();
    this.showPassword.set(false);
    this.close.emit();
  }

  private keepFocusInDialog(event: KeyboardEvent): void {
    const focusable = Array.from(
      this.dialog?.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
