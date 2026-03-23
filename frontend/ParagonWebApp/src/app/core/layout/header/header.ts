import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { SearchModal } from '../../../shared/components/search-modal/search-modal';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterModule } from '@angular/router';
import { TemperatureService } from '../../services/temperature.service';
import { LocationService } from '../../services/location.service';
import { toSignal } from '@angular/core/rxjs-interop';

// ===== Header Component =====
// Responsible for rendering the top navigation, search modal, and
// lightweight UI state (mobile menu, search open) as well as exposing
// clock, temperature, and location data used by the template.
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [SearchModal, CommonModule, RouterLink, RouterLinkActive, RouterModule],
  templateUrl: './header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header implements OnInit, OnDestroy {

  // ----- Injected services (functional `inject` to keep constructor-less) -----
  private tempService = inject(TemperatureService);
  private locationService = inject(LocationService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  // ----- UI state -----
  // Mobile menu visibility flag
  mobileMenuOpen = false;
  // Search modal visibility flag
  searchOpen = false;

  // ----- Reactive signals / derived state -----
  // Live date/time signal updated on an interval
  readonly now = signal(new Date());

  // City signal provided by the LocationService
  readonly city = this.locationService.city;

  // Temperature signal created from a cold observable via toSignal
  readonly temperature = toSignal(
    this.tempService.getTemperature(),
    { initialValue: null }
  );

  // ----- Internal timer and lifecycle flags -----
  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;

  // ===== UI actions (preserve original logic) =====
  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  openSearch(): void {
    this.searchOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeSearch(): void {
    this.searchOpen = false;
    document.body.style.overflow = '';
  }

  // ===== Lifecycle hooks =====
  ngOnInit(): void {
    // Keep the clock update outside Angular's zone to avoid unnecessary
    // change detection cycles; we manually trigger detection when needed.
    this.ngZone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        if (this.destroyed) return;
        this.now.set(new Date());
        this.cdr.detectChanges();
      }, 1000);
    });

    // Start location detection (may update `city` signal)
    this.locationService.detectLocation();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    clearInterval(this.timer);
  }
}
