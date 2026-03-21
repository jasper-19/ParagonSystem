import { Component, inject, computed, signal, effect } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';

import { LoaderService } from '../../shared/services/loader.service';
import { JoinService } from './services/join.service';
import { JoinPosition } from './models/join-position.model';
import { RouterModule } from '@angular/router';
import { WelcomeBanner } from '../home/components/welcome-banner/welcomebanner';
import { JoinHero } from './components/hero/join-hero';
import { WhyJoin } from './components/why-join/why-join';
import { JoinPositions } from './components/positions/join-positions';
import { JoinApplicationForm } from './components/application-form/join-application-form';
import { JoinFaq } from './components/faq/join-faq';
import { JoinFinalCta } from './components/final-cta/join-final-cta';

@Component({
  selector: 'app-join-page',
  standalone: true,
  imports: [CommonModule, RouterModule,
    JoinHero,
    WhyJoin,
    JoinPositions,
    JoinApplicationForm,
    JoinFaq,
    JoinFinalCta,
  ],
  templateUrl: './join.html'
})
export class JoinPage {

  private joinService = inject(JoinService);

  private route = inject(ActivatedRoute);

  readonly loading = signal<boolean>(true);
  /**
   * Convert positions Observable to Signal
   */
  private positionsSignal = toSignal(
    this.joinService.getOpenPositions(),
    { initialValue: [] as JoinPosition[] }
  );

  /**
   * Public computed signal for template
   */
  readonly openPositions = computed(() =>
    this.positionsSignal().filter(position => position.isOpen)
  );

  readonly selectedPosition = toSignal (
    this.route.queryParamMap,
    { initialValue: this.route.snapshot.queryParamMap }
  );

  readonly selectedPositionId = computed(() =>
    this.selectedPosition()?.get('position')
  );

  constructor() {
    // Hide loader once positionsSignal has data
    effect(() => {
      if (this.positionsSignal().length > 0) {
        this.loading.set(false);
      }
    });
  }


}
