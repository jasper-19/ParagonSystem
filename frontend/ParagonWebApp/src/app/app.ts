import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';

import { Header } from './core/layout/header/header';
import { Footer } from './core/layout/footer/footer';
import { LoaderComponent } from './shared/components/loader/loader';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Header, Footer, CommonModule, LoaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  protected readonly title = signal('ParagonWebApp');
  isAdminRoute = false;

  constructor(private router: Router) {}

ngOnInit(): void {

  // 🌙 Restore theme
  const theme = localStorage.getItem('theme');
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  // 🧭 Detect admin routes + Scroll to top
  // Detect initial admin route before the first NavigationEnd fires
  this.isAdminRoute = this.router.url.startsWith('/admin');

  this.router.events.subscribe(event => {
    if (event instanceof NavigationEnd) {

      // Detect admin route
      this.isAdminRoute = event.urlAfterRedirects.startsWith('/admin');

      // ✅ Scroll to top on every route change
      window.scrollTo({
        top: 0,
        behavior: 'smooth' // remove "smooth" if you want instant
      });
    }
  });
}

}
