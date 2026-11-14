import { Component, DestroyRef, inject } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Header } from '../../core/layout/header/header';
import { Footer } from '../../core/layout/footer/footer';
import { LoaderComponent } from '../../shared/components/loader/loader';
import { LoaderService } from '../../shared/services/loader.service';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, Header, Footer, LoaderComponent],
  templateUrl: './public-layout.html',
})
export class PublicLayout {
  private readonly router = inject(Router);
  private readonly loader = inject(LoaderService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigationLoaders = new Map<number, number>();

  constructor() {
    // The layout may be created after the first NavigationStart has fired.
    const navigation = this.router.currentNavigation();
    if (navigation) this.beginNavigation(navigation.id);

    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationStart) this.beginNavigation(event.id);
      if (event instanceof NavigationEnd || event instanceof NavigationCancel ||
          event instanceof NavigationError || event instanceof NavigationSkipped) {
        const token = this.navigationLoaders.get(event.id);
        if (token !== undefined) {
          this.loader.hide(token);
          this.navigationLoaders.delete(event.id);
        }
      }
    });
    this.destroyRef.onDestroy(() => {
      for (const token of this.navigationLoaders.values()) this.loader.hide(token);
      this.navigationLoaders.clear();
    });
  }

  private beginNavigation(id: number): void {
    if (!this.navigationLoaders.has(id)) this.navigationLoaders.set(id, this.loader.show());
  }
}
