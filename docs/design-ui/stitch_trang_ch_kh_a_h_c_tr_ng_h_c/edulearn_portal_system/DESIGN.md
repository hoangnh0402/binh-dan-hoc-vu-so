---
name: Bình Dân Học Vụ Số — HPU2
colors:
  surface: '#ffffff'
  surface-dim: '#eadcdb'
  surface-bright: '#ffffff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff8f7'
  surface-container: '#fcefee'
  surface-container-high: '#f7e4e2'
  surface-container-highest: '#f1dad8'
  on-surface: '#1f1a1a'
  on-surface-variant: '#574342'
  inverse-surface: '#362f2e'
  inverse-on-surface: '#fbeeec'
  outline: '#8a7270'
  outline-variant: '#ddc0bd'
  surface-tint: '#962521'
  primary: '#962521'
  on-primary: '#ffffff'
  primary-container: '#7a1c19'
  on-primary-container: '#ffdad6'
  inverse-primary: '#ffb3ac'
  secondary: '#b3261e'
  on-secondary: '#ffffff'
  secondary-container: '#962521'
  on-secondary-container: '#ffffff'
  tertiary: '#7a5900'
  on-tertiary: '#ffffff'
  tertiary-container: '#a77a00'
  on-tertiary-container: '#ffe08a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb3ac'
  on-primary-fixed: '#410003'
  on-primary-fixed-variant: '#7a1c19'
  secondary-fixed: '#ffdad6'
  secondary-fixed-dim: '#ffb4ab'
  on-secondary-fixed: '#410002'
  on-secondary-fixed-variant: '#93000a'
  tertiary-fixed: '#ffdf9e'
  tertiary-fixed-dim: '#f5bf3c'
  on-tertiary-fixed: '#261a00'
  on-tertiary-fixed-variant: '#5c4300'
  background: '#ffffff'
  on-background: '#1f1a1a'
  surface-variant: '#f5dddb'
typography:
  display-hero:
    fontFamily: Be Vietnam Pro
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Be Vietnam Pro
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
  headline-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  title-card:
    fontFamily: Be Vietnam Pro
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-price:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 20px
  label-strikethrough:
    fontFamily: Be Vietnam Pro
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-badge:
    fontFamily: Be Vietnam Pro
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system delivers an energetic, structured, and modern digital campus experience for **Bình Dân Học Vụ Số**, the online learning platform of **Trường Đại học Sư phạm Hà Nội 2 (HPU2)**. Its identity follows the university's red-and-white brand, taken directly from the official HPU2 logo, so the website reads as part of the school.

### Emotional Target & Visual Personality
- **Institutional & Trustworthy:** Guided by HPU2 red (`#962521`) on clean white layouts, matching the university's seal and printed materials.
- **Energetic & Motivating:** Amber-gold stars and badges celebrate gamification, rankings, and milestone completion without competing with the brand red.
- **Focused & Accessible:** High-contrast typography paired with airy, structured card layouts that facilitate effortless browsing through multi-tiered curricula.

### Design Style: Modern Educational SaaS
Combining lightweight card architectures, crisp segmented filters, and high-legibility typographic scales. The UI relies on gentle elevation layers, structured outlines, and clear visual tags rather than ornate skeuomorphism, prioritizing catalog scanning speed and student engagement.

## Logo

- **Source file:** [`docs/design-ui/brand/logo-hpu2.png`](../../brand/logo-hpu2.png) — official HPU2 seal, PNG 1200×1200, red `#962521` on white.
- **Usage:** header (40px tall on desktop, 32px on mobile) next to the wordmark "Bình Dân Học Vụ Số" with the caption "Trường ĐHSP Hà Nội 2"; footer; favicon (32×32, 180×180 apple-touch-icon); Open Graph image; email header.
- **Rules:** keep the seal circular and unmodified, never recolor it, keep clear space of at least 1/4 of the logo width, and place it on white or very light surfaces only. On the red hero banner, place the logo inside a white circle.

## Colors

The palette is **red and white**, matching Trường ĐHSP Hà Nội 2. The default mode is light, optimizing legibility for prolonged reading and course reviews.

### Palette Architecture
- **Primary (`#962521` - HPU2 Red):** Sampled from the official logo. Anchors the header accents, primary call-to-action buttons ("Đăng ký học", "Tiếp tục học"), links, focus rings, active category tabs, and progress bars. White text on this red reaches a 8.1:1 contrast ratio (WCAG AAA).
- **Primary Dark (`#7A1C19`):** Hover/pressed state of primary buttons, active navigation pill, footer band.
- **Primary Tint (`#FCEFEE` / `#FFDAD6`):** Subtle red backgrounds for course tags, selected filters, and the "learning deadline" banner.
- **White (`#FFFFFF`):** Page canvas and card surfaces — the dominant color of every page.
- **Tertiary (`#F5BF3C` / `#7A5900` - Amber Gold):** Reserved for achievement: star ratings, top-3 ranking medals, certificate emblems.
- **Neutral (`#1F1A1A` - Warm Ink):** Headings and course titles. `#574342` for secondary meta text, `#DDC0BD` for borders and dividers.

### Functional Roles
- **Surface Canvas:** `#FFFFFF`, with `#FFF8F7` for alternating sections.
- **Card Containers:** `#FFFFFF` with borders `#F1DAD8`.
- **Subtle Badges:** Red tint `#FCEFEE` with text `#7A1C19` for course tags (`Khóa học`), amber `#FFDF9E` with text `#5C4300` for highlights.
- **Status colors:** Success `#1B7F3B` (completed lessons), Warning `#A15C00` on `#FFF4E0` (learning deadline ≤ 3 days), Error `#BA1A1A`. Because error and brand are both red, every error message must also carry an icon and explanatory text — never rely on color alone.

## Typography

The typography uses **Be Vietnam Pro** across all levels, designed natively for diacritics and Vietnamese text rendering. Its open counters and geometric balance ensure Vietnamese tone marks (`dấu hỏi, ngã, nặng`) remain sharp without clipping.

### Hierarchy & Treatment
- **Display & Headings:** Bold weights (700/800) with compact line-heights, ensuring multi-line Vietnamese course names fit gracefully in card headers.
- **Card Titles (`title-card`):** Clamped strictly at 2 lines with a maximum height of 44px, ensuring clean alignment across card grids.
- **Price Displays:** Distinct pair linking `label-price` (Crimson bold 700) with `label-strikethrough` (Slate gray 400 with a line-through decoration) and `label-badge` for percentage discounts.

## Layout & Spacing

The portal layout adheres to a 12-column responsive grid system with centered content constraints (maximum width `1320px`).

### Grid Specifications
- **Desktop (>= 1200px):** 12 columns, 4 cards per row (each span 3 columns). Gutter is `1.25rem` (20px), outer margins `2rem` (32px).
- **Tablet (768px - 1199px):** 8 columns, 2 or 3 cards per row. Gutter `1rem` (16px), outer margins `1.5rem` (24px).
- **Mobile (< 768px):** 4 columns, 1 or 2 cards per row. Gutter `0.75rem` (12px), outer margins `1rem` (16px). Filter bars transition into a horizontally scrollable strip.

### Internal Spacing Cadence
- Course card internal padding is standardized to `space-md` (16px) around the metadata section, while thumbnail media maintains an edge-to-edge bleed inside the top container.

## Elevation & Depth

Visual hierarchy is maintained through flat, subtle containment with low-contrast borders and purposeful lift on interactive cards.

### Depth Levels
- **Level 0 (Flat Canvas):** `#FFF8F7` base surface for content distinction against pure white modules.
- **Level 1 (Card Rest State):** Pure white container (`#FFFFFF`) with a 1px solid stroke in `#F1DAD8`. Shadows are suppressed in rest state to keep dense course lists clean and distraction-free.
- **Level 2 (Card Hover State):** Smooth transition (200ms ease) adding an ambient drop shadow: `0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)` and a -2px vertical translation.
- **Level 3 (Sticky Nav & Modals):** Crisp white surface backed by subtle blurred transparency (`backdrop-filter: blur(12px)`) with border bottom `1px solid #E2E8F0` and shadow `0 4px 12px rgba(15, 23, 42, 0.05)`.

## Shapes

The interface embraces a friendly yet modern curvature level (`roundedness: 2`). This keeps containers structural while softening visual corners to promote approachability.

### Radius Scale
- **Base Elements (`rounded-base` = 0.5rem / 8px):** Applied to form fields, search inputs, standard dropdown triggers, and buttons.
- **Course Cards & Banners (`rounded-lg` = 0.75rem / 12px):** Applied to outer course card shells, hero promotional banners, and modal dialogues. Top card thumbnail corners follow this curvature.
- **Badges & Category Chips (`rounded-full`):** Filter pills, student avatars, star badges, and percentage tags take pill-shaped borders for rapid distinction against rectilinear card frames.

## Components

### 1. Course Cards (Thẻ Khóa Học)
- **Visual Container:** White background, 1px `#E2E8F0` border, `rounded-lg` (12px), vertical flex layout.
- **Thumbnail Area:** 16:9 ratio image with an absolute top-right overlay pill badge containing a burning flame icon (`#F59E0B`) or status marker.
- **Category Pill:** Placed right below the image. Uses `#FCEFEE` background with `#7A1C19` text for "Khóa học", or `#FFDF9E` with `#5C4300` text for highlights. Text size `label-badge`.
- **Title:** 2 lines clamp, `title-card` token, `#1F1A1A`.
- **Instructor / Subtitle:** `body-sm`, `#574342`.
- **Rating Bar:** 5-star row in `#F59E0B` alongside numeric rating (e.g. `4.9`) in `label-md` weight.
- **Progress Strip** (replaces the pricing strip — all courses are free, A-01): progress bar in `#962521` on `#F1DAD8` track, percentage in `label-md`, and the remaining learning time ("Còn 12 ngày") in `body-sm`; turns warning amber when ≤ 3 days remain.

### 2. Category Tabs & Segmented Filters
- **Primary Category Strip:** Horizontal segmented control. Active tab features bold primary text (`#962521`) with a distinct bottom indicator line (2px `#962521`). Inactive tabs remain `#574342` on `#FFFFFF`.
- **Search & Dropdown Filter Bar:** Form control row with a full-width search input housing an embedded search icon (`#574342`), paired with select menus ("Tất cả", "Cấp độ") and the primary action button in HPU2 red (`#962521`).

### 3. Buttons
- **Primary Action (Call-to-Action):** HPU2 Red (`#962521`), text white, `rounded-base`, font `label-lg`, hover color `#7A1C19`.
- **Secondary Action:** White background with 1px border `#962521`, text `#962521`, hover background `#FCEFEE`.
- **Icon Buttons:** Circular 36x36px containers for cart, notification bell with red indicator badge, and user profile avatar.

### 4. Hero Banner
- Banner wrapper with rounded corners (`rounded-xl`), red gradient (`#5E1210` → `#962521` → `#6E1A17`), white headline with gold highlights, the HPU2 logo inside a white circle, and a white CTA button with red text ("Khám phá khóa học").