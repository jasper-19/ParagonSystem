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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { MaintenanceGlobalSettings } from '../../../../../models/global-settings.model';
import { GlobalSettingsService } from '../../../../../core/services/global-settings.service';

@Component({
  selector: 'app-maintenance-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './maintenance-settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceSettingsComponent implements OnInit {
  private readonly service = inject(GlobalSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly settings = input.required<MaintenanceGlobalSettings>();
  readonly version = input.required<number>();
  readonly saving = signal(false);
  readonly enableConfirmed = signal(false);
  readonly message = signal('');
  readonly messageKind = signal<'success' | 'error' | ''>('');
  readonly externalUpdate = signal(false);
  private acceptedVersion: number | null = null;

  readonly form = new FormGroup({
    enabled: new FormControl(false, { nonNullable: true }),
    message: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(500)],
    }),
    allowAdminBypass: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const version = this.version();
      const settings = this.settings();
      if (this.acceptedVersion === null || version === this.acceptedVersion) return;
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

  confirmationChanged(event: Event): void {
    this.enableConfirmed.set((event.target as HTMLInputElement).checked);
  }

  save(): void {
    const newlyEnabling = this.form.controls.enabled.value && !this.settings().enabled;
    if (
      this.form.invalid ||
      this.saving() ||
      this.externalUpdate() ||
      (newlyEnabling && !this.enableConfirmed())
    ) {
      this.form.markAllAsTouched();
      if (newlyEnabling && !this.enableConfirmed()) {
        this.message.set('Confirm the availability impact before enabling maintenance mode.');
        this.messageKind.set('error');
      }
      return;
    }
    this.saving.set(true);
    this.message.set('');
    this.service
      .updateSection('maintenance', this.form.getRawValue(), this.version())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: snapshot => {
          this.acceptLatest(snapshot.maintenance, snapshot.version);
          this.enableConfirmed.set(false);
          this.message.set(
            snapshot.maintenance.enabled
              ? 'Maintenance mode is active. Public API requests now receive a maintenance response.'
              : 'Maintenance mode is disabled and public access is restored.',
          );
          this.messageKind.set('success');
        },
        error: error => {
          this.message.set(error?.error?.error ?? 'Maintenance settings could not be saved.');
          this.messageKind.set('error');
        },
      });
  }

  loadLatest(): void {
    this.acceptLatest(this.settings(), this.version());
    this.message.set('');
    this.messageKind.set('');
  }

  private acceptLatest(settings: MaintenanceGlobalSettings, version: number): void {
    this.acceptedVersion = version;
    this.externalUpdate.set(false);
    this.enableConfirmed.set(false);
    this.form.reset(settings);
  }
}
