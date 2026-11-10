---
version: 1
slug: "admin-applications"
primary_target: "frontend/ParagonWebApp/src/app/features/admin/editorial-board/applications/applications.html"
related_targets: ["frontend/ParagonWebApp/src/app/features/admin/editorial-board/applications/applications.scss", "frontend/ParagonWebApp/src/app/shared/components/application-review-modal"]
---

# Admin applications

Mode: Operate. Publication staff manage recruitment settings and review editorial applications. Preserve the existing section order: page heading/export, application window and announcement, search/status filters, upcoming interviews, desktop table/mobile applicant cards and pagination. Review remains a centered desktop dialog and mobile sheet with applicant facts, requested positions/categories, motivation, workflow stages, scheduling, notes and decision actions.

Match the modern admin workspace: Segoe UI/Helvetica Neue/Arial; 28px desktop and 25px mobile page title; compact readable labels and table text; thin neutral rules; 4–6px corners; navy #000035 and honey #F4B400 with existing semantic status colors. Prefer quiet flat sections over gradients, pill-heavy badges, nested elevated cards and decorative icon tiles. Keep each existing control/action discoverable.

Preserve service contracts, status transitions, pending-action guards, notes readonly states/limits, confirmations, focus/scroll restoration and keyboard navigation. No portfolio/assignment controls are added where the current dialog does not render them. Applicant values remain escaped text. Browser fixtures use synthetic applicants only and cancel destructive/recruitment-window confirmations.

Two narrow correctness fixes accompany the touched controls: announcement edits call the existing dirty-tracking handler so live settings cannot overwrite an unsaved draft; exported CSV rows contain six values matching the six existing headers. No API/schema or permission changes.

Browser verification also exposed retained search/status filters after clearing the controls. ApplicationService.refresh now distinguishes omitted filters (retain them for realtime refresh) from explicitly supplied undefined (clear them). Query keys, endpoints, authorization and recruitment transitions remain unchanged. The pre-existing queued refresh behavior for page/limit requests remains outside this pass.

Verification: final production build passed with existing Quill/page-flip CommonJS warnings. Eight focused tests passed across Applications and the actual ApplicationService, including HTTP filter clearing/retention/queued clearing, filter/paging controls, duplicate-action guards, announcement draft protection, intake/deletion cancellation and CSV field alignment/escaping. Synthetic browser checks passed at 320, 390, 768, 1024, 1280 and 1440px, plus review dialog checks at 844×390 landscape. Checked all five review statuses, modal scroll locking/Escape, keyboard opening, search/clear, all status filters/All reset, pagination/page size, cancelled confirmations, dirty announcement state and empty results. Final narrow-screen card checks confirmed full header width and stacked status labels. No horizontal overflow, runtime exceptions or applicant API mutations occurred. Code and security reviews found no introduced issues. Live recruitment decisions, emails and backend authorization were not exercised.
