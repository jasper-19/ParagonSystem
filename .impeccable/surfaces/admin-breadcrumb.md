---
version: 1
slug: "admin-breadcrumb"
primary_target: "frontend/ParagonWebApp/src/app/shared/components/breadcrumb/breadcrumb.html"
related_targets: ["frontend/ParagonWebApp/src/app/shared/components/breadcrumb/breadcrumb.ts", "frontend/ParagonWebApp/src/app/shared/components/breadcrumb/breadcrumb.scss", "frontend/ParagonWebApp/src/app/app.routes.ts", "frontend/ParagonWebApp/src/app/features/admin/admin-layout.html"]
---

# Admin breadcrumb

Mode: Operate. Keep a clear location trail and working ancestor links across admin navigation. Existing flat URLs remain unchanged; explicit breadcrumbParents route metadata supplies All Articles for article creation/editing and Special Issues for issue creation/editing. Settings tabs resolve their label from the existing tab parameter, including General fallback, beneath Settings. Top-level pages retain Admin and their current page. Do not invent clickable category parents without a corresponding page.

Use compact Segoe UI/Helvetica Neue/Arial, navy #000035, honey #F4B400 focus accents, muted links and decorative chevrons. Replace the large rounded/shadowed card with a simple ruled trail and reduce excessive space above it. Ancestors remain 44px accessible links; the current page is a non-link span with aria-current=page. Wrap the complete trail on small screens, preserving every label and parent link rather than hiding intermediate levels.

Build the trail initially and on successful NavigationEnd, following the primary outlet only. Read route declarations to avoid inherited labels on componentless wrappers; deduplicate identical adjacent crumbs. Canonical parent URLs exclude child queries/fragments. No route paths, components, guards, API, schema, auth or services change.

Validation: 20 focused router/component tests pass, including deep links, same-shell navigation, browser history, explicit parents, settings labels, query/fragment handling, componentless wrappers and auxiliary outlets. Production build passes with the existing quill-delta/page-flip CommonJS warnings. Local browser checks with synthetic API data confirm article/issue parent links, settings tab navigation and browser history, with the complete trail visible without breadcrumb overflow at 320, 390, 768, 1024 and 1440px. Independent code review found no outstanding issues. No live data was changed.
