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
import { PublishingMediaGlobalSettings } from '../../../../../models/global-settings.model';
import { GlobalSettingsService } from '../../../../../core/services/global-settings.service';

interface MediaTypeOption {
  value: string;
  label: string;
  group: string;
}

@Component({
  selector: 'app-publishing-media-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './publishing-media-settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublishingMediaSettingsComponent implements OnInit {
  private readonly service = inject(GlobalSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly settings = input.required<PublishingMediaGlobalSettings>();
  readonly version = input.required<number>();
  readonly saving = signal(false);
  readonly message = signal('');
  readonly messageKind = signal<'success' | 'error' | ''>('');
  readonly externalUpdate = signal(false);
  private acceptedVersion: number | null = null;

  readonly mediaTypes: MediaTypeOption[] = [
    { value: 'image/jpeg', label: 'JPEG', group: 'Images' },
    { value: 'image/png', label: 'PNG', group: 'Images' },
    { value: 'image/webp', label: 'WebP', group: 'Images' },
    { value: 'image/gif', label: 'GIF', group: 'Images' },
    { value: 'application/pdf', label: 'PDF', group: 'Documents' },
    { value: 'video/mp4', label: 'MP4', group: 'Video' },
    { value: 'video/webm', label: 'WebM', group: 'Video' },
    { value: 'audio/mpeg', label: 'MP3', group: 'Audio' },
    { value: 'audio/ogg', label: 'OGG', group: 'Audio' },
    { value: 'audio/wav', label: 'WAV', group: 'Audio' },
    { value: 'audio/x-wav', label: 'WAV (legacy)', group: 'Audio' },
  ];

  readonly form = new FormGroup({
    allowDirectPublishing: new FormControl(true, { nonNullable: true }),
    requireFeaturedImage: new FormControl(true, { nonNullable: true }),
    maxUploadSizeMb: new FormControl(25, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(100)],
    }),
    allowedMimeTypes: new FormControl<string[]>([], {
      nonNullable: true,
      validators: [Validators.required],
    }),
    optimizeImages: new FormControl(true, { nonNullable: true }),
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

  hasMediaType(value: string): boolean {
    return this.form.controls.allowedMimeTypes.value.includes(value);
  }

  toggleMediaType(value: string, checked: boolean): void {
    const current = this.form.controls.allowedMimeTypes.value;
    const next = checked
      ? Array.from(new Set([...current, value]))
      : current.filter(item => item !== value);
    this.form.controls.allowedMimeTypes.setValue(next);
    this.form.controls.allowedMimeTypes.markAsDirty();
  }

  mediaTypeChanged(value: string, event: Event): void {
    this.toggleMediaType(value, (event.target as HTMLInputElement).checked);
  }

  save(): void {
    if (
      this.form.invalid ||
      this.saving() ||
      this.externalUpdate() ||
      this.form.controls.allowedMimeTypes.value.length === 0
    ) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.message.set('');
    this.service
      .updateSection('publishingMedia', this.form.getRawValue(), this.version())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: snapshot => {
          this.acceptLatest(snapshot.publishingMedia, snapshot.version);
          this.message.set('Publishing and media policies are now enforced by the server.');
          this.messageKind.set('success');
        },
        error: error => {
          this.message.set(
            error?.error?.error ?? 'Publishing and media settings could not be saved.',
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

  private acceptLatest(settings: PublishingMediaGlobalSettings, version: number): void {
    this.acceptedVersion = version;
    this.externalUpdate.set(false);
    this.form.reset(settings);
  }
}
