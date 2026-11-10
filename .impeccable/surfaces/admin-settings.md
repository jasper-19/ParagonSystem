---
version: 1
slug: "admin-settings"
primary_target: "frontend/ParagonWebApp/src/app/features/admin/settings/settings.html"
related_targets: ["frontend/ParagonWebApp/src/app/features/admin/settings/settings.scss", "frontend/ParagonWebApp/src/app/features/admin/settings/tabs"]
---

# Admin Settings

Mode: Operate. Administrators configure General, Publishing & Media, Notifications, Maintenance and User Accounts. Preserve routed tabs with keyboard navigation, version/update metadata, section forms and native controls, save/error feedback, dirty drafts and external-version conflict recovery, maintenance-impact confirmation, account search/access confirmations, eligible staff and account creation.

Use the modern admin workspace's Segoe UI/Helvetica Neue/Arial typography, 28px desktop and 25px mobile title, restrained rules, compact controls and modest corners. Navy #000035 and honey #F4B400 remain, with established semantic warning/error/success colors. Flatten repeated framed panels and nested cards, remove decorative gradients and redundant eyebrows, align fields and actions consistently and retain readable mobile layouts.

No API, schema, backend, service contract or permission changes. Preserve all pending/invalid/conflict guards, MIME and size constraints, safe logo URL validation, maintenance confirmation and password handling. Browser fixtures intercept all API calls and use synthetic settings/accounts only; real settings/account operations are outside this pass.

The administrator dialog now locks background scrolling, restores prior overflow and opener focus on close/destroy, and uses accurate Generate and Show/Hide password labels. Its sticky footer remains inside the visible dialog on short landscape screens. Credential submission, clearing and validation behavior remain unchanged.

Validation: 16 focused tests passed across four spec files for route/keyboard tabs, form validation/pending saves, dirty version conflicts/reset, MIME limits, notification flags, maintenance confirmation, account access cancellation/pending state, password handling and modal focus/scroll restoration. Final production build passed with existing Quill-delta/page-flip CommonJS warnings. Independent code and security reviews found no introduced actionable issues. Synthetic browser checks passed at 320, 390, 768, 1024, 1280 and 1440px; all five tabs were inspected at desktop and phone widths. The account dialog passed at 1440x1000, 390x844, 320x844 and 844x390, including explicit footer action visibility checks. Exercised account search/empty results, cancelled access confirmation, Escape dismissal, keyboard tab navigation, mocked general save/409 error, blocked unconfirmed maintenance, account load retry and global load retry/loading. No horizontal overflow or runtime exceptions occurred. Both browser PATCH requests were fulfilled by local synthetic fixtures; no actual settings, maintenance or account changes were made. Live backend authorization and production configuration were not exercised.
