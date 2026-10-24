---
name: DocuLens Precision
colors:
  surface: '#faf8ff'
  surface-dim: '#d5d9ee'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e3e7fc'
  surface-container-highest: '#dee2f6'
  on-surface: '#161b2a'
  on-surface-variant: '#464554'
  inverse-surface: '#2b303f'
  inverse-on-surface: '#eef0ff'
  outline: '#777586'
  outline-variant: '#c7c4d7'
  surface-tint: '#5148d7'
  primary: '#2a14b4'
  on-primary: '#ffffff'
  primary-container: '#4338ca'
  on-primary-container: '#c1beff'
  inverse-primary: '#c3c0ff'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#692400'
  on-tertiary: '#ffffff'
  tertiary-container: '#8f3400'
  on-tertiary-container: '#ffb393'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#100069'
  on-primary-fixed-variant: '#372abf'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb597'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#faf8ff'
  on-background: '#161b2a'
  surface-variant: '#dee2f6'
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
  mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  mono-code:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
  space-2xl: 4rem
  space-3xl: 6rem
---

## Brand & Style

This design system expresses algorithmic clarity, analytical depth, and structural discipline. Built specifically for an intelligent document intelligence portfolio, it communicates institutional trust alongside technical sophistication. The emotional tone is authoritative, quiet, and deliberate—eschewing frivolous decoration in favor of clear information architecture, high data density, and razor-sharp typographic discipline.

The visual style blends refined modern minimalism with technical precision:
- **Calm, Clinical Surfaces:** Seamless shifts between crisp white planes and soft cool-slate canvases (#F6F7FB) establish an editorial rhythm that feels like an immaculate research workspace.
- **Instrument-Grade Details:** Monospaced data tags, subtle structural lines (#E3E6EF), and crisp hairline borders ground the AI capabilities in rigorous engineering rather than nebulous magic.
- **Selective High-Acuity Accents:** Deep architectural indigo commands primary calls to action, while focused teal indicators highlight AI synthesis, active states, and verification nodes.

## Colors

The palette balances clinical legibility with precise chromatic utility:

- **Surface System:**
  - Base canvas: `#F6F7FB` (cool, light grey-slate).
  - Elevated/Alternating sections: `#FFFFFF` (pure stark white) alternating with `#F6F7FB` to create legible structural rhythm.
  - Border and Dividers: `#E3E6EF` (subtle, structural hairpins).
  - Hover / Active Surface: `#EEF1F8`.

- **Typography & Content:**
  - Primary text: `#1F2433` (deep slate ink, high contrast for maximum legibility).
  - Secondary text / metadata: `#4B5368` (balanced slate grey for annotations and structural descriptions).
  - Muted / Disabled text: `#8F97AB`.

- **Accents & Roles:**
  - **Primary Indigo (`#4338CA`):** Anchors primary brand actions, primary key buttons, and navigation anchors.
  - **Accent Teal (`#0D9488`):** Reserved strictly for high-value AI indicators, confidence scores, accuracy metrics, and extraction highlights. Never used for massive surface fills.
  - **Success / Verification:** `#059669`
  - **Warning / Ambiguity:** `#D97706`
  - **Critical / Error:** `#DC2626`

## Typography

The typographic hierarchy implements a dual-font structure:
1. **Inter:** Used for all prose, section titles, interface actions, and narrative copy. Employs tight negative tracking on display sizes to yield a confident, editorial presence, while maintaining standard tracking on body sizes for optimal readability.
2. **JetBrains Mono:** Used for technical metadata, document schema titles, file paths, confidence percentages, tokens, and numerical telemetry. It must be styled with uppercase or tabular-lining treatment when displaying telemetry.

Rules:
- Never apply `JetBrains Mono` to multi-line paragraph text.
- Never use bold weights (`700`) for the monospaced font; cap weight at `500` (Medium) to maintain crisp character rendering.
- Section overlines/eyebrows should always use `mono-sm` in all-caps with generous letter-spacing (`0.05em`) in `#4B5368` or `#0D9488`.

## Layout & Spacing

The layout is built upon an 8pt modular grid enclosed inside a 12-column responsive fluid grid with a maximum content container of 1280px.

- **Breakpoints:**
  - **Desktop (>= 1024px):** 12 columns, 24px (`1.5rem`) gutter, 48px (`3rem`) page margins.
  - **Tablet (768px – 1023px):** 8 columns, 20px (`1.25rem`) gutter, 32px (`2rem`) page margins.
  - **Mobile (< 768px):** 4 columns, 16px (`1rem`) gutter, 20px (`1.25rem`) page margins.

- **Alternating Section Rhythm:**
  - Landing page sections alternate consistently between full-bleed background fills of `#FFFFFF` and `#F6F7FB`.
  - Section vertical rhythm adheres strictly to `space-3xl` (96px) on desktop and `space-2xl` (64px) on mobile.
  - Component internals use `space-sm` (8px) for related inline items, `space-md` (16px) between labels and inputs, and `space-lg` (24px) for card body padding.

## Elevation & Depth

Visual hierarchy relies primarily on planar surface distinction and low-contrast outlines rather than heavy drop shadows:

- **Border Hierarchy:**
  - Every surface division and card perimeter features a crisp `1px solid #E3E6EF` border.
  - Active or focused surfaces switch their border to `#4338CA` or `#0D9488` with no change in border width (maintaining 1px to avoid layout shifts).

- **Elevation Levels:**
  - **Level 0 (Flat):** No shadow. Native surfaces on canvas (`#F6F7FB` or `#FFFFFF`).
  - **Level 1 (Card & Content Blocks):** `0 1px 3px 0 rgba(31, 36, 51, 0.04), 0 1px 2px -1px rgba(31, 36, 51, 0.04)`. Barely perceptible ambient occlusion that visually decouples white cards from the `#F6F7FB` background.
  - **Level 2 (Hover & Interactive Overlays):** `0 4px 6px -1px rgba(31, 36, 51, 0.06), 0 2px 4px -2px rgba(31, 36, 51, 0.04)`. Used exclusively for card hover transitions and popovers.
  - **Level 3 (Modals / Floats):** `0 20px 25px -5px rgba(31, 36, 51, 0.08), 0 8px 10px -6px rgba(31, 36, 51, 0.04)`.

## Shapes

The geometric signature balances architectural rectilinearity with humanized affordances:

- **Cards & Data Panels:** Exactly `12px` border-radius (`0.75rem`).
- **Buttons, Inputs & Interactive Elements:** Exactly `8px` border-radius (`0.5rem`).
- **Status Pills, Verification Tags & Metrics Badges:** Fully rounded `9999px` (pill-shaped) to distinguish analytical tags from action buttons.
- **Icon Enclosures:** `6px` or `8px` depending on frame scale.

## Components

### Buttons
- **Height & Dimensions:** Unified `48px` height across all primary and secondary actions; padding: `0 20px`; border-radius: `8px`.
- **Primary:** Background `#4338CA`, text `#FFFFFF`, font-weight `600`, no visible border. Hover: `#3730A3` with subtle elevation Level 2. Active: `#312E81`.
- **Secondary / Outline:** Background `#FFFFFF`, text `#1F2433`, border `1px solid #E3E6EF`. Hover: background `#F6F7FB`, border `#CBD0E0`.
- **Tertiary / Ghost:** Background transparent, text `#4B5368`. Hover: background `#EEF1F8`, text `#1F2433`.

### Cards & Feature Containers
- **Construction:** Background `#FFFFFF` (on `#F6F7FB` canvas) or `#F6F7FB` (on `#FFFFFF` canvas), border `1px solid #E3E6EF`, radius `12px`, padding `24px`.
- **Elevation:** Level 1 baseline.
- **Hover Behavior:** Translates `-2px` on the Y-axis accompanied by elevation Level 2 and an optional border transition to `#CBD0E0`.

### Chips & Badges
- **Technical Tag:** Font `JetBrains Mono` (12px), height `24px`, padding `0 8px`, border-radius `4px` or `9999px`.
- **AI Accent Chip:** Background `rgba(13, 148, 136, 0.08)`, border `1px solid rgba(13, 148, 136, 0.25)`, text `#0D9488`.
- **Neutral Chip:** Background `#F6F7FB`, border `1px solid #E3E6EF`, text `#4B5368`.

### Input Fields
- **Metrics:** Height `48px`, border-radius `8px`, border `1px solid #E3E6EF`, background `#FFFFFF`, text `#1F2433`, font `Inter` (15px).
- **Focus State:** Border color `#4338CA`, outer ring shadow `0 0 0 3px rgba(67, 56, 202, 0.12)`. Outline: none.

### Selection Controls (Checkboxes & Radios)
- **Checkbox:** `18px × 18px`, border-radius `4px`, border `1.5px solid #CBD0E0`. Checked state: background `#4338CA`, border-color `#4338CA`, with white check icon.
- **Radio:** `18px × 18px`, border-radius `50%`, border `1.5px solid #CBD0E0`. Checked state: border-color `#4338CA` with an inner `#4338CA` circular dot.

### Iconography
- **Style:** Strictly 1.5px stroke outline icons (e.g., Lucide or Feather style). Filled icons are prohibited.
- **Color:** Inherit parent text color or `#4B5368` for secondary cues.
- **Scale:** 16px for inline technical badges, 20px for buttons and navigation, 24px for top-level feature card headers.

### Specialized AI Document Preview Component
- **Structure:** Monospaced data viewer displaying parsed metadata key-values.
- **Visuals:** Left border `2px solid #0D9488`, background `#FFFFFF`, font `JetBrains Mono` (12px), structured with alternating row shading in `#F6F7FB`.