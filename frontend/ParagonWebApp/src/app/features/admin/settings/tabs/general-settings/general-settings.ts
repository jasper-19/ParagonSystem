import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DateFormat,
  GeneralGlobalSettings,
  TimeFormat,
} from '../../../../../models/global-settings.model';
import { GlobalSettingsService } from '../../../../../core/services/global-settings.service';

@Component({
  selector: 'app-general-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './general-settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralSettingsComponent implements OnInit {
  private readonly service = inject(GlobalSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly settings = input.required<GeneralGlobalSettings>();
  readonly version = input.required<number>();
  readonly saving = signal(false);
  readonly message = signal('');
  readonly messageKind = signal<'success' | 'error' | ''>('');
  readonly externalUpdate = signal(false);
  private acceptedVersion: number | null = null;

  readonly form = new FormGroup({
    siteName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    }),
    organizationName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(160)],
    }),
    contactEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(254)],
    }),
    logoUrl: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2048), Validators.pattern(/^$|^https:\/\//i)],
    }),
    timezone: new FormControl('Asia/Manila', {
      nonNullable: true,
      validators: Validators.required,
    }),
    dateFormat: new FormControl<DateFormat>('YYYY-MM-DD', {
      nonNullable: true,
      validators: Validators.required,
    }),
    timeFormat: new FormControl<TimeFormat>('12h', {
      nonNullable: true,
      validators: Validators.required,
    }),
  });

  constructor() {
    effect(() => {
      const version = this.version();
      const settings = this.settings();
      if (this.acceptedVersion === null) return;
      if (version === this.acceptedVersion) return;
      if (this.form.dirty) {
        this.externalUpdate.set(true);
        return;
      }
      this.acceptLatest(settings, version);
    });
  }

  ngOnInit(): void {
    this.acceptLatest(this.settings(), this.version());
  }

  save(): void {
    if (this.form.invalid || this.saving() || this.externalUpdate()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.message.set('');
    this.messageKind.set('');
    this.service
      .updateSection('general', this.form.getRawValue(), this.version())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: snapshot => {
          this.acceptLatest(snapshot.general, snapshot.version);
          this.message.set('General settings saved and applied.');
          this.messageKind.set('success');
        },
        error: error => {
          this.message.set(
            error?.error?.error ?? 'General settings could not be saved. Please try again.',
          );
          this.messageKind.set('error');
        },
      });
  }

  loadLatest(): void {
    this.acceptLatest(this.settings(), this.version());
    this.message.set('');
    this.messageKind.set('');
  }

  private acceptLatest(settings: GeneralGlobalSettings, version: number): void {
    this.acceptedVersion = version;
    this.externalUpdate.set(false);
    this.form.reset(settings);
  }
}
