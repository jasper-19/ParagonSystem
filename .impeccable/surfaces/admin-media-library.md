---
version: 1
slug: "admin-media-library"
primary_target: "frontend/ParagonWebApp/src/app/features/admin/media-library/media-library.html"
related_targets: ["frontend/ParagonWebApp/src/app/features/admin/media-library/media-library.scss", "frontend/ParagonWebApp/src/app/features/admin/media-library/components"]
---

# Admin media library

Mode: Operate. Staff search publication images, select one or more files, inspect file details and edit metadata. Preserve the current responsive image grid, 340px desktop inspector, mobile details drawer, selection semantics, keyboard navigation, autosave on blur and explicit save. Keep the main page's existing controls; do not add upload/delete/type controls that the page does not currently render.

Match the modern admin dashboard and article editor: Segoe UI/Helvetica Neue/Arial, 28px desktop page title, 25px phone title, readable compact metadata, fine neutral rules and 4–6px corners. Preserve navy #000035 and honey #F4B400. Let image thumbnails lead; avoid decorative gradients, nested shadows and oversized icon tiles.

Shared media cards, grid, details and uploader also appear in the media picker. Preserve their inputs/outputs, responsive columns, selected state, image/non-image preview, MIME/size restrictions, upload progress and drag/drop, metadata drafts, save acknowledgement and disabled states. Keep HTML/text bindings and service contracts unchanged. Metadata fields need unique instance IDs because desktop and mobile panels can coexist in the DOM.

Expose the existing store's load error with a retry action; avoid presenting failure as an empty library. No API/schema changes or live media mutations are part of visual verification. Use synthetic media and intercepted API requests for browser checks.

Verification: production build passed with existing Quill/page-flip CommonJS warnings; six focused tests passed across the store and details panel. Browser checks passed at 320, 390, 768, 1024, 1280 and 1440px with no horizontal overflow or runtime exceptions. Checked search/clear, multi-selection/clear, keyboard navigation, desktop/mobile details, unique field IDs, Escape dismissal, simulated metadata blur save, empty/loading/error/retry states. Shared article image picker rendered at desktop and phone widths and rejected a synthetic unsupported file without an upload request. Code and security reviews found no introduced issues. Live uploads, deletions and backend permissions were not exercised.

The shared picker already displays editable metadata without a metadataSave listener; persistence there remains outside this visual pass. Main-library metadata persistence was checked with intercepted synthetic responses. Picker browser fixtures must provide a complete publishingMedia settings section; an empty settings object is not a valid API fixture.
