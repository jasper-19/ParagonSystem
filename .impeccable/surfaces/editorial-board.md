---
version: 1
slug: "editorial-board"
primary_target: "frontend/ParagonWebApp/src/app/features/editorial-board/editorial-board.html"
related_targets: ["frontend/ParagonWebApp/src/app/features/editorial-board/editorial-board.scss", "frontend/ParagonWebApp/src/app/features/editorial-board/editorial-board.ts"]
---

# Public editorial board

Mode: Read. Help campus readers identify the publication's staff and advisers. Preserve the public board data, canonical team and role order, academic year, member and team counts, images and initials, year levels, faculty guidance copy, mission, section anchors, loading/empty/error/retry states, and realtime refresh behavior. Keep the navy, gold, white, and pale adviser surface.

Use a compact navy header with the publication's serif title, readable description, plain academic-year label and inline counts. The existing publication montage fills the header background at low opacity over navy on desktop and mobile, as requested by the user. Keep text above the image with strong contrast. The directory uses ruled team groups, left-aligned serif names, small neutral initials or available portraits, and sans-serif roles and year levels. Names and roles wrap fully. Desktop pairs member entries beside the team heading; phones use a single column. Avoid oversized avatar tiles, glass panels, decorative badges and eyebrows, gradients, and floating cards.

Faculty guidance uses a flat pale section, with adviser and co-adviser rendered independently. A co-adviser remains visible when the adviser is absent. Failed member/adviser images fall back to initials without hiding staff details. Request failures have a quiet retry surface. Failed background refreshes retain the visible directory.

Verified against the real 45-member, six-team board at 320, 390, 768, 1024, and 1440px. Browser-only fixtures covered long names/roles/team headings, missing portraits, empty sections, co-adviser-only boards, failed background refreshes, failed initial requests/retry, and an unpublished board. Three targeted regression tests and the production build passed. No saved board data, administration pages, new imagery, fonts, or factual claims were changed.
