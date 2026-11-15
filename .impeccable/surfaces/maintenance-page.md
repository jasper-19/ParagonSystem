# Public scheduled maintenance

Refine the existing public maintenance surface in code. Preserve navy #000035, honey #F4B400, configured logo/publication/organization/message and existing public-route gate with admin bypass. No API/schema/routing changes.

Direction: a quiet publication notice, left-aligned masthead and oversized Georgia headline, fine rules, honey status label, readable bounded message and understated footer. Responsive spacing, intrinsic document scrolling on short screens, safe wrapping for long configured text and preserved message line breaks. No extra images, animation or invented completion time.

Implementation: app.html and component-scoped app.css only. App tests cover branding, fallback logo, live disable and admin/public navigation. Independent code review found no actionable issues. Six App tests passed. Production build passed with existing quill-delta/page-flip CommonJS warnings. Local production browser preview with intercepted synthetic settings passed at 1440x1000, 768x1024, 390x844, 320x568 and 320x400; logo loads, brand colors match, no horizontal overflow or runtime exceptions, and long publication/message content fits. Desktop/mobile screenshots visually inspected. No production settings were changed or deployment performed.
