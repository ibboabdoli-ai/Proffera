# Proffera Design System

Status: approved homepage direction for PR #877. This document is the visual and UX source of truth for marketplace-facing work unless a later approved design decision explicitly replaces it.

## Product identity

Proffera is a Swedish local-services marketplace. The interface should feel trustworthy, practical, clear, local, and human-designed.

It should not look like a generic AI/SaaS template, a crypto product, or an Apple clone.

## Core principles

1. Search and provider discovery come first.
2. Real company information is more important than decorative UI.
3. Typography, spacing, alignment, and imagery create hierarchy before cards, shadows, badges, or gradients.
4. Company claims, ratings, verification labels, photos, and logos must be source-grounded.
5. Mobile is a first-class layout, not a scaled desktop page.
6. Motion communicates hierarchy and state; it is never decorative noise.

## Marketplace palette

- Marketplace navy: `#0A2E63`
- Marketplace blue: `#1469D8`
- Primary ink: `#11213B`
- Muted text: `#617085`
- Border: `#DCE4EE`
- Soft surface: `#F6F9FD`
- Verified/success green: `#17A672`
- Main surface: white

Use navy/blue for navigation, headings, links, and primary marketplace CTAs.
Use green only for verified/success/trust semantics.
Do not introduce decorative purple/pink gradients, neon accents, or arbitrary category colors.

## Typography

Prefer the existing Proffera/system typography stack unless an approved product-wide font migration is made.

Hierarchy:
- Hero/H1: heavy, compact tracking, readable line breaks
- H2: strong navy heading
- H3: compact product/card heading
- Body: neutral, readable, moderate line height
- Metadata: smaller but never low-contrast
- Buttons/labels: concise and high-confidence

Do not use oversized marketing copy or generic startup slogans.

## Spacing, radius, and shadows

Use a restrained radius scale:
- controls: approximately 8–10px
- cards/panels: approximately 12–16px
- pills: only for true badges/tags

Prefer borders and spacing before shadows.
Shadows should remain subtle and should not make every surface appear floating.

## Header

Marketplace header:
- official Proffera SVG
- Hitta företag / Find businesses
- Populära tjänster / Popular services
- Så fungerar det / How it works
- Om oss / About us
- language control
- Logga in / Log in
- För företag / For businesses as the primary CTA

Marketplace navigation uses navy/blue. Preserve safe-area behavior on mobile.

## Hero

The hero must communicate the core task immediately:
- `Vad behöver du hjälp med?`
- canonical supporting copy
- existing service/location search behavior
- Near me
- short factual trust points

Desktop may use real editorial service photography. Search remains the dominant interaction.
Avoid abstract geometric filler, decorative handwritten copy, large floating ornamentation, and fake statistics.

Editorial hero photography must be replaced/self-hosted with Proffera-owned or appropriately licensed media before Production merge.

## Search

Preserve existing Directory search semantics, location logic, Near me behavior, analytics, and bilingual behavior.

Desktop:
- service input
- location input
- primary search CTA
- Near me action

Mobile:
- controls stack vertically
- no clipped labels
- touch targets at least 44px
- permission/status messages remain readable

## Popular services

Use a compact horizontal service rail rather than a grid of equal feature cards.

Rules:
- one consistent icon library
- SVG icons, no emoji
- 48px neutral icon container
- approximately 21–22px icon
- navy icon by default
- light blue hover/focus state
- approximately 160–180ms hover motion
- desktop: compact horizontal distribution
- mobile: horizontal overflow with scroll snap

Never create unsupported service claims merely to match a mockup. A shortcut must either map to a valid Directory service/category or route transparently to the general directory.

## Company cards

Company cards are the strongest proof that Proffera is a real marketplace.

Preferred information order:
1. real company/profile photo when available
2. verified-details badge when the claim is supported
3. official company logo or deterministic fallback
4. company name
5. real reputation data only when present
6. location
7. relevant service tags
8. profile CTA

Do not fabricate companies, reviews, ratings, locations, logos, or service availability.

## Logo resolution

Priority:
1. company-uploaded official logo
2. verified official-domain logo
3. approved logo-provider result
4. official-site favicon
5. deterministic Proffera monogram fallback

Wrong logo is worse than no logo.

All logos render inside a normalized contain frame; never crop them with `object-fit: cover`.

Future logo enrichment should retain source, confidence, verification, and checked/updated timestamps.

## Company photos

Priority:
1. company-uploaded media
2. verified media from the official company website
3. approved external business-media integration
4. clearly marked Proffera category illustration/fallback

Do not present generic or generated imagery as though it belongs to a specific company.
Illustrations must be labeled when there is a meaningful risk of confusion.

## Verification language

`Verifierad` / `Verifierade uppgifter` refers to supported company-data verification.

It must not imply:
- Proffera guarantees workmanship
- the business is endorsed by Proffera
- customer satisfaction has been independently certified

Use more explicit explanatory copy/tooltips if the context could be ambiguous.

## Reviews and Google

Proffera reviews and Google ratings/reviews are separate data sources.

Proffera:
- display only real verified Proffera review data already supported by the product

Google:
- do not scrape
- do not fabricate
- do not relabel Proffera ratings as Google
- until an approved Places integration exists, a neutral Google Maps search link is acceptable
- when Google Places is integrated, follow Google attribution, caching, matching, and billing requirements

## How it works

Keep the three-step structure:
1. Sök / Search
2. Jämför / Compare
3. Välj / Choose

Prefer numbers, typography, alignment, subtle dividers, and restrained icons over three large feature cards.

## For businesses CTA

The business CTA should feel connected to the same marketplace brand.

Prefer:
- real Proffera workspace/product screenshot or approved editorial workplace imagery
- direct copy
- one primary business CTA
- login as secondary action

Avoid generic fake dashboards, fake statistics, and decorative SaaS bento grids.

## Trust/source strip

Source information should be compact and factual.

Examples:
- Bolagsverket
- SCB
- company-provided information
- verified Proffera reviews

Only display a source/integration/logo if Proffera actually uses it in the represented context and any attribution rules are satisfied.

## Motion

Default motion:
- hero copy reveal
- subtle section reveal
- service-icon hover
- company card lift of roughly 2px
- image scale around 1.02 on hover

Prefer `transform` and `opacity`.
Avoid bounce, continuous pulse, parallax-heavy movement, large blur animation, and entrance animation on every element.

Always respect `prefers-reduced-motion`.

## Responsive rules

Minimum QA widths:
- 390px
- 768px
- 1024px
- 1440px

At mobile widths:
- search stacks vertically
- service rail scrolls horizontally
- company cards become one column
- steps become stacked
- important language/menu controls remain reachable
- no horizontal page overflow

## Accessibility

Minimum:
- WCAG AA contrast
- semantic headings
- native form labels/controls
- visible keyboard focus
- minimum 44px touch targets where appropriate
- no meaning conveyed only by color
- meaningful image alt text; decorative imagery uses empty alt
- reduced-motion support
- long labels and company names reflow without clipping

## Anti-AI / anti-template gate

Reject:
- purple/pink AI gradients
- glow CTAs
- card-inside-card layouts
- three identical generic feature cards
- meaningless statistics
- fake testimonials/reviews
- colored icon squares everywhere
- every section centered
- excessive badges
- huge radius/shadows
- decorative glass on ordinary content
- emoji as production icons
- generic copy such as "Smarter. Faster. Better."
- invented company/media/reputation data

Prefer:
- real categories
- real companies
- real locations
- real product actions
- source transparency
- varied information density
- editorial whitespace
- useful loading/error/empty states

## Engineering guardrails

Homepage redesign work must preserve:
- Directory search behavior
- Near me geolocation behavior
- localized routes
- authentication routes
- booking and quote logic
- analytics hooks
- SEO/canonical/hreflang behavior
- current data-source truthfulness

Do not broaden database/provider architecture merely for a visual change.

## PR acceptance gate

Before merge:
- exact-head CI green
- build/typecheck/lint green
- public E2E smoke green
- CodeQL/review gates green
- 390px and 1440px visual QA completed
- no fake ratings/logos/photos/data
- external editorial hero/CTA imagery either self-hosted/licensed for Production or replaced with approved Proffera-owned assets
- owner approves final Preview
