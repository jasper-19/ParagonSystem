# Confirmation and feedback dialogs

Mode: Operate. Reference: user-provided success and destructive confirmation image (2026-11-14).

Use a centered white 440px panel, 16px corners, muted navy backdrop, compact tinted status icon, centered sans title/message, outlined 44px close, and vertically stacked full-width actions. Routine confirmation stays navy; destructive action uses accessible red; success uses a green icon and outlined dismiss. Preserve existing labels and decision callbacks.

Shared confirmation, success and error components use action-dialog.scss. ActionDialog directive owns rendered-dialog focus, Escape, focus restoration and per-document scroll locking; safe Cancel receives initial confirmation focus. Its stack applies only to ActionDialog participants. Public Join feedback and staff Revoke Acceptance retain their established state/focus/busy handlers with matching styling. No API, schema or production changes.

Validation: 24 tests passed in four focused suites (shared dialog/service contracts, staff directory, Join application, create special issue). Development compilation passed. Local isolated browser checks passed default/danger confirmations at 1440/390/320 widths, Escape/scroll cleanup, and public Join success at 1440/320; zero runtime errors. Independent read-only code review found no functional blockers. Screenshots and report live under .impeccable/review (ignored).

Final production frontend build passed. Existing quill-delta/page-flip CommonJS warnings remain. Scoped diff whitespace checks passed. No deployment performed.
