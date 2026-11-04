---
version: 1
slug: "pp-src-app-features-articles-article-html-7d320731"
primary_target: "frontend/ParagonWebApp/src/app/features/articles/article.html"
related_targets: ["frontend/ParagonWebApp/src/app/features/articles/components/meta/meta.html","frontend/ParagonWebApp/src/app/features/articles/components/section/section.html","frontend/ParagonWebApp/src/app/features/articles/components/related/related.html","frontend/ParagonWebApp/src/app/features/articles/components/other-stories/other-stories.html","frontend/ParagonWebApp/src/app/features/articles/components/staff-application/staff-application.html"]
---

# Article detail page

Mode: Read. Polish the existing article reading flow inside the publication's navy/gold/white palette and existing serif/sans typography.

Keep article copy, rich content, credits, published date, view count, reading time, category navigation, topics, copy/native sharing, related stories, other stories, and the recruitment/editorial-board links. The header uses a readable serif title, restrained metadata, and a plain category link. Article imagery stays uncropped with a quiet neutral ground and no shadow; articles without imagery proceed directly into the story. The reading column and details sidebar remain, stacking on narrower screens. Recommendation sections use flat story groups and compact rows rather than nested boxes. Shared header/footer and other routes remain outside scope.

Loading now clears the prior story on route changes. Failed and missing article requests replace the skeleton with a recovery message, retry, and archive link. A failed copy action reports failure rather than false success, retaining native-share fallback and keyboard focus. The existing social-preview metadata fallback points to the actual retained asset.

Validation includes real article data at desktop/mobile/intermediate widths, rich-content and missing-image cases, navigation destinations, sharing payload wiring through browser test stubs, failed-request/retry and 404 states, and targeted reading-state/clipboard regression tests. No new raster or font assets and no product claims were added.
