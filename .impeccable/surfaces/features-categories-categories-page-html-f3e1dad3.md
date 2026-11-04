---
version: 1
slug: "features-categories-categories-page-html-f3e1dad3"
primary_target: "frontend/ParagonWebApp/src/app/features/categories/categories-page.html"
related_targets: ["frontend/ParagonWebApp/src/app/features/categories/components/hero-section/categories-hero.html","frontend/ParagonWebApp/src/app/features/categories/components/articles-section/categories-articles.html"]
---

# Top-stories page

Mode: Read. Scope: polish the existing top-stories browsing flow, retaining its navy/gold palette, category and topic filters, search, sort choices, article metadata and links, automatic pagination, manual load-more fallback, and shared navigation.

The page inherits the public reading system's serif headlines, sans-serif controls, square photography, flat article groups, and visible navy focus outlines. The existing hero/filter/results sequence and three-column desktop article grid remain. The hero is compact solid navy; filters use a ruled white panel; missing article images do not create empty image tiles. Mobile keeps locally scrollable categories and stacks the search and sort controls.

Functional corrections: arrival reads a validated sort query parameter; changing sort preserves category links and records the choice in the URL; clearing filters removes category/sort and cancels a pending debounced search. Failed article requests show a retry action and suppress automatic pagination until retry succeeds.

No new product facts, imagery, font assets, or system-wide design tokens were introduced. Shared home/header/footer source and existing DESIGN.md remain unchanged by this polish pass.
