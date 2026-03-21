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

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [SearchModal, CommonModule, RouterLink, RouterLinkActive, RouterModule],
  templateUrl: './header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header implements OnInit, OnDestroy {

  private tempService = inject(TemperatureService);
  private locationService = inject(LocationService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  mobileMenuOpen = false;
  searchOpen = false;

  readonly now = signal(new Date());

  readonly city = this.locationService.city;

  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;

  readonly temperature = toSignal(
    this.tempService.getTemperature(),
    { initialValue: null }
  );

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

  ngOnInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        if (this.destroyed) return;
        this.now.set(new Date());
        this.cdr.detectChanges();
      }, 1000);
    });

    this.locationService.detectLocation();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    clearInterval(this.timer);
  }
}
