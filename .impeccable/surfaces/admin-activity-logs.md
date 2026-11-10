---
version: 1
slug: "admin-activity-logs"
primary_target: "frontend/ParagonWebApp/src/app/features/admin/activity-logs/activity-logs.html"
related_targets: ["frontend/ParagonWebApp/src/app/features/admin/activity-logs/components", "frontend/ParagonWebApp/src/app/shared/components/activity-log-details-modal"]
---

# Admin Activity Logs

Mode: Operate. Administrators inspect audit activity using module/action/date/search filters, pagination and record details. Preserve debounced search, reset, native filter controls, loading/error/empty states, page sizes/ranges, keyboard search/page shortcuts, actor/system fallbacks, action colors and all description/date/IP/context/metadata fields.

Match the modern admin workspace with Segoe UI/Helvetica Neue/Arial, 28px desktop and 25px phone title, compact filter controls, light table headers, restrained rules/corners and flat mobile records. Navy #000035 and honey #F4B400 remain with semantic action colors. The details dialog uses a solid navy header, clear Activity Details heading, retained actor identity, readable ruled sections and safely rendered structured metadata. Preserve scroll lock, focus trap/return, Escape, backdrop and close actions.

No API, schema, store, service or authorization changes. The slash search shortcut is blocked while details are open so it cannot steal modal focus; the page-size label now has a matching select id. Log values and JSON remain escaped text. Verification uses synthetic audit records and intercepts API requests; no live audit data or mutation operations are needed.

Validation: 12 focused tests passed across store, filter, workspace keyboard and detail-modal specs. Coverage includes trimmed/debounced filters and stale-search reset, loading guards, paging/ranges, selected-record reconciliation on refresh, retry, search/page shortcuts, modal keyboard isolation/focus/scroll restoration and escaped metadata. One filter test needed Angular stabilization before its disabled-state assertion; its three-test targeted rerun passed. Final production build passed with existing Quill-delta/page-flip CommonJS warnings. Independent code and security reviews found no introduced actionable issues.

Synthetic browser checks passed at 320, 390, 768, 1024, 1280 and 1440px. Dialog checks passed at 1440x1000, 390x844, 320x844 and 844x390, including long actor names, structured/HTML-like metadata displayed as text, header/footer bounds and slash/Escape behavior. Checked module/action/date/search/reset, empty results, next page/page size reset, keyboard pagination/search, loading/error retry, and mobile records/pagination. No page overflow, runtime exceptions or API mutations occurred. Local fixtures supplied all audit records; live authorization and audit data were not exercised.
