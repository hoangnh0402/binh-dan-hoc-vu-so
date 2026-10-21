---
name: EduLearn Portal System
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#444653'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#757684'
  outline-variant: '#c4c5d5'
  surface-tint: '#3755c3'
  primary: '#00288e'
  on-primary: '#ffffff'
  primary-container: '#1e40af'
  on-primary-container: '#a8b8ff'
  inverse-primary: '#b8c4ff'
  secondary: '#b71423'
  on-secondary: '#ffffff'
  secondary-container: '#db3239'
  on-secondary-container: '#fffbff'
  tertiary: '#4c2e00'
  on-tertiary: '#ffffff'
  tertiary-container: '#6b4200'
  on-tertiary-container: '#ffa929'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c4ff'
  on-primary-fixed: '#001453'
  on-primary-fixed-variant: '#173bab'
  secondary-fixed: '#ffdad7'
  secondary-fixed-dim: '#ffb3ae'
  on-secondary-fixed: '#410005'
  on-secondary-fixed-variant: '#930016'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
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

This design system delivers an energetic, structured, and modern digital campus experience tailored for contemporary e-learning platforms and school academies. Rooted in the clarity and practicality seen in leading technical learning portals, it establishes an environment that is inspiring, academically rigorous, yet warm and approachable.

### Emotional Target & Visual Personality
- **Intellectual & Trustworthy:** Guided by deep cobalt blue and clean white layouts that convey institution-level authority and security.
- **Energetic & Motivating:** Powered by vibrant coral-red accents, radiant amber stars, and active badges that celebrate gamification, discounts, and milestone completion.
- **Focused & Accessible:** High-contrast typography paired with airy, structured card layouts that facilitate effortless browsing through multi-tiered curricula.

### Design Style: Modern Educational SaaS
Combining lightweight card architectures, crisp segmented filters, and high-legibility typographic scales. The UI relies on gentle elevation layers, structured outlines, and clear visual tags rather than ornate skeuomorphism, prioritizing catalog scanning speed and student engagement.

## Colors

The palette balances analytical clarity with motivating rewards. The default mode is light, optimizing legibility for prolonged reading, code browsing, and course reviews.

### Palette Architecture
- **Primary (`#1E40AF` - Academic Royal Blue):** Anchors top navigation, primary focus states, brand logos, active category tabs, and informative tags.
- **Secondary (`#FF4D4F` - Crimson Accent):** Drives urgency and discovery—applied to discount badges (`-31%`, `-49%`), primary call-to-action buttons (e.g., "Chọn nội dung quan tâm", "Mua ngay"), and notification pings.
- **Tertiary (`#F59E0B` - Amber Gold):** Dedicated to student achievement, star rating vectors (4.8 - 5.0), certificate emblems, and hot course flame badges.
- **Neutral (`#0F172A` - Midnight Slate):** Governs primary headings and course titles. Accompanied by `#64748B` for secondary meta text (instructor names, strike-through original prices) and `#F8FAFC` for high-comfort canvas backdrops.

### Functional Roles
- **Surface Canvas:** `#F8FAFC`
- **Card Containers:** `#FFFFFF` with borders `#E2E8F0`
- **Subtle Badges:** Light blue tint `#EFF6FF` for course tags (`Khóa học`), light amber `#FEF3C7` for combo markers (`Combo`).

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
- **Level 0 (Flat Canvas):** `#F8FAFC` base surface for content distinction against pure white modules.
- **Level 1 (Card Rest State):** Pure white container (`#FFFFFF`) with a 1px solid stroke in `#E2E8F0`. Shadows are suppressed in rest state to keep dense course lists clean and distraction-free.
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
- **Category Pill:** Placed right below the image. Uses `#EFF6FF` background with `#1E40AF` text for "Khóa học", or `#FEF3C7` with `#D97706` text for "Combo". Text size `label-badge`.
- **Title:** 2 lines clamp, `title-card` token, `#0F172A`.
- **Instructor / Subtitle:** `body-sm`, `#64748B`.
- **Rating Bar:** 5-star row in `#F59E0B` alongside numeric rating (e.g. `4.9`) in `label-md` weight.
- **Pricing Strip:** Bottom aligned flex row:
  - Promotional price: Secondary color `#FF4D4F`, bold `label-price`.
  - Base price: `#94A3B8`, `label-strikethrough`.
  - Discount badge: Red-tinted chip (`#FEF2F2`), text `#EF4444`, `label-badge` (e.g., `-31%`).

### 2. Category Tabs & Segmented Filters
- **Primary Category Strip:** Horizontal segmented control. Active tab features bold primary text (`#1E40AF`) with a distinct bottom indicator line (2px `#1E40AF`). Inactive tabs remain `#64748B` on `#FFFFFF`.
- **Search & Dropdown Filter Bar:** Form control row with a full-width search input housing an embedded search icon (`#64748B`), paired with select menus ("Tất cả", "Cấp độ") and the primary accent action button ("Chọn nội dung quan tâm") in bold coral red (`#FF4D4F`).

### 3. Buttons
- **Primary Action (Call-to-Action):** Coral Red (`#FF4D4F`), text white, `rounded-base`, font `label-lg`, hover color `#E03E40`.
- **Secondary Action:** White background with 1px border `#CBD5E1`, text `#1E40AF`, hover background `#F1F5F9`.
- **Icon Buttons:** Circular 36x36px containers for cart, notification bell with red indicator badge, and user profile avatar.

### 4. Hero Banner
- Banner wrapper with rounded corners (`rounded-xl`), rich visual gradient, gold typography, and an anchored CTA button ("MUA NGAY") driving campaign engagement.