---
version: 1
slug: "admin-chrome"
primary_target: "frontend/ParagonWebApp/src/app/core/layout/sidebar/sidebar.html"
related_targets: ["frontend/ParagonWebApp/src/app/core/layout/sidebar/sidebar.scss", "frontend/ParagonWebApp/src/app/core/layout/sidebar/sidebar.ts", "frontend/ParagonWebApp/src/app/features/admin/layout/admin-header/admin-header.html", "frontend/ParagonWebApp/src/app/features/admin/layout/admin-header/admin-header.scss", "frontend/ParagonWebApp/src/app/features/admin/layout/admin-header/admin-header.ts"]
---

# Administration header and sidebar

Mode: Operate. Staff navigate publication workflows and review notifications. The user requires a modern admin treatment distinct from public pages, preserving colors, layout, navigation features, all sidebar icons, and functionality.

Keep navy #000035, gold #F4B400, the white 64px header, 288px expanded sidebar, 80px desktop rail, and the mobile drawer. Preserve every route, navigation group, accordion, static SVG icon path, tooltip, collapse/expand control, profile link, logout confirmation, minute-aligned clock, identity binding, notification count, live notifications, mark-all-read action, outside dismissal, and keyboard behavior. API, schemas, authentication, and services are outside this visual pass.

Use Segoe UI/Helvetica Neue/Arial throughout; compact 13px navigation, 16px brand, 14–15px header title, and restrained weights distinguish staff chrome from the public serif headlines. Align icons in consistent 18px frames (16px child icons), retain the original artwork, use 4–6px corners and thin separators. Sidebar selection uses a quiet gold-tinted navy fill and gold foreground, with no thick accent border. Neutral inverse navigation and light hover fills keep expanded groups legible. The clock is inline date/time; the account block uses a solid navy avatar and a simple separator, with long usernames truncated and available in a title attribute.

Notifications use a restrained white panel, readable messages and timestamps, scrollable content, and an accessible footer. Raise the header only while its notification panel exists, so the panel clears the dashboard mobile action dock without covering ordinary page dialogs. Parent-main filtering continues to contain the header below the open mobile drawer/backdrop.

The submenu parent data attribute is corrected so Escape closes the submenu and restores parent focus. Closed mobile navigation uses visibility:hidden to prevent offscreen keyboard focus; the desktop icon rail remains visible. Other navigation state, service calls, and static SVG definitions remain unchanged.

Existing limitations retained: the open mobile drawer does not trap focus; the notification service silently handles mark-read failures. No live data or auth changes are made as part of this refinement.

Verification: production build passed with existing quill-delta/page-flip CommonJS warnings. Independent code review completed with findings resolved. Independent QA reviewed the final source and coordinator browser report and found no blocking regressions; QA did not run a separate browser or unit-test suite. Browser fixtures checked every group and child route/icon, 288/80px states, collapsed tooltips and submenus, Escape focus restoration, notification focus/outside dismissal, long notification text, mark-all-read and empty states, and logout confirmation/cancellation. Layout and notification footer hit-tests passed at 320, 390, 768, 1024, and 1440px plus 844×390 landscape. Additional browser hit-testing confirmed the header changes from its normal layer 50 to 80 only while notifications are open, returns to 50 afterward, and remains below the open mobile drawer. No runtime exceptions or horizontal overflow occurred. All API requests were intercepted with synthetic preview responses; backend connectivity and real records were not exercised.
