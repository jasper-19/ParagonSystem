---
version: 1
slug: "join-page"
primary_target: "frontend/ParagonWebApp/src/app/features/join/join.html"
related_targets: ["frontend/ParagonWebApp/src/app/features/join/join.scss", "frontend/ParagonWebApp/src/app/features/join/components/hero/join-hero.html", "frontend/ParagonWebApp/src/app/features/join/components/why-join/why-join.html", "frontend/ParagonWebApp/src/app/features/join/components/positions/join-positions.html", "frontend/ParagonWebApp/src/app/features/join/components/application-form/join-application-form.html", "frontend/ParagonWebApp/src/app/features/join/components/faq/join-faq.html", "frontend/ParagonWebApp/src/app/features/join/components/final-cta/join-final-cta.html", "frontend/ParagonWebApp/src/app/shared/components/position-info-modal/position-info-modal.html"]
---

# Join Paragon

Mode: Operate. Let prospective contributors understand the existing roles, review recruitment status, and complete the application. Preserve the publication's navy, gold, white, and pale role-list background, existing copy, recruitment settings, role data, and complete form workflow. Role data remains supplied by the existing mock JoinService; polishing does not establish live role management.

Use the public reading system's Georgia headings and sans-serif controls and metadata. The introduction has a solid navy ground, gold mission text, rectangular primary action, and a ruled benefits overview. Benefits, roles, and FAQs use flat groups separated by thin rules. Avoid gradient and blur ornaments, decorative numbering, badges, floating panels, and redundant role-detail controls. Available role details remain in a focused, scrollable navy-header dialog.

The white application surface has visible fieldset legends, clear required labels and inline errors, rectangular inputs, and a quiet checklist sidebar that follows the form on phones. Keep dependent college/program selection, route-based role preselection, multiple role and specialization choices, motivation minimum and count, confirmation, submission feedback, and the existing payload. Confirm and feedback dialogs retain focus, restore it after closing, support Escape, and lock background scrolling. The closed-recruitment notice is a flat status section; failed settings requests have a separate retry state.

Changing colleges clears a program unavailable in the new college. Failed college requests can retry without losing form data. Unknown role links cannot create hidden selections. Duplicate confirmation cannot issue a second pending submission. Failed submissions retain entered values; successful submissions reset the form. Existing server handling for recruitment closing during submission remains.

Verified at 320, 390, 768, 1024, and 1440px. Browser checks cover role details, preselection, validation focus, dependent programs, multiple roles, confirmation and Escape/focus containment, failed and successful submissions, FAQs, closed recruitment, and settings/college retry. Application POST responses were intercepted in the browser; no real applications were submitted. Four targeted form regression tests and the production build passed. No new imagery, fonts, or factual claims.
