---
version: 1
slug: "admin-articles"
primary_target: "frontend/ParagonWebApp/src/app/features/admin/content-management/articles/all-articles/all-articles.html"
related_targets: ["frontend/ParagonWebApp/src/app/features/admin/content-management/articles/all-articles/all-articles.scss", "frontend/ParagonWebApp/src/app/features/admin/content-management/articles/all-articles/all-articles.ts", "frontend/ParagonWebApp/src/app/shared/components/article-view-modal"]
---

# Administration articles

Mode: Operate. Staff find, inspect, edit, archive, and delete articles. The user requires a modern dashboard-aligned design while preserving colors, features, and layout. The separate article creation/editing surface is outside this refinement.

Use the dashboard's Segoe UI/Helvetica Neue/Arial hierarchy: a fixed 28px page heading, compact 13–14px controls and table text, thin neutral rules, navy primary controls, gold featured emphasis, and existing green/blue/neutral statuses. Avoid public serif display typography, gradient table headers, oversized uppercase badges, decorative icons, and nested elevated cards.

Preserve the heading and New Article link; search, sort, and status toolbar; desktop six-column table at the existing large breakpoint; mobile entries with category, status, feature, views, and created/published dates; page-size/range summary; and responsive pagination. Long titles wrap or retain their available title attributes. Desktop table overflow stays local to its scroll container.

The details dialog retains the desktop centered max-width and phone sheet layout. Preserve its overview, article information, tags, all four credit groups, status, featured state, views, dates, scrollable content, focus containment/restoration, and dismissal controls. Loading and errors need valid accessible titles and a visible close control. Cancel a pending detail request when the dialog is dismissed so it cannot reopen on a late response. Keyboard events from Edit/Archive/Delete controls must not activate their parent preview row.

Archive/delete confirmation wording, status restrictions, route destinations, service contracts, and publication data remain unchanged. Browser checks use synthetic responses and cancel confirmations; no live article mutations are authorized by this visual pass.

Verification: production build passed with existing quill-delta/page-flip CommonJS warnings. Independent code review found no actionable issues. Two focused spec files contain seven passing tests for search/sort/pagination/page size/status URL, retry, preview cancellation/stale responses, action-key isolation, modal accessible names, focus restoration, and metadata/credits. Browser fixtures verified all status tabs, search, sort, pagination, page size, keyboard isolation, both cancelled confirmations, all four credit groups, focus/scroll restoration, pending dismissal, detail failure, list failure/retry, and empty results. Layout checks passed at 320, 390, 768, 1024, and 1440px plus 844×390. Additional long-title/empty-metadata dialog checks at 320×844 and 844×390 confirmed scrollable content and visible, clickable close controls. No runtime exceptions, horizontal overflow, or article mutations occurred.

The existing port-4200 development server served an old cached dialog during verification. A fresh Angular preview on port 4201 compiled the current source and was used for the final browser checks. Restart the original dev server if it continues to show old dialog styling. All API responses were synthetic; real backend/data connectivity was not verified or changed.
