# trassfa Style Guide

This document describes the current visual style implemented in `apps/web/src/styles.css`.

## Overall direction

The current product style is:

- editorial rather than generic SaaS
- sharp and structured rather than soft and overly rounded
- warm and tactile rather than sterile
- story-driven, using layouts that explain how money moves
- mobile-first, with stacked flows by default and wider layouts added later

The design should feel like a product that understands real payment situations, not a dashboard template.

## Core principles

- Avoid excessive border radius. Most surfaces are square or lightly softened, not pill-heavy.
- Use flat color blocks and contrast instead of gradients.
- Use color intentionally to separate states, steps, or story moments.
- Let layouts explain the flow: source, route, destination.
- On mobile, prioritize a single clear column with full-width actions.
- Prefer bold headings, compact supporting copy, and structured panels.

## Typography

- Headings and brand: `Sora`
- Body copy and UI text: `Manrope`

### Heading tone

- Large, high-contrast, tight letter-spacing
- Direct and story-led
- Usually framed around movement, payout direction, or real-life use

### Body tone

- Clear and practical
- Short paragraphs
- Less feature-list language, more outcome language

## Color palette

Defined in CSS variables:

- `--bg: #f6f1e8`
  Main page background. Warm off-cream.
- `--paper: #fffdf8`
  Main surface color for cards, forms, and panels.
- `--ink: #171717`
  Primary text, strong borders, and dark emphasis areas.
- `--muted: #5d5a54`
  Supporting text and secondary copy.
- `--line: #d6cebf`
  Default border and divider color.
- `--yellow: #f1c84d`
  Primary accent. Used for highlights, section caps, and active route emphasis.
- `--blue: #7da4e8`
  Cool accent. Used to balance warm areas and separate flow blocks.
- `--green: #8db487`
  Support accent. Used in scenario variation and confirmation-style contexts.
- `--orange: #ef8a67`
  Warm accent. Used for alternative emphasis and variety.
- `--sand: #ece0cb`
  Soft neutral accent for background support.

### Supporting fills currently used

- `#efe4d2`
  Hero stage background
- `#f7eddc`
  Info/support panel background
- `#fbf2dd`
  CTA panel background
- `#f7f1e5`
  Result block background
- `#e7f0ff`
  Blue accent card fill
- `#fde4da`
  Orange accent card fill
- `#dceddd`
  Soft green accent fill
- `#fff2bf`
  Soft yellow note fill

## Surfaces and borders

- Panels use `1px solid var(--line)` as the default border.
- Borders are visible and structural, not decorative.
- Large hero or mockup areas may use harder contrast like `var(--ink)` shadows.
- Rounded corners should be minimal or absent unless a specific UI reason exists.

## Layout system

### Landing page

- Built as a story
- Hero pairs narrative copy with a visual mockup
- Supporting sections explain:
  - the problem
  - the bridge
  - the real-world moments
  - the supported rails

### App UI

- Mobile first
- Forms stack in one column by default
- Primary actions span full width on smaller screens
- Support panels and result panels sit below the form on mobile
- Multi-column layouts only appear at larger breakpoints

## Component style

### Buttons

- Primary button: dark fill using `--ink`, light text using `--paper`
- Secondary button: transparent or light surface with visible dark border
- Buttons should feel firm and utilitarian, not bubbly

### Panels

- Clear edges
- Moderate padding
- Used as functional blocks: route setup, flow explanation, result preview

### Mockups and flow visuals

- Show a money path or scenario
- Use source / route / destination framing where possible
- Accent colors should help explain steps, not just decorate

### Info steps

- Numbered
- Compact
- Designed to guide a user through a flow quickly

## Content style

- Do not paste raw feature bullets without interpretation.
- Convert product capabilities into a story about what the user is trying to do.
- Prefer real-life use cases over abstract finance language.
- Good framing examples:
  - “You start with crypto.”
  - “The other side wants fiat.”
  - “trassfa bridges both.”

## Things to avoid

- Soft generic fintech gradients
- Too many rounded pills or oversized rounded cards
- Flat monochrome screens with no visual rhythm
- Listing product capabilities without narrative structure
- Desktop-first form layouts
- Empty decorative illustrations that do not explain the product

## Implementation reference

Current source of truth:

- `apps/web/src/styles.css`
- `apps/web/src/routes/landing.tsx`
- `apps/web/src/routes/send.tsx`
- `apps/web/src/routes/receive.tsx`
- `apps/web/src/routes/auth.tsx`
