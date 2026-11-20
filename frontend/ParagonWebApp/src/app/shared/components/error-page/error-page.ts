import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GlobalSettingsService } from '../../../core/services/global-settings.service';
import { getErrorStatus } from './error-status';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './error-page.html',
  styleUrl: './error-page.css',
})
export class ErrorPage {
  readonly status = input<string | number | null>(500);
  readonly embedded = input(false);
  readonly allowRetry = input(true);
  readonly retry = output<void>();
  readonly detail = computed(() => getErrorStatus(this.status()));
  readonly settings = inject(GlobalSettingsService).publicSettings;
}
