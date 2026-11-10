---
version: 1
slug: "admin-board-preview"
primary_target: "frontend/ParagonWebApp/src/app/features/admin/editorial-board/public-board-preview/public-board-preview.html"
related_targets: ["frontend/ParagonWebApp/src/app/features/admin/editorial-board/public-board-preview/public-board-preview.scss", "frontend/ParagonWebApp/src/app/features/admin/editorial-board/public-board-preview/public-board-preview.ts"]
---

# Admin editorial board preview

Mode: Operate. Staff inspect the active board, its sections, members, roles and faculty advisers before opening the public board page. Keep the public-page link, board academic year/status, unique member and section counts, year labels, adviser and optional co-adviser. Preserve loading, error/retry, no active board with directory navigation/refresh, no sections and empty section guidance.

Match the admin workspace with Segoe UI/Helvetica Neue/Arial, 28px desktop and 25px phone title, readable labels, flat sections and restrained rules. Keep navy #000035, honey #F4B400 and established semantic colors. Remove decorative gradients, repeated elevated containers and oversized hero/metric treatments. The public reading page remains independently styled.

No API, schema, permissions or backend changes. Staff names remain escaped text; public navigation retains its safe new-tab attributes. The two recovery links now use the actual /admin/staff-directory route. Browser verification uses synthetic member records and intercepts API requests; no live board changes are authorized.

Validation: eight focused component tests passed for unique members (including dual roles and legacy names), loading, error/retry, no active board, no sections, empty section guidance, optional co-adviser and protected public navigation. Final production build passed with existing Quill-delta/page-flip CommonJS warnings. Independent code and security reviews found no introduced actionable issues. Synthetic browser checks passed at 320, 390, 768, 1024, 1280 and 1440px; checked member/adviser wrapping, safe public link, error/retry, loading, no sections, single member/optional co-adviser, and no-board refresh/recovery route. No horizontal overflow, runtime errors or API mutations occurred. Backend authorization and live publication behavior were not exercised.
