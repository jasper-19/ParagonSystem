import { Component, inject, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterModule,
  RouterOutlet,
} from '@angular/router';
import { Sidebar } from '../../core/layout/sidebar/sidebar';
import { AdminHeaderComponent } from './layout/admin-header/admin-header';
import { Breadcrumbs } from '../../shared/components/breadcrumb/breadcrumb';
import { ConfirmationModal } from '../../shared/components/confirmation-modal/confirmation-modal';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ConfirmationService } from '../../shared/components/confirmation-modal/confirmation.service';
import { SidebarService } from '../../core/services/sidebar.service';
import { AdminLoaderService } from '../../core/services/admin-loader.service';
import { Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    RouterOutlet,
    Sidebar,
    AdminHeaderComponent,
    Breadcrumbs,
    ConfirmationModal
  ],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.scss'],
})
export class AdminLayout implements OnInit, OnDestroy {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private readonly sidebarService = inject(SidebarService);
  private readonly loader = inject(AdminLoaderService);
  private readonly cdr = inject(ChangeDetectorRef);
  isSidebarOpen = this.sidebarService.value;
  private sidebarSub?: Subscription;
  private routerSub?: Subscription;
  private loaderSub?: Subscription;

  isAdminNavigating = false;
  isAdminDataLoading = false;

  private readonly mobileMediaQuery = '(max-width: 767px)';
  isMobileView =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(this.mobileMediaQuery).matches
      : false;
  private mediaQueryList?: MediaQueryList;
  private readonly onMediaQueryChange = (event: MediaQueryListEvent) => {
    this.isMobileView = event.matches;
    this.applyMobileSidebarEffects();
    this.cdr.detectChanges();
  };

  protected readonly confirm = inject(ConfirmationService);

  ngOnInit(): void {
    // `NavigationStart` can fire before this component initializes.
    // If we're being created as part of an in-flight navigation, start in loading state.
    this.isAdminNavigating = !!this.router.getCurrentNavigation();

    this.routerSub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.isAdminNavigating = true;
        this.cdr.detectChanges();
        return;
      }
      if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
        this.isAdminNavigating = false;
        this.cdr.detectChanges();
      }
    });

    this.loaderSub = this.loader.isLoading$.subscribe((loading) => {
      this.isAdminDataLoading = loading;
      this.cdr.detectChanges();
    });

    // If navigation finishes before our router subscription is attached, we won't receive a terminal event.
    // Re-check once Angular has had a chance to flush the current navigation state.
    queueMicrotask(() => {
      if (this.isAdminNavigating && !this.router.getCurrentNavigation()) {
        this.isAdminNavigating = false;
        this.cdr.detectChanges();
      }
    });

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    // Keep sidebar state in this layout component to avoid NG0100 from child Output timing.
    // Skip initial emission since we already initialized from service.value
    this.sidebarSub = this.sidebarService.sidebarOpen$.pipe(
      skip(1)
    ).subscribe(open => {
      this.isSidebarOpen = open;
      this.applyMobileSidebarEffects();
    });

    this.mediaQueryList = window.matchMedia(this.mobileMediaQuery);
    this.mediaQueryList.addEventListener('change', this.onMediaQueryChange);
    this.applyMobileSidebarEffects();
  }

  ngOnDestroy(): void {
    this.mediaQueryList?.removeEventListener('change', this.onMediaQueryChange);
    this.sidebarSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.loaderSub?.unsubscribe();
    this.loader.reset();
    this.setScrollLocked(false);
  }

  closeSidebarOnMobile(): void {
    if (this.isMobileView && this.isSidebarOpen) {
      this.sidebarService.setSidebar(false);
    }
  }

  openSidebarOnMobile(): void {
    if (this.isMobileView && !this.isSidebarOpen) {
      this.sidebarService.setSidebar(true);
    }
  }

  toggleSidebarFromHeader(): void {
    if (this.isMobileView) {
      this.sidebarService.toggleSidebar();
    }
  }

  private applyMobileSidebarEffects(): void {
    const shouldLock = this.isMobileView && this.isSidebarOpen;
    this.setScrollLocked(shouldLock);
  }

  private setScrollLocked(locked: boolean): void {
    const overflowValue = locked ? 'hidden' : '';
    document.documentElement.style.overflow = overflowValue;
    document.body.style.overflow = overflowValue;
    document.body.style.touchAction = locked ? 'none' : '';
  }

  async onLogoutRequested(): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Logout?',
      message: 'Are you sure you want to end your session?',
      confirmText: 'Logout',
      cancelText: 'Stay Logged In',
      variant: 'danger',
    });

    if (!ok) return;

    this.auth.logout();
    this.router.navigateByUrl('/admin/login');
  }
}
