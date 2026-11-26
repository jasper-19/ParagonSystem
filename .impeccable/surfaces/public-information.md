# Public information pages

Mode: Read (Contact Us combines reading with choosing a contact destination).
Routes: /our-story, /ethics-policy, /contact-us, /privacy-policy, /terms-of-service.

## Direction contract

THESIS: Extend the existing campus publication with readable information pages, rather than marketing cards or invented history. Contact channels are real destinations; proposed policy text is visibly draft.

OWN-WORLD: Inherit white/pale paper, navy #000035 and honey #F4B400, Georgia headline hierarchy, system sans body, 1200px container, thin rules, square controls and shared Header/Footer.

STORY: Readers understand the publication, navigate its proposed standards and site guidance, or contact the desk. Staff applicants reach the existing recruitment flow. No unverified dates, addresses, awards, legal guarantees or response-time claims.

FIRST VIEWPORT: Large serif page title and restrained introduction. The site footer links to each separate page. Story adds the existing publication tagline on navy. Policies show draft status above a left contents rail and readable right column. Contact pairs a real contact desk with inquiry subjects.

FORM: seed: none (pinned), "design is the same with the public pages". Code-led extension of the existing reading system; no new visual world or raster assets.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Scope: one shared lazy standalone public reading component, static typed page content, five public routes, footer/SEO/SSR integration. Policy copy pending editorial approval; draft pages excluded from search indexing. No API/schema/auth changes. Preserve incumbent DESIGN.md and design.json; no durable system replacement.

## Verification

2026-11-26: independent finish/code review disposition ship after inspecting 21 captures (five pages at 1440/768/390/320px plus the contact fallback). No material fixes. Independent security review found no actionable issue. Incumbent DESIGN.md/design.json compared and unchanged. No shipping raster assets were added or modified.

Focused Angular tests: 21 passed across four suites; final public-information/footer rerun after copy and assertion changes: 18 passed across two suites. Server tests: 29 passed. Production browser and SSR build passed, with existing CommonJS warnings. Actual local SSR preview served all five routes with 200 and correct draft noindex headers. Browser verified section-link focus/scroll, client navigation, keyboard focus, configured email subjects, missing-email Facebook fallback and no horizontal overflow/runtime exceptions. Settings and email in preview were synthetic; no live data or publication changes.

Graphify AST update completed. Existing SQL-parser dependency warning limits unrelated SQL indexing. Impeccable context and detector engine unavailable because its user cache is not installed/writable; project context and craft-floor checks performed directly and independently reviewed. No deployment, API changes, schema changes, or legal-policy adoption.
