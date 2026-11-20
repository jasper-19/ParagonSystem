import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ErrorPage } from './error-page';

@Component({
  standalone: true,
  imports: [ErrorPage],
  template: '<main id="main-content"><app-error-page [status]="status()" [allowRetry]="false" /></main>',
})
export class ErrorRoute {
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly status = computed(() => this.params().get('status') ?? this.route.snapshot.data['status'] ?? 404);
}
