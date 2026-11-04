---
name: CSU-Gonzaga Paragon public reading system
description: Journalism-led home reading surface and shared public navigation.
colors:
  ink: "#000035"
  gold: "#f4b400"
  white: "#ffffff"
  paper: "#f7f6f2"
  muted: "#53536c"
  rule: "#dcdce3"
  inverse-muted: "#c4c4d2"
typography:
  display:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "clamp(2rem, 4.5vw, 4.25rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  headline:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "clamp(1.85rem, 2.8vw, 2.8rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  title:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, "Noto Sans", sans-serif'
    fontSize: "1rem"
    lineHeight: 1.75
  label:
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, "Noto Sans", sans-serif'
    fontSize: "0.75rem"
    fontWeight: 600
rounded:
  square: "0px"
spacing:
  small: "0.5rem"
  base: "1rem"
  medium: "1.5rem"
  large: "2rem"
  gutter: "2.5rem"
  section: "3rem"
components:
  carousel-next:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    width: "44px"
    height: "44px"
  carousel-previous:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    width: "44px"
    height: "44px"
  carousel-control-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
  article-link:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
  section-link:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    height: "44px"
---

# Design System: CSU-Gonzaga Paragon

<!-- impeccable:design-schema 1 -->

## Overview

**Creative North Star: "The Campus Publication"**

Paragon's public home lets journalism establish the hierarchy: a serif masthead, large featured photography, readable story headlines, and compact supporting metadata. Navy and gold carry the existing identity through a white reading surface, a navy popular-stories band, and a pale archive surface.

This records the implemented home reading surface and shared public header/footer only. It does not prescribe the administration workspace, search-dialog internals, recruitment forms, or other unmodified public screens. PRODUCT.md remains the source for the broader reader, contributor, and publication-staff context. The north-star name describes the implemented direction rather than a newly approved brand identity.

**Key Characteristics:**

- Serif story hierarchy with sans-serif navigation and metadata.
- Flat article groups separated by rules and section surfaces.
- Rectangular existing content photography with visible contributor credits.
- Stable featured-story layout with explicit navigation controls.

## Colors

### Primary

- **Publication navy** (`ink`): headlines, reading text, masthead rule, popular-stories surface, and footer.
- **Publication gold** (`gold`): current navigation and pagination indicators, category underlines, next-story control, and inverse-surface focus outlines.

### Neutral

- **White** (`white`): main reading surface and solid sticky header; inverse text on navy.
- **Pale paper** (`paper`): archive background, image fallback surfaces, and quiet hover fills.
- **Muted ink** (`muted`): dates, bylines, excerpts, and image credits on light backgrounds.
- **Quiet rule** (`rule`): story separators and chrome borders.
- **Inverse muted** (`inverse-muted`): supporting copy and links on navy.

**The Contrast Rule.** Use navy focus outlines on light reading surfaces and gold outlines inside the navy popular section and footer.

## Typography

**Display Font:** the existing Georgia serif token, with Times New Roman and serif fallbacks.
**Body Font:** the existing Segoe UI sans-serif token, with Helvetica Neue, Arial, Noto Sans, and sans-serif fallbacks.

Headlines provide the publication character; controls and factual metadata stay compact. These are the existing font tokens, with no new font assets.

### Hierarchy

- **Display:** centered publication masthead; the frontmatter gives its desktop fluid ramp. At 639px and below it uses `clamp(1.6rem, 6.9vw, 2.75rem)`.
- **Headline:** featured-story heading; at 767px and below it uses `clamp(1.75rem, 6vw, 2.5rem)`.
- **Title:** category leads and archive stories; popular-story titles use a smaller serif (1.125rem/1.35), and category headings use a larger serif (1.625rem/1.2).
- **Body:** featured excerpts use the body role with a 42ch measure and a three-line clamp. Mobile allows 65ch. Category excerpts use .875rem/1.75 and a four-line clamp; archive excerpts use .8125rem/1.7.
- **Label:** section links and desktop navigation. Dates and credits use .6875rem; brief story headings use .8125rem/1.45 at weight 600. Numeric ranks, counts, and clocks use tabular numerals.

**The Story Hierarchy Rule.** Use the serif token for primary story headlines and the sans-serif token for navigation, metadata, excerpts, and compact briefs.

## Layout

The home container is centered with a maximum width of 1200px and a viewport width minus 3rem. At 639px and below its width is the viewport minus 2rem. The featured layout divides copy and media into .85fr/1.35fr columns with a 2.5rem gap. All slides overlap in the same grid cell; hidden slides continue to contribute to height, keeping the layout stable across stories. At 767px and below, media precedes copy in one column.

Popular stories and archive stories form two columns on wide screens; categories form three. At 1023px and below, popular and archive lists become one column and categories become two. At 639px and below, categories become one column, archive thumbnails shrink to 5.5rem, and section spacing contracts. Common gaps are 1rem, 1.5rem, 2rem, and 2.5rem; section padding varies with content from 1.5rem to 3.5rem.

The sticky header uses a centered three-column grid and a 72px minimum height. Below 768px it becomes 60px high with a menu button, centered logo, and search button. The clock disappears at 1023px and below; weather appears from 1280px. The footer uses four columns from the existing 768px medium breakpoint; below that, its brand spans two columns above the remaining link groups.

## Elevation & Depth

The documented home and chrome use no box shadows. Depth comes from the white, navy, and pale-paper section surfaces, thin separators, a three-pixel navy masthead rule, and a four-pixel gold footer rule. The header remains solid white while sticky, without blur or transparency.

**The Flat Reading Rule.** Group story lists with rules, spacing, and section backgrounds rather than elevated story containers.

## Shapes

Story photography and controls are rectangular with square corners. Featured media is cropped to 4:3 on desktop and 3:2 below 768px; category lead images use 3:2; popular, brief, and archive thumbnails are square. Images fill their frame with `object-fit: cover`. Existing content images and logo assets are retained; no raster assets were generated for this refinement.

## Components

### Buttons and links

Carousel controls are square 44px targets with thin rule-colored borders. The next control has a gold fill; both controls turn navy with white content on hover. The read-article link uses a small inline arrow that moves 4px horizontally over 180ms on hover. Story titles and section links underline on hover. Light-surface focus outlines are two pixels with a four-pixel offset; header focus uses a three-pixel offset.

### Featured carousel

The active story fades from .65 to full opacity over 240ms ease-out. Hidden slides have `visibility: hidden`, disabled pointer interaction, `aria-hidden`, and links removed from the tab order. Numbered 44px pagination targets mark the current story with a gold underline. Controls appear only for multiple stories. Arrow keys, previous/next buttons, direct pagination, and horizontal pointer swipes of at least 48px retain their behavior.

Autoplay advances every seven seconds, pauses on hover or focus within the feature, and resets after manual navigation. Reduced motion disables autoplay, the arrival animation, and the arrow/control transitions. The carousel remains manually navigable. Existing global reveal CSS is not a prescribed part of this home system; the current home templates do not attach that reveal behavior.

### Story lists and metadata

Popular rows combine a gold serif rank, headline and credits, and a small square image on navy. Category columns pair a large photographic lead with compact ruled briefs. Archive entries pair square photography with headline and excerpt on pale paper. Category metadata represents the article's actual category; its current uppercase gold-underline treatment is an observed content label, not permission to add promotional eyebrows. Byline and photo/graphics/illustration credits remain conditional on actual data.

### Navigation and footer

The desktop navigation marks the current route with a gold bottom border. The conditional mobile menu marks it with a gold background; opening exposes `aria-expanded`, and route selection closes the menu. The logo links home; search continues to open the existing search dialog. Footer links turn gold and underline on hover, while social links use square 44px outlined targets and gold hover fills. Footer focus outlines use gold.

### Empty and missing-content states

An empty home keeps the masthead and presents a centered message and archive link within a minimum 55svh area. Individual sections retain their existing empty messages. Featured images use the shared image-placeholder component when absent. These states do not invent articles or substitute new photography.

## Do's and Don'ts

### Do:

- **Do** retain the existing navy, gold, white, and pale-paper palette.
- **Do** use story scale, photography, and thin rules to establish reading hierarchy.
- **Do** preserve factual article metadata, contributor credits, destinations, and carousel controls.
- **Do** retain visible focus states and reduced-motion behavior when extending these components.

### Don't:

- **Don't** treat this home-scoped record as an administration or whole-product redesign mandate.
- **Don't** replace existing article images, publication facts, or logo assets as decorative styling.
- **Don't** turn observed content labels into newly invented promotional kickers.

Not canonized or repaired: the footer retains existing placeholder `#` destinations and an uppercase publication descriptor. These are inherited content/navigation limitations, not patterns for future screens. Unused global reveal styles are not promoted into the active motion system.

Evidence: `frontend/ParagonWebApp/src/styles.css`; home `home.html`, `publication.css`, component templates, and featured-section SCSS/TypeScript; shared header/footer templates and SCSS; `PRODUCT.md`; and the home surface direction contract under `.impeccable/surfaces/`. This record derives values and behavior from source; browser/build verification is owned by the implementation pass.
