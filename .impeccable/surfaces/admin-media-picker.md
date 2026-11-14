# Admin media picker modal

Mode: Operate. Navy #000035, honey #F4B400, Segoe UI / Helvetica Neue / Arial. Match the compact admin screens, with flat panels, quiet borders, 44px controls, no decorative gradients, and a navy selection action.

The shared picker has a labelled search/upload toolbar, image grid, desktop 300px details panel, mobile expandable selected-image details, and persistent selection/action footer. Full image preview uses contain. File facts, alt text and caption remain visible. Metadata is read-only here because this picker never bound a metadataSave handler; editing stays in the main media library. Existing picker upload/drag/drop callbacks, single selection, cancel, confirm, search debounce and keyboard navigation remain.

Initial, manual, upload-triggered and debounced search reloads share switchMap to cancel stale HTTP responses. Load failures have a retry state instead of appearing as an empty library. No API/schema/auth/storage changes. Existing 50-image request limit remains.

Scope: shared/components/media-picker-modal template, TypeScript, new SCSS and focused spec. Earlier cover layout changes remain separate. QA agent supplied tests and review agent identified baseline issues, but agent usage limits interrupted final independent review/security review. Root completed implementation and integration review.

Validation: 14 tests passed across picker behavior, media details and create special issue suites. Local browser checks passed at 1440/1024/768/390/320 widths in both selection states, no horizontal overflow, real selection reached the editor and scroll restored. Final desktop/mobile screenshots inspected; fresh browser run had zero runtime errors. Scoped diff whitespace checks passed. Browser used isolated synthetic API data; no production uploads or mutations.

Production frontend build passed. Existing quill-delta/page-flip CommonJS warnings remain. No deployment performed.
