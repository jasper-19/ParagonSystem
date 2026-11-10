import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, PRIMARY_OUTLET, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

export interface Breadcrumb {
  label: string;
  url: string;
}

export type BreadcrumbLabel = (route: ActivatedRouteSnapshot) => string;

export interface BreadcrumbData {
  breadcrumb: string | BreadcrumbLabel;
  breadcrumbParents?: readonly Breadcrumb[];
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './breadcrumb.html',
  styleUrl: './breadcrumb.scss',
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
    for (const child of route.children.filter(child => child.outlet === PRIMARY_OUTLET)) {
      const routeUrl = child.snapshot.url.map(segment => segment.path).join('/');
      const nextUrl = routeUrl ? `${url}/${routeUrl}` : url;
      // Read declarations rather than inherited snapshot data on componentless wrappers.
      const data = child.routeConfig?.data;
      const definition = data?.['breadcrumb'] as BreadcrumbData['breadcrumb'] | undefined;
      const label = typeof definition === 'function' ? definition(child.snapshot) : definition;

      if (typeof label === 'string' && label.trim()) {
        const parents = (data?.['breadcrumbParents'] as BreadcrumbData['breadcrumbParents']) ?? [];
        for (const parent of parents) {
          this.appendBreadcrumb(breadcrumbs, parent);
        }
        const breadcrumb = { label: label.trim(), url: nextUrl || '/' };
        this.appendBreadcrumb(breadcrumbs, breadcrumb);
      }

      this.buildBreadcrumbs(child, nextUrl, breadcrumbs);
    }

    return breadcrumbs;
  }

  private appendBreadcrumb(breadcrumbs: Breadcrumb[], breadcrumb: Breadcrumb): void {
    const previous = breadcrumbs.at(-1);
    if (!previous || previous.label !== breadcrumb.label || previous.url !== breadcrumb.url) {
      breadcrumbs.push(breadcrumb);
    }
  }
}
