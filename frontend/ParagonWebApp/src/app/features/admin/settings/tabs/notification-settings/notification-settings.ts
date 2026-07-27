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
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { NotificationGlobalSettings } from '../../../../../models/global-settings.model';
import { GlobalSettingsService } from '../../../../../core/services/global-settings.service';

@Component({
  selector: 'app-notification-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './notification-settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationSettingsComponent implements OnInit {
  private readonly service = inject(GlobalSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly settings = input.required<NotificationGlobalSettings>();
  readonly version = input.required<number>();
  readonly saving = signal(false);
  readonly message = signal('');
  readonly messageKind = signal<'success' | 'error' | ''>('');
  readonly externalUpdate = signal(false);
  private acceptedVersion: number | null = null;

  readonly form = new FormGroup({
    inAppEnabled: new FormControl(true, { nonNullable: true }),
    applicationEvents: new FormControl(true, { nonNullable: true }),
    articleCreated: new FormControl(true, { nonNullable: true }),
    articlePublished: new FormControl(true, { nonNullable: true }),
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

  save(): void {
    if (this.saving() || this.form.pristine || this.externalUpdate()) return;
    this.saving.set(true);
    this.message.set('');
    this.service
      .updateSection('notifications', this.form.getRawValue(), this.version())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: snapshot => {
          this.acceptLatest(snapshot.notifications, snapshot.version);
          this.message.set('Notification rules saved.');
          this.messageKind.set('success');
        },
        error: error => {
          this.message.set(error?.error?.error ?? 'Notification settings could not be saved.');
          this.messageKind.set('error');
        },
      });
  }

  loadLatest(): void {
    this.acceptLatest(this.settings(), this.version());
    this.message.set('');
    this.messageKind.set('');
  }

  private acceptLatest(settings: NotificationGlobalSettings, version: number): void {
    this.acceptedVersion = version;
    this.externalUpdate.set(false);
    this.form.reset(settings);
  }
}
