---
version: 1
slug: "admin-article-editor"
primary_target: "frontend/ParagonWebApp/src/app/features/admin/content-management/articles/create-article/create-article.html"
related_targets: ["frontend/ParagonWebApp/src/app/features/admin/content-management/articles/create-article/create-article.scss", "frontend/ParagonWebApp/src/app/features/admin/content-management/articles/create-article/create-article.ts"]
---

# Article editor

Mode: Operate. Publication staff create and update articles in the shared editor. Keep the existing desktop two-column content/metadata arrangement, mobile stacking and mobile actions with sidebar offsets. Publish settings scroll with their column so they cannot cover the image, tags and credits below.

Match the admin dashboard and article list: Segoe UI/Helvetica Neue/Arial, 28px page title, compact labels, fine neutral rules, 4–6px corners and restrained surfaces. Navy #000035 and honey #F4B400 remain the brand anchors. Public display typography does not carry into this workspace.

Preserve title/slug generation and validation, excerpt, Quill tools, autosave/restoration, status and featured controls, organization policy messages, featured image upload/library/drag/replace/remove, categories, suggested tags and limits, all four editorial credits with keyboard suggestions, save/cancel, confirmations, loading and errors. Preview remains disabled until its feature exists. Styling of shared children is scoped to this instance; no API or schema changes.

Verification: production build passed with existing Quill/page-flip CommonJS warnings. Synthetic browser checks at 320, 390, 768, 1024 and 1440px found no horizontal overflow or runtime exceptions. Confirmed admin font family, responsive heading sizes, seven Quill toolbar buttons, invalid-form disabled saves, title-to-slug generation, autosave status, Published action label and all four credit comboboxes. No API mutations occurred. Security review found no introduced risks. Independent QA/code review was unavailable due agent usage limits; real uploads, live saves and edit-mode data loading were not exercised.
