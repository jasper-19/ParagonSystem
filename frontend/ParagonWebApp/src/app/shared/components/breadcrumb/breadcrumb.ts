import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';

interface Breadcrumb {
  label: string;
  url: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './breadcrumb.html',
})
export class Breadcrumbs implements OnInit {
  breadcrumbs: Breadcrumb[] = [];

  constructor(private router: Router, private route: ActivatedRoute) {}

 ngOnInit() {

  // ✅ Build immediately (for refresh / first load)
  this.breadcrumbs = this.buildBreadcrumbs(this.route.root);

  // ✅ Rebuild on route change
  this.router.events
    .pipe(filter(event => event instanceof NavigationEnd))
    .subscribe(() => {
      this.breadcrumbs = this.buildBreadcrumbs(this.route.root);
    });
}


  private buildBreadcrumbs(route: ActivatedRoute, url: string = '', breadcrumbs: Breadcrumb[] = []): Breadcrumb[] {
    const children: ActivatedRoute[] = route.children;
    if (children.length === 0) {
      return breadcrumbs;
    }

    for (const child of children) {
      const routeURL = child.snapshot.url.map(segment => segment.path).join('/');
      let nextUrl = url;
      if (routeURL) {
        nextUrl += `/${routeURL}`;
      }
      const label = child.snapshot.data['breadcrumb'];
      if (label !== undefined && label !== null && label !== '') {
        breadcrumbs.push({ label, url: nextUrl });
      }
      this.buildBreadcrumbs(child, nextUrl, breadcrumbs);
    }
    return breadcrumbs;
  }
}
