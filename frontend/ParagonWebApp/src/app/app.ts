import { Component, OnInit, inject, signal, PLATFORM_ID, DOCUMENT, DestroyRef, RESPONSE_INIT } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SocketService } from './core/services/socket.service';
import { GlobalSettingsService } from './core/services/global-settings.service';
import { SeoService } from './core/services/seo.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private readonly globalSettings = inject(GlobalSettingsService);
  private readonly seo = inject(SeoService);
  private readonly response = inject(RESPONSE_INIT, { optional: true });
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  protected readonly title = signal('ParagonWebApp');
  protected readonly isAdminRoute = signal(false);
  protected readonly publicSettings = this.globalSettings.publicSettings;

  constructor(private router: Router, private socket: SocketService) {}

  ngOnInit(): void {
    this.socket.connect();
    this.globalSettings.loadPublic().subscribe({
      next: settings => {
        if (this.response && settings.maintenance.enabled) {
          this.response.status = 503;
          const headers = new Headers(this.response.headers);
          headers.set('Retry-After', '60');
          this.response.headers = headers;
        }
      },
      error: () => console.warn('Unable to load public site settings'),
    });
    if (this.isBrowser) {
      try {
        this.document.documentElement.classList.toggle('dark', localStorage.getItem('theme') === 'dark');
      } catch { /* Storage can be unavailable in restricted browsers. */ }
    }
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isAdminRoute.set(event.urlAfterRedirects.startsWith('/admin'));
        if (this.isBrowser) this.document.defaultView?.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }
}
