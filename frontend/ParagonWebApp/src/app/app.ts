import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule,],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  protected readonly title = signal('ParagonWebApp');

  constructor(private router: Router) {}

ngOnInit(): void {

  // 🌙 Restore theme
  const theme = localStorage.getItem('theme');
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  this.router.events.subscribe(event => {
    if (event instanceof NavigationEnd) {

      // ✅ Scroll to top on every route change
      window.scrollTo({
        top: 0,
        behavior: 'smooth' // remove "smooth" if you want instant
      });
    }
  });
}
}
