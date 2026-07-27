import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SocketService } from './core/services/socket.service';
import { GlobalSettingsService } from './core/services/global-settings.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule,],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  private readonly globalSettings = inject(GlobalSettingsService);
  protected readonly title = signal('ParagonWebApp');
  protected readonly isAdminRoute = signal(false);
  protected readonly publicSettings = this.globalSettings.publicSettings;

  constructor(
    private router: Router,
    private socket: SocketService,
  ) {}

ngOnInit(): void {

  this.socket.connect();
  this.globalSettings.loadPublic().subscribe({
    error: error => console.warn('Unable to load public site settings:', error),
  });

  // 🌙 Restore theme
  const theme = localStorage.getItem('theme');
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  this.router.events.subscribe(event => {
    if (event instanceof NavigationEnd) {
      this.isAdminRoute.set(event.urlAfterRedirects.startsWith('/admin'));

      // ✅ Scroll to top on every route change
      window.scrollTo({
        top: 0,
        behavior: 'smooth' // remove "smooth" if you want instant
      });
    }
  });
}
}
