import { Component, OnInit, inject, EventEmitter, Output, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, NavigationEnd, Router } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { SidebarTooltipDirective } from '../../../shared/directives/sidebar-tooltip.directive';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// ----- Navigation item shape -----
interface NavItem {
  label: string;
  route?: string;
  icon: string;
  children?: NavItem[];
  open?: boolean;
  action?: 'logout';
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarTooltipDirective],
  templateUrl: './sidebar.html',
})
export class Sidebar implements OnInit {

  // ----- Outputs -----
  @Output() logoutRequested = new EventEmitter<void>();

  // ----- UI state -----
  isSidebarOpen = true;

  @ViewChild('sidebarNavigation')
  private sidebarNavigation?: ElementRef<HTMLElement>;

  // ----- Navigation definitions -----
  navItems: NavItem[] = [
    { label: 'Dashboard', route: '/admin', icon: 'dashboard' },

    {
      label: 'Content Management',
      icon: 'content',
      open: false,
      children: [
        { label: 'Articles', route: '/admin/all-articles', icon: 'articles' },
         { label: 'Special Issues', route: '/admin/all-special-issues', icon: 'issues' },
      ]
    },

    {
      label: 'Media',
      icon: 'camera',
      open: false,
      children: [
        { label: 'Media Library', route: '/admin/media-library', icon: 'media' },
      ]
    },

    {
      label: 'Editorial Board',
      icon: 'users',
      open: false,
      children: [
        { label: 'Applications', route: '/admin/applications', icon: 'assign' },
        { label: 'Staff Directory', route: '/admin/staff-directory', icon: 'user' },
        { label: 'Public Board', route: '/admin/public-board-preview', icon: 'public' }
      ]
    },

    {
      label: 'System',
      icon: 'system',
      open: false,
      children: [
        { label: 'Site Settings', route: '/admin/settings', icon: 'settings' },
        { label: 'Activity Logs', route: '/admin/activity-logs', icon: 'logs' },
      ]
    },
  ];

  accountItems: NavItem[] = [
    { label: 'Profile', route: '/admin/profile', icon: 'profile' },
    { label: 'Logout',  icon: 'logout', action: 'logout' }
  ];

  // ----- Injected services -----
  private sidebarService = inject(SidebarService);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);

  // ----- Icon map (SVG strings) -----
  iconMap: Record<string, string> = {
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" w-5  h-5 viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layout-dashboard-icon lucide-layout-dashboard">
      <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`,

    content: `<svg xmlns="http://www.w3.org/2000/svg" w-5 h-5 viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-files-icon lucide-files">
<path d="M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/><path d="M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z"/><path d="M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1"/></svg>`,

    articles: `<svg xmlns="http://www.w3.org/2000/svg" w-5 h-5 viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text-icon lucide-file-text">
<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,

    issues: `<svg xmlns="http://www.w3.org/2000/svg" w-5 h-5 viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open-icon lucide-book-open">
<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>`,

    camera: `<svg xmlns="http://www.w3.org/2000/svg" w-5 h-5 viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-icon lucide-image">
<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,

    media: `<svg xmlns="http://www.w3.org/2000/svg" w-5 h-5 viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-images-icon lucide-images">
<path d="m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16"/><path d="M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2"/><circle cx="13" cy="7" r="1" fill="currentColor"/><rect x="8" y="2" width="14" height="14" rx="2"/></svg>`,

    users: `<svg xmlns="http://www.w3.org/2000/svg" w-5 h-5 viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users-round-icon lucide-users-round">
<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/></svg>`,

    assign: `<svg xmlns="http://www.w3.org/2000/svg" w-5 h-5 viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-list-icon lucide-clipboard-list">
<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>`,

    user: `<svg xmlns="http://www.w3.org/2000/svg" w-5 h-5 viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-contact-round-icon lucide-contact-round">
<path d="M16 2v2"/><path d="M17.915 22a6 6 0 0 0-12 0"/><path d="M8 2v2"/><circle cx="12" cy="12" r="4"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>`,

    system: `<svg xmlns="http://www.w3.org/2000/svg" w-5 h-5 viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cog-icon lucide-cog">
<path d="M11 10.27 7 3.34"/><path d="m11 13.73-4 6.93"/><path d="M12 22v-2"/><path d="M12 2v2"/><path d="M14 12h8"/><path d="m17 20.66-1-1.73"/><path d="m17 3.34-1 1.73"/><path d="M2 12h2"/><path d="m20.66 17-1.73-1"/><path d="m20.66 7-1.73 1"/><path d="m3.34 17 1.73-1"/><path d="m3.34 7 1.73 1"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="8"/></svg>`,

    settings: `<svg xmlns="http://www.w3.org/2000/svg" w-5 h-5 viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings2-icon lucide-settings-2">
<path d="M14 17H5"/><path d="M19 7h-9"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>`,

    logs: `<svg xmlns="http://www.w3.org/2000/svg" w-5 h-5 viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-history-icon lucide-history">
<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,

    profile: `<svg xmlns="http://www.w3.org/2000/svg" w-5 h-5 viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-user-round-icon lucide-circle-user-round">
<path d="M17.925 20.056a6 6 0 0 0-11.851.001"/><circle cx="12" cy="11" r="4"/><circle cx="12" cy="12" r="10"/></svg>`,

    logout: `<svg xmlns="http://www.w3.org/2000/svg" w-5 h-5 viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-out-icon lucide-log-out">
<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>`,

  public:`<svg xmlns="http://www.w3.org/2000/svg" w-5 h-5 viewBox="0 0 24 24" fill="none"
stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye">
<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`
  };

  // ===== Lifecycle =====
  ngOnInit(): void {

    // Subscribe to sidebar open state observable
    this.sidebarService.sidebarOpen$
      .subscribe(open => {
        this.isSidebarOpen = open;
      });

    // Keep dropdowns in sync with navigation on route change
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.navItems.forEach(i => {
          if (i.children) {
            i.open = i.children.some(c =>
              event.urlAfterRedirects.startsWith(c.route!)
            );
          }
        });
      }
    });
  }


  // ===== Actions =====
  toggleSidebar(): void {
    this.sidebarService.toggleSidebar();
  }


  toggleItem(item: NavItem): void {
    if (!item.children?.length) {
      return;
    }

    const nextOpenState = !item.open;

    this.navItems.forEach(navItem => {
      if (navItem !== item && navItem.children) {
        navItem.open = false;
      }
    });

    item.open = nextOpenState;
  }

  getIcon(icon: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.iconMap[icon] || '');
  }

  requestLogout(): void {
    this.logoutRequested.emit();
  }

  getSubmenuId(item: NavItem): string {
    return `sidebar-submenu-${item.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}`;
  }

  onSidebarKeydown(event: KeyboardEvent): void {
    const navigation =
      this.sidebarNavigation?.nativeElement;

    if (!navigation) {
      return;
    }

    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (event.key === 'Escape') {
      this.handleEscapeKey(target);
      return;
    }

    const supportedKeys = [
      'ArrowDown',
      'ArrowUp',
      'Home',
      'End',
    ];

    if (!supportedKeys.includes(event.key)) {
      return;
    }

    const controls =
      this.getVisibleNavigationControls(
        navigation
      );

    if (!controls.length) {
      return;
    }

    const currentIndex =
      controls.indexOf(target);

    if (currentIndex < 0) {
      return;
    }

    event.preventDefault();

    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
        nextIndex =
          currentIndex === controls.length - 1
            ? 0
            : currentIndex + 1;
        break;

      case 'ArrowUp':
        nextIndex =
          currentIndex === 0
            ? controls.length - 1
            : currentIndex - 1;
        break;

      case 'Home':
        nextIndex = 0;
        break;

      case 'End':
        nextIndex = controls.length - 1;
        break;
    }

    controls[nextIndex]?.focus();
  }

  private getVisibleNavigationControls(
    navigation: HTMLElement
  ): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
    ].join(',');

    return Array.from(
      navigation.querySelectorAll<HTMLElement>(
        selector
      )
    ).filter(control => {
      return (
        control.offsetParent !== null &&
        control.getAttribute(
          'aria-hidden'
        ) !== 'true'
      );
    });
  }

  private handleEscapeKey(
    focusedElement: HTMLElement
  ): void {
    const submenu =
      focusedElement.closest<HTMLElement>(
        '[data-sidebar-submenu]'
      );

    if (!submenu) {
      return;
    }

    const submenuId =
      submenu.dataset['sidebarSubmenu'];

    if (!submenuId) {
      return;
    }

    const parentItem =
      this.navItems.find(item =>
        item.children &&
        this.getSubmenuId(item) === submenuId
      );

    if (!parentItem?.open) {
      return;
    }

    parentItem.open = false;

    queueMicrotask(() => {
      const navigation =
        this.sidebarNavigation
          ?.nativeElement;

      const parentButton =
        navigation?.querySelector<HTMLElement>(
          `[data-sidebar-parent="${submenuId}"]`
        );

      parentButton?.focus();
    });
  }

}
