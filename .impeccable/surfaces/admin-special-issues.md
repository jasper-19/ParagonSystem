# Admin special issues

Mode: Operate. Preserve navy #000035 and honey #F4B400, existing publication workflows, and the established admin shell.

The library uses compact Segoe UI/Helvetica/Arial typography, a flat sortable table, status counts, labelled search, direct pagination, and mobile publication cards. The editor groups issue details and publication files beside publication settings; mobile displays details first. Controls preserve PDF validation, upload progress, cover selection, confirmations, and edit/archive/delete behavior. The details dialog uses bounded scrolling, keyboard focus containment, Escape dismissal, and trigger focus restoration.

Realtime contract: special-issues:updated has no payload and is emitted only after a successful persisted mutation. Public readers refresh through the published-only API. Draft and archived content remains private. Initial connection and reconnect resynchronize; switchMap cancels stale requests, and subscriptions are removed on destruction. Live updates preserve active filters and avoid a full-page loader.

Validation: focused frontend suite (25 tests across 6 files), backend realtime suite (2 tests), backend TypeScript build. Browser verification uses synthetic local API storage with the actual backend Socket.IO emitter, including published multipart upload, draft privacy, reconnect, filters/pagination, cover selection, edit loading, retry and responsive widths 320–1440. No production data or deployment changes. Review and security agents reviewed supplied code excerpts; they could not independently access the filesystem in this session.

Final result: frontend production build passed (existing quill-delta/page-flip CommonJS warnings). Browser report admin-issues-report.json passed all checks with zero runtime errors. Both list and editor fit all five tested viewport widths. Scoped git diff --check passed. No API/schema migration or deployment required; frontend and backend changes must ship together for realtime updates.

Cover layout refinement: selector fills the Publication files panel; selected covers use a bounded 288–416px contain preview without cropping. Only create/edit template and scoped shared admin stylesheet changed. Production build and diff whitespace checks passed. Browser verification could not complete because the local browser navigation timed out during heavy machine load.
