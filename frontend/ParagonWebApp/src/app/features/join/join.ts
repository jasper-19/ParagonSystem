import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { JoinService } from './services/join.service';
import { JoinPosition } from './models/join-position.model';
import { JoinHero } from './components/hero/join-hero';
import { WhyJoin } from './components/why-join/why-join';
import { JoinPositions } from './components/positions/join-positions';
import { JoinApplicationForm } from './components/application-form/join-application-form';
import { JoinFaq } from './components/faq/join-faq';
import { JoinFinalCta } from './components/final-cta/join-final-cta';

import { ApplicationService } from '../../core/services/application.service';
import { ApplicationSettings } from '../../models/application-settings.model';

@Component({
  selector: 'app-join-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    JoinHero,
    WhyJoin,
    JoinPositions,
    JoinApplicationForm,
    JoinFaq,
    JoinFinalCta,
  ],
  templateUrl: './join.html',
})
export class JoinPage {
  private readonly joinService = inject(JoinService);
  private readonly applicationService = inject(ApplicationService);
  private readonly route = inject(ActivatedRoute);

  readonly positionsLoaded = signal(false);
  readonly settingsLoaded = signal(false);

  readonly loading = computed(
    () => !this.positionsLoaded() || !this.settingsLoaded()
  );

  constructor() {
    this.applicationService
      .getApplicationSettings()
      .pipe(
        finalize(() => {
          this.settingsLoaded.set(true);
        })
      )
      .subscribe({
        error: err => {
          console.error(
            "Failed to load application settings",
            err
          );
        },
      });
  }

  private readonly positionsSignal = toSignal(
    this.joinService.getOpenPositions().pipe(
      finalize(() => this.positionsLoaded.set(true))
    ),
    {
      initialValue: [] as JoinPosition[],
    }
  );

  private readonly applicationSettingsSignal = toSignal(
    this.applicationService.applicationSettings$,
    {
      initialValue: null as ApplicationSettings | null,
    }
  );

  readonly applicationSettings = computed(() =>
    this.applicationSettingsSignal()
  );

  readonly applicationsOpen = computed(() =>
    this.applicationSettings()?.isOpen ?? false
  );

  readonly applicationAnnouncement = computed(() =>
    this.applicationSettings()?.announcement ??
    'Applications are currently closed.'
  );

  readonly openPositions = computed(() =>
    this.positionsSignal().filter(position => position.isOpen)
  );

  readonly selectedPosition = toSignal(
    this.route.queryParamMap,
    {
      initialValue: this.route.snapshot.queryParamMap,
    }
  );

  readonly selectedPositionId = computed(() =>
    this.selectedPosition()?.get('position')
  );
}
