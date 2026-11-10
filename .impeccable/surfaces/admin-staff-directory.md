---
version: 1
slug: "admin-staff-directory"
primary_target: "frontend/ParagonWebApp/src/app/features/admin/editorial-board/staff-directory/staff-directory.html"
related_targets: ["frontend/ParagonWebApp/src/app/features/admin/editorial-board/staff-directory/staff-directory.scss", "frontend/ParagonWebApp/src/app/features/admin/editorial-board/staff-directory/_staff-directory-dialogs.scss", "frontend/ParagonWebApp/src/app/shared/components/view-member-info-modal"]
---

# Admin Staff Directory

Mode: Operate. Preserve board switching/creation/deletion, accepted applicants awaiting adviser assignment, eligible staff, satisfaction toggle, section carousel and member assignment actions. Use a quiet operational workspace distinct from the public publication typography: Segoe UI/Helvetica Neue/Arial, 28px desktop and 25px mobile title, readable compact labels, thin neutral rules, modest corners, navy #000035 and honey #F4B400 with existing semantic colors.

Board choices sit beneath an open section heading. Tables use light headers and clear row rules; mobile records stack identity, year, positions and full-width actions. The current board uses compact member columns instead of stretching a single member across the page. Retain carousel navigation, swipe and keyboard controls. Inline creation, assignment, editing and revocation dialogs and the shared member-info dialog use flat form sections, solid navy headers, responsive scroll areas and visible focus states.

Preserve all validation, eligibility limits, permission checks, pending guards and API contracts. Four success handlers now clear their pending flags before invoking guarded close methods, so successful edits, assignments and revocations close the dialog as intended. Initialization explicitly clears inherited Applications search when requesting accepted applicants. No API, schema, backend or permission changes.

Validation: production build passed with existing Quill-delta/page-flip CommonJS warnings. Eleven focused tests passed across the directory and member-info component, covering assignment limits/validation, pending/error guards, successful dialog closure, search reset, focus/Escape and scroll restoration. Independent code and security reviews found no introduced actionable issues. Synthetic browser checks passed at 320, 390, 768, 1024, 1280 and 1440px, plus dialog checks at 844x390 landscape. Checked carousel arrows/Home/End, all touched dialogs, dropdowns, cancelled confirmations, error/retry and no-board state. No horizontal overflow, runtime errors or API mutations occurred. Build preview used intercepted synthetic staff records only; live assignments and backend authorization were not exercised.

Existing optional-input caveat: the shared member-info dialog's showEditAction condition controls the Close footer rather than Edit Assignment. The directory uses the default true value; this pre-existing mismatch remains outside this visual pass.
