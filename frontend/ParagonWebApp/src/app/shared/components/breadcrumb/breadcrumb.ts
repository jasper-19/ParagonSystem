import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

interface Breadcrumb {
  label: string;
  url: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterLink, NgClass],
  templateUrl: './breadcrumb.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Breadcrumbs implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumbs = signal<Breadcrumb[]>([]);

  ngOnInit(): void {
    this.updateBreadcrumbs();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.updateBreadcrumbs());
  }

  trackBreadcrumb(index: number, breadcrumb: Breadcrumb): string {
    return `${index}-${breadcrumb.url}-${breadcrumb.label}`;
  }

  private updateBreadcrumbs(): void {
    this.breadcrumbs.set(this.buildBreadcrumbs(this.route.root));
  }

  private buildBreadcrumbs(
    route: ActivatedRoute,
    url = '',
    breadcrumbs: Breadcrumb[] = [],
  ): Breadcrumb[] {
    for (const child of route.children) {
      const routeUrl = child.snapshot.url.map(segment => segment.path).join('/');
      const nextUrl = routeUrl ? `${url}/${routeUrl}` : url;
      const label = child.snapshot.data['breadcrumb'];

      if (typeof label === 'string' && label.trim()) {
        const breadcrumb = { label: label.trim(), url: nextUrl || '/' };
        const previous = breadcrumbs.at(-1);

        if (!previous || previous.label !== breadcrumb.label || previous.url !== breadcrumb.url) {
          breadcrumbs.push(breadcrumb);
        }
      }

      this.buildBreadcrumbs(child, nextUrl, breadcrumbs);
    }

    return breadcrumbs;
  }
}
