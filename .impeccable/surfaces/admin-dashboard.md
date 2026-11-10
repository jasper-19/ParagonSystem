---
version: 1
slug: "admin-dashboard"
primary_target: "frontend/ParagonWebApp/src/app/features/admin/dashboard/admin-dashboard.html"
related_targets: ["frontend/ParagonWebApp/src/app/features/admin/dashboard/admin-dashboard.scss", "frontend/ParagonWebApp/src/app/features/admin/dashboard/components", "frontend/ParagonWebApp/src/app/features/admin/dashboard/dashboard.facade.ts"]
---

# Admin dashboard

Mode: Operate. Publication staff review content totals, analytics, recruitment submissions, shortcuts, and recent activity. The user requires the existing colors, features, and layout to remain, with design and typography distinct from public pages.

Keep the existing sidebar/header, section order, paired desktop article/issue summaries, status grids, full-width chart, application table/mobile rows, four desktop shortcuts, mobile action dock, activity filters, page-size selector, and pagination. This refinement applies to the dashboard and its six sections; it does not restyle unrelated administration routes.

Use Segoe UI with Helvetica Neue/Arial fallbacks throughout, including headings. Fixed 28px page headings, 16px section headings, 13px supporting labels, and 28px tabular numbers provide a compact staff-workspace hierarchy. Public serif display typography does not apply here. Navy and gold remain primary; existing green, blue, amber, red, and purple retain limited status/category roles. Preserve blue/pink chart series.

White section surfaces use thin neutral borders, 6px corners, and no shadows. Statistics use rules and spacing rather than nested cards or gradients. Analytics periods use one segmented control. Application labels use quiet outlines, statuses have readable semantic fills, and long names wrap. Activity filters use a gold current underline; the feed uses ruled rows and small category indicators. Existing breakpoint structure is retained.

Request failures show an inline retry message. Failed refreshes preserve prior data. Catch errors inside the request stream so subsequent range selections and retries continue working; cancellation must not clear a newer request's loading state. Empty chart periods have an explicit message. Mobile application statuses use the same readable labels as desktop.

Verification: production build passed (existing quill-delta/page-flip CommonJS warnings). Three focused tests cover initial error/retry, retaining data after an error and selecting another range, and request cancellation/loading state. Browser fixtures verified 320, 390, 768, 1024, and 1440px without horizontal overflow, all range requests, activity filters, pagination/page size, empty data, and failed refresh/retry. Rendered desktop and mobile sections were visually inspected. Browser checks intercepted API responses; no authentication or publication records were changed, and real backend/database connectivity was not part of this visual pass.
