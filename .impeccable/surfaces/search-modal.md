---
version: 1
slug: "search-modal"
primary_target: "frontend/ParagonWebApp/src/app/shared/components/search-modal/search-modal.html"
related_targets: ["frontend/ParagonWebApp/src/app/shared/components/search-modal/search-modal.scss", "frontend/ParagonWebApp/src/app/shared/components/search-modal/search-modal.ts"]
---

# Public search modal

Mode: Operate. Help campus readers find and open publication articles while preserving the navy, gold, and white palette and existing search fields, category browsing, recent stories, metadata, result counts, and navigation.

Use a flat rectangular dialog with a solid navy header, serif title, white search field, and a thin gold rule. On desktop, compact category buttons sit beside ruled article rows. On phones, categories wrap into touch targets above the stories inside a full-height dialog. Story titles use the publication's serif; controls, excerpts, and contributor metadata use the existing sans-serif. Show available thumbnails and let articles without images use the full row width. Avoid duplicate category navigation, decorative category icons, floating cards, and blurred color ornaments.

Preserve input autofocus, focus containment and restoration, Escape, backdrop dismissal, clearing, category selection, live publication refresh, and article navigation. Distinguish failed requests from empty searches and offer retry for search and browse failures. Clear stale responses when interaction changes and allow repeating a query after clearing it before the debounce expires.

Verified with real data at 320, 390, 768, and 1440px, browser keyboard and recovery checks, four targeted request-ordering/recovery tests, and a production build. No new imagery, fonts, or publication claims.
