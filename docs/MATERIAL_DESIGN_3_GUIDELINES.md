# Material Design 3 (M3) Comprehensive Design Guidelines

> A complete reference for implementing Material Design 3 (Material You) in applications.
> Based on official specifications from [m3.material.io](https://m3.material.io/)

---

## Table of Contents

1. [Typography](#typography)
2. [Color System](#color-system)
3. [Spacing & Layout](#spacing--layout)
4. [Shape System](#shape-system)
5. [Elevation](#elevation)
6. [Icons](#icons)
7. [Component States](#component-states)
8. [Components](#components)
   - [Buttons](#buttons)
   - [Cards](#cards)
   - [Navigation Bar](#navigation-bar)
   - [Tabs](#tabs)
   - [Search Bar](#search-bar)
   - [Text Fields](#text-fields)
   - [Lists](#lists)
   - [Dialogs](#dialogs)
   - [Chips](#chips)

---

## Typography

### Type Scale Overview

Material Design 3 uses **Roboto** as the default font family with a 15-token type scale organized into 5 categories, each with 3 sizes (small, medium, large).

### Complete Type Scale Specifications

| Token | Size | Line Height | Weight | Letter Spacing |
|-------|------|-------------|--------|----------------|
| **Display Large** | 57sp | 64sp | Regular (400) | -0.25sp |
| **Display Medium** | 45sp | 52sp | Regular (400) | 0sp |
| **Display Small** | 36sp | 44sp | Regular (400) | 0sp |
| **Headline Large** | 32sp | 40sp | Regular (400) | 0sp |
| **Headline Medium** | 28sp | 36sp | Regular (400) | 0sp |
| **Headline Small** | 24sp | 32sp | Regular (400) | 0sp |
| **Title Large** | 22sp | 28sp | Regular (400) | 0sp |
| **Title Medium** | 16sp | 24sp | Medium (500) | 0.15sp |
| **Title Small** | 14sp | 20sp | Medium (500) | 0.1sp |
| **Body Large** | 16sp | 24sp | Regular (400) | 0.5sp |
| **Body Medium** | 14sp | 20sp | Regular (400) | 0.25sp |
| **Body Small** | 12sp | 16sp | Regular (400) | 0.4sp |
| **Label Large** | 14sp | 20sp | Medium (500) | 0.1sp |
| **Label Medium** | 12sp | 16sp | Medium (500) | 0.5sp |
| **Label Small** | 11sp | 16sp | Medium (500) | 0.5sp |

### Typography Usage Guidelines

| Category | Use Case | Notes |
|----------|----------|-------|
| **Display** | Hero text, large numerals | Short text only; best for wide screens |
| **Headline** | Screen titles, section headers | High-emphasis short text |
| **Title** | Subheadings, card headers | Medium-emphasis text |
| **Body** | Long-form text, paragraphs | Primary readable text |
| **Label** | Buttons, tags, captions | Small, utility text |

### CSS Custom Property Naming Convention

```css
--md-sys-typescale-{category}-{size}-{property}

/* Examples */
--md-sys-typescale-body-medium-size: 14px;
--md-sys-typescale-body-medium-line-height: 20px;
--md-sys-typescale-body-medium-weight: 400;
--md-sys-typescale-body-medium-tracking: 0.25px;
```

### Font Weight Reference

| Weight Name | Value | Usage |
|-------------|-------|-------|
| Regular | 400 | Display, Headline, Body |
| Medium | 500 | Title (Medium, Small), Label |
| Semi-Bold | 600 | Emphasized text (optional) |
| Bold | 700 | Heavy emphasis (optional) |

---

## Color System

### Color Architecture

M3 uses a **token-based color system** that separates semantic roles from actual color values, enabling seamless light/dark mode transitions.

```
Reference Tokens → System Tokens → Component Tokens
(blue-500)      → (primary)     → (button-container)
```

### Primary Color Roles

| Token | Role | Usage |
|-------|------|-------|
| **Primary** | Key color | High-emphasis buttons, active states, links |
| **On Primary** | Text/icons on primary | Content displayed on primary color |
| **Primary Container** | Less prominent containers | Filled tonal buttons, chips |
| **On Primary Container** | Text/icons on container | Content on primary container |

### Secondary Color Roles

| Token | Role | Usage |
|-------|------|-------|
| **Secondary** | Accent color | Filter chips, switches |
| **On Secondary** | Text/icons on secondary | Content on secondary |
| **Secondary Container** | Subtle containers | Less prominent chips, toggles |
| **On Secondary Container** | Text/icons on container | Content on secondary container |

### Tertiary Color Roles

| Token | Role | Usage |
|-------|------|-------|
| **Tertiary** | Complementary accent | Progress indicators, accents |
| **On Tertiary** | Text/icons on tertiary | Content on tertiary |
| **Tertiary Container** | Contrast containers | Complementary filled elements |
| **On Tertiary Container** | Text/icons on container | Content on tertiary container |

### Surface & Background Colors

| Token | Light Mode Usage | Dark Mode Usage |
|-------|------------------|-----------------|
| **Surface** | Main background | Main background |
| **Surface Dim** | Dimmed surface | Dimmed surface |
| **Surface Bright** | Elevated surface | Elevated surface |
| **Surface Container Lowest** | Lowest level container | Lowest level container |
| **Surface Container Low** | Low level container | Low level container |
| **Surface Container** | Standard container | Standard container |
| **Surface Container High** | Higher level container | Higher level container |
| **Surface Container Highest** | Highest level container | Highest level container |
| **On Surface** | Primary text | Primary text |
| **On Surface Variant** | Secondary text | Secondary text |

### Error, Warning & Status Colors

| Token | Usage |
|-------|-------|
| **Error** | Error states, destructive actions |
| **On Error** | Text/icons on error |
| **Error Container** | Error backgrounds |
| **On Error Container** | Text on error backgrounds |

### Outline Colors

| Token | Usage |
|-------|-------|
| **Outline** | Borders, dividers (higher contrast) |
| **Outline Variant** | Subtle borders, dividers (lower contrast) |

### Color Application Rules

1. **Use semantic tokens, not literal colors**
   - Button isn't "blue" — it's "primary"
   - Error message isn't "red" — it's "error"

2. **Pairing rules for accessibility**
   - Use `on-primary` on `primary`
   - Use `on-primary-container` on `primary-container`
   - Same pattern for all accent and neutral colors

3. **Minimum contrast ratios**
   - Normal text: 4.5:1
   - Large text (18sp+ or 14sp+ bold): 3:1
   - UI components and graphics: 3:1

---

## Spacing & Layout

### Baseline Grid

M3 uses an **8dp baseline grid** for all measurements. Smaller elements use a 4dp grid.

### Standard Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| **None** | 0dp | No spacing |
| **Extra Small** | 4dp | Tight grouping, icon padding |
| **Small** | 8dp | Related elements, chips |
| **Medium** | 16dp | Standard margins, padding |
| **Large** | 24dp | Section spacing, card padding |
| **Extra Large** | 32dp | Major sections |
| **2XL** | 48dp | Large gaps |
| **3XL** | 64dp | Hero sections |

### Margin Guidelines

| Context | Recommended Margin |
|---------|-------------------|
| Screen edge (mobile) | 16dp |
| Screen edge (tablet) | 24dp |
| Screen edge (desktop) | 24-40dp |
| Content within cards | 16dp |
| Between cards | 8dp |

### Gutter (Column Gap) Values

| Breakpoint | Gutter |
|------------|--------|
| Compact (phone) | 8dp |
| Medium (tablet) | 16dp |
| Expanded (desktop) | 24dp |

### Padding Guidelines

| Component Type | Internal Padding |
|----------------|------------------|
| Buttons | 16dp horizontal, 10dp vertical |
| Cards | 16dp |
| List items | 16dp horizontal |
| Text fields | 16dp |
| Dialogs | 24dp |
| Bottom sheets | 16dp |

### Touch Targets

| Minimum Size | Recommendation |
|--------------|----------------|
| Touch target | 48dp x 48dp |
| Dense touch target | 40dp x 40dp |
| Icon tap area | 48dp (for 24dp icons) |

---

## Shape System

### Corner Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| **None** | 0dp | Sharp corners |
| **Extra Small** | 4dp | Buttons (small), chips |
| **Small** | 8dp | Cards (outlined), text fields |
| **Medium** | 12dp | Cards (elevated/filled) |
| **Large** | 16dp | Floating buttons, navigation |
| **Extra Large** | 28dp | Sheets, large containers |
| **Full** | 50% / 9999dp | Pills, avatars |

### Shape Categories by Component

| Component | Corner Radius |
|-----------|---------------|
| Buttons (filled, outlined) | Full (pill-shaped) |
| FAB | Large (16dp) or Full |
| Cards | Medium (12dp) |
| Text Fields | Extra Small (4dp) top only |
| Dialogs | Extra Large (28dp) |
| Bottom Sheets | Extra Large (28dp) top only |
| Chips | Small (8dp) or Full |
| Navigation Bar | None (0dp) |
| Search Bar | Full (pill-shaped) |

### Shape Application Rules

1. **Consistent rounding within containers**
   - All corners of a card should have the same radius

2. **Nested element consideration**
   - Inner elements should have smaller or equal radius to container

3. **Morphing states (M3 Expressive)**
   - Shapes can animate between states
   - Use consistent shape for related actions

---

## Elevation

### Elevation Levels

| Level | Value | Usage |
|-------|-------|-------|
| **Level 0** | 0dp | Flat surfaces, filled buttons |
| **Level 1** | 1dp | Elevated cards, filled inputs |
| **Level 2** | 3dp | Elevated buttons, cards on hover |
| **Level 3** | 6dp | FABs, menus |
| **Level 4** | 8dp | Navigation drawers |
| **Level 5** | 12dp | Dialogs, modals |

### Elevation Types in M3

#### Shadow Elevation
- Traditional drop shadows
- Higher elevation = larger, more diffuse shadow
- Used for distinct layering

#### Tonal Elevation
- Uses color tinting instead of/with shadows
- Surface becomes slightly tinted with primary color
- Higher elevation = more prominent tint
- Preferred method in M3

### Shadow Specifications (CSS)

```css
/* Level 1 */
box-shadow: 0 1dp 2dp rgba(0,0,0,0.3), 0 1dp 3dp 1dp rgba(0,0,0,0.15);

/* Level 2 */
box-shadow: 0 1dp 2dp rgba(0,0,0,0.3), 0 2dp 6dp 2dp rgba(0,0,0,0.15);

/* Level 3 */
box-shadow: 0 4dp 8dp 3dp rgba(0,0,0,0.15), 0 1dp 3dp rgba(0,0,0,0.3);

/* Level 4 */
box-shadow: 0 6dp 10dp 4dp rgba(0,0,0,0.15), 0 2dp 3dp rgba(0,0,0,0.3);

/* Level 5 */
box-shadow: 0 8dp 12dp 6dp rgba(0,0,0,0.15), 0 4dp 4dp rgba(0,0,0,0.3);
```

### Elevation State Changes

| Interaction | Elevation Change |
|-------------|------------------|
| Default | Base elevation |
| Hover | +1 level |
| Pressed | Base or -1 level |
| Dragged | +2 levels |
| Disabled | 0dp |

---

## Icons

### Icon Sizing

| Size | Usage | Touch Target |
|------|-------|--------------|
| **20dp** | Dense UI, desktop | 40dp |
| **24dp** | Standard size | 48dp |
| **40dp** | Featured icons | 48dp |
| **48dp** | Large emphasis | 48dp |

### Icon Button Sizes (M3)

| Size Token | Button Size | Icon Size |
|------------|-------------|-----------|
| Extra Small | 32dp | 20dp |
| Small | 36dp | 24dp |
| Medium | 40dp | 24dp |
| Large | 48dp | 24dp |
| Extra Large | 56dp | 24dp |

### Icon Styles

| Style | Stroke Weight | Usage |
|-------|---------------|-------|
| **Outlined** | 2dp | Default, unselected states |
| **Filled** | Solid | Selected, active states |
| **Rounded** | 2dp, rounded ends | Softer appearance |
| **Sharp** | 2dp, sharp ends | Technical contexts |
| **Two-tone** | Filled + outlined | Decorative |

### Icon Weight Variants (Material Symbols)

| Weight | Value | Usage |
|--------|-------|-------|
| Thin | 100 | Do not use at 24dp |
| Light | 300 | Subtle, large icons |
| Regular | 400 | Default |
| Medium | 500 | Emphasis |
| Semi-Bold | 600 | Strong emphasis |
| Bold | 700 | Maximum emphasis |

### Icon Padding Within Buttons

| Button Type | Icon-to-Label Gap | Icon Padding |
|-------------|-------------------|--------------|
| Text button with icon | 8dp | 0dp outer |
| Filled button with icon | 8dp | 16dp outer |
| Icon-only button | N/A | Centered |

---

## Component States

### State Layer System

States are communicated through **overlay layers** with fixed opacity on top of the component color.

### State Layer Opacities

| State | Opacity | Description |
|-------|---------|-------------|
| **Enabled** | 0% | Default state |
| **Hover** | 8% | Cursor over element |
| **Focus** | 10% | Keyboard focus |
| **Pressed** | 10-12% | Active touch/click |
| **Dragged** | 16% | Being dragged |
| **Disabled** | 0% (+ reduced content opacity) | Not interactive |

### State Layer Color

The state layer uses the **same color as the content** (text/icon):

```
Container: primary-container
Content: on-primary-container
State layer: on-primary-container @ {state opacity}
```

### Disabled State Specifications

| Property | Value |
|----------|-------|
| Container opacity | 12% of enabled |
| Content opacity | 38% of enabled |
| Elevation | 0dp |
| Interaction | None |

### Focus Indicators

| Type | Specification |
|------|---------------|
| Focus ring | 3dp wide, offset 2dp |
| Focus ring color | Secondary or custom |
| Inner offset | 2dp from component edge |

---

## Components

### Buttons

#### Button Types

| Type | Visual | Emphasis | Usage |
|------|--------|----------|-------|
| **Filled** | Solid primary container | Highest | Primary actions |
| **Filled Tonal** | Solid secondary container | High | Secondary actions |
| **Elevated** | Surface + shadow | Medium | Needs separation from background |
| **Outlined** | Border only | Medium | Secondary, cancel actions |
| **Text** | No container | Low | Tertiary actions, navigation |

#### Button Specifications

| Property | Value |
|----------|-------|
| Height | 40dp |
| Minimum width | 64dp |
| Corner radius | Full (20dp for 40dp height) |
| Horizontal padding | 24dp (with text only) |
| Horizontal padding | 16dp (with icon) |
| Icon-to-label gap | 8dp |
| Icon size | 18dp |
| Text style | Label Large |
| Text case | Sentence case (not ALL CAPS) |

#### Button with Icon Layout

```
[16dp] [Icon 18dp] [8dp] [Label] [24dp]
```

#### FAB (Floating Action Button)

| Property | Small | Standard | Large |
|----------|-------|----------|-------|
| Size | 40dp | 56dp | 96dp |
| Icon size | 24dp | 24dp | 36dp |
| Corner radius | 12dp | 16dp | 28dp |
| Elevation | Level 3 (6dp) | Level 3 (6dp) | Level 3 (6dp) |

#### Extended FAB

| Property | Value |
|----------|-------|
| Height | 56dp |
| Corner radius | 16dp |
| Horizontal padding | 16dp |
| Icon size | 24dp |
| Icon-to-text gap | 12dp |
| Text style | Label Large |

---

### Cards

#### Card Types

| Type | Container | Elevation | Usage |
|------|-----------|-----------|-------|
| **Elevated** | Surface | Level 1 (1dp) | Default, needs depth |
| **Filled** | Surface Container Highest | Level 0 | On lighter backgrounds |
| **Outlined** | Surface + Outline | Level 0 | Clear boundaries needed |

#### Card Specifications

| Property | Value |
|----------|-------|
| Corner radius | 12dp |
| Internal padding | 16dp |
| Outline (outlined card) | 1dp, Outline Variant color |

#### Card Content Layout

```
┌─────────────────────────────┐
│ [Optional Media - full bleed] │
├─────────────────────────────┤
│ [16dp padding]                │
│                               │
│ [Headline - Title Large]      │
│ [8dp]                         │
│ [Subhead - Body Medium]       │
│ [16dp]                        │
│ [Supporting text - Body Med]  │
│ [16dp]                        │
│ [Actions - aligned right]     │
│                               │
│ [16dp padding]                │
└─────────────────────────────┘
```

#### Card States

| State | Change |
|-------|--------|
| Hover | Elevation +1, state layer 8% |
| Pressed | State layer 12% |
| Focused | Focus ring, state layer 10% |
| Dragged | Elevation +2, state layer 16% |

---

### Navigation Bar

#### Specifications

| Property | Value |
|----------|-------|
| Height | 80dp |
| Icon size | 24dp |
| Label text style | Label Medium (12sp) |
| Items | 3-5 destinations |
| Background | Surface Container |

#### Navigation Item Layout

```
┌─────────────────┐
│    [Icon 24dp]  │  ← 12dp from top
│    [4dp gap]    │
│    [Label]      │  ← 16dp from bottom
└─────────────────┘
```

#### Active Indicator (Pill)

| Property | Value |
|----------|-------|
| Width | 64dp |
| Height | 32dp |
| Corner radius | Full (16dp) |
| Color | Secondary Container |
| Icon color (active) | On Secondary Container |

#### Navigation Bar States

| State | Icon | Label |
|-------|------|-------|
| Inactive | On Surface Variant | On Surface Variant |
| Active | On Secondary Container | On Surface |
| Pressed | State layer 12% | Same |

---

### Tabs

#### Tab Types

| Type | Indicator | Usage |
|------|-----------|-------|
| **Primary** | Bottom underline | Top-level navigation |
| **Secondary** | Full-width underline | Content filtering within page |

#### Primary Tab Specifications

| Property | Value |
|----------|-------|
| Height | 48dp (text only), 64dp (with icon) |
| Minimum width | 90dp |
| Maximum width | 360dp |
| Horizontal padding | 16dp |
| Indicator height | 3dp |
| Indicator corner radius | Top corners 3dp |
| Indicator color | Primary |
| Text style | Title Small (14sp, Medium) |
| Icon size | 24dp |
| Icon-to-text gap | 4dp (stacked layout) |

#### Secondary Tab Specifications

| Property | Value |
|----------|-------|
| Height | 48dp |
| Indicator | Full width underline |
| Indicator height | 2dp |
| Indicator color | Primary |
| Text style | Title Small |
| Background | Surface Container |

#### Tab Content Layout

**Text-only tabs:**
```
┌────────────────────┐
│    [20dp top]      │
│    [Label]         │
│    [17dp bottom]   │
│ ═══[Indicator 3dp] │
└────────────────────┘
```

**Tabs with icon (stacked):**
```
┌────────────────────┐
│    [12dp top]      │
│    [Icon 24dp]     │
│    [4dp gap]       │
│    [Label]         │
│    [12dp bottom]   │
│ ═══[Indicator 3dp] │
└────────────────────┘
```

#### Tab States

| State | Color |
|-------|-------|
| Inactive | On Surface Variant |
| Active | Primary |
| Hover | On Surface + 8% state layer |
| Focused | Primary + focus ring |
| Pressed | Primary + 12% state layer |

---

### Search Bar

#### Specifications

| Property | Value |
|----------|-------|
| Height | 56dp |
| Corner radius | Full (28dp) |
| Horizontal padding | 16dp |
| Icon size | 24dp |
| Leading icon | Search icon |
| Trailing icon | Voice/clear (optional) |
| Text style | Body Large |
| Placeholder color | On Surface Variant |
| Background | Surface Container Highest |

#### Search Bar Layout

```
┌───────────────────────────────────────────┐
│ [16dp] [🔍 24dp] [16dp] [Placeholder...] [Mic 24dp] [16dp] │
└───────────────────────────────────────────┘
                    56dp height
```

#### Search View (Expanded)

| Property | Value |
|----------|-------|
| Full width | Screen width |
| Corner radius | 28dp (top) when docked |
| Results list padding | 16dp horizontal |
| Divider | 1dp, Outline Variant |

---

### Text Fields

#### Text Field Types

| Type | Description | Usage |
|------|-------------|-------|
| **Filled** | Solid background, bottom line | Default, most cases |
| **Outlined** | Border on all sides | Prominent fields |

#### Text Field Specifications

| Property | Filled | Outlined |
|----------|--------|----------|
| Height | 56dp | 56dp |
| Corner radius | 4dp (top only) | 4dp (all) |
| Horizontal padding | 16dp | 16dp |
| Label text style | Body Small (floating) | Body Small (floating) |
| Input text style | Body Large | Body Large |
| Background | Surface Container Highest | Transparent |
| Border (outlined) | N/A | 1dp Outline |
| Indicator line (filled) | 1dp | N/A |

#### Text Field Layout

```
Filled (resting):
┌─────────────────────────────┐
│ [16dp] [Label - Body Large] │ 56dp
│________________________[16dp]│
```

```
Filled (focused):
┌─────────────────────────────┐
│ [16dp] [Label - Body Small] │
│ [Input text - Body Large]   │ 56dp
│═══════════════════════[16dp]│
   ↑ Active indicator 2dp
```

#### Text Field States

| State | Indicator/Border | Label Color |
|-------|------------------|-------------|
| Enabled | On Surface Variant | On Surface Variant |
| Focused | Primary (2dp) | Primary |
| Hovered | On Surface | On Surface Variant |
| Error | Error (2dp) | Error |
| Disabled | 12% On Surface | 38% On Surface |

#### Supporting Elements

| Element | Specification |
|---------|---------------|
| Helper text | Body Small, below field, 4dp gap |
| Error text | Body Small, Error color |
| Character count | Body Small, aligned right |
| Leading icon | 24dp, 12dp from start |
| Trailing icon | 24dp, 12dp from end |

---

### Lists

#### List Item Types

| Type | Lines | Height |
|------|-------|--------|
| **One-line** | Headline only | 56dp |
| **Two-line** | Headline + Supporting | 72dp |
| **Three-line** | Headline + Supporting (2 lines) | 88dp |

#### List Item Specifications

| Property | Value |
|----------|-------|
| Horizontal padding | 16dp |
| Vertical padding | 8dp (one-line), 12dp (multi-line) |
| Leading element size | 24dp (icon), 40dp (avatar), 56dp (image) |
| Leading element gap | 16dp |
| Trailing element gap | 16dp |
| Divider | 1dp, inset 16dp (optional) |

#### List Item Layout

```
┌──────────────────────────────────────────────────┐
│ [16dp] [Leading 40dp] [16dp] [Content] [Trailing] [16dp] │
│        ↑ Avatar                                           │
└──────────────────────────────────────────────────┘
```

#### List Text Styles

| Element | Style |
|---------|-------|
| Overline | Label Small |
| Headline | Body Large |
| Supporting text | Body Medium |
| Trailing supporting | Label Small |

#### List Item States

| State | Background |
|-------|------------|
| Enabled | Transparent |
| Hover | 8% On Surface |
| Focused | 10% On Surface |
| Pressed | 12% On Surface |
| Selected | Secondary Container |

---

### Dialogs

#### Dialog Specifications

| Property | Value |
|----------|-------|
| Width | 280dp - 560dp |
| Min width (mobile) | 280dp |
| Max width | 560dp |
| Corner radius | 28dp |
| Padding | 24dp |
| Elevation | Level 3 (6dp) |
| Background | Surface Container Highest |

#### Dialog Layout

```
┌─────────────────────────────────┐
│ [24dp padding]                  │
│                                 │
│ [Optional Icon - 24dp]          │
│ [16dp]                          │
│ [Headline - Headline Small]     │
│ [16dp]                          │
│ [Supporting text - Body Medium] │
│ [24dp]                          │
│                                 │
│ ─────────────────────────────── │ ← Optional divider
│ [Actions - aligned right]       │
│          [Text Btn] [Filled Btn]│
│ [24dp padding]                  │
└─────────────────────────────────┘
```

#### Dialog Action Buttons

| Property | Value |
|----------|-------|
| Alignment | Right-aligned |
| Button type | Text buttons (default) |
| Affirmative position | Right |
| Dismissive position | Left of affirmative |
| Button gap | 8dp |
| Padding from edge | 24dp |

#### Full-Screen Dialog (Mobile)

| Property | Value |
|----------|-------|
| Corner radius | 0dp |
| Top app bar | Include close and action |
| Padding | 24dp horizontal |

---

### Chips

#### Chip Types

| Type | Appearance | Usage |
|------|------------|-------|
| **Assist** | Outlined or elevated | Smart suggestions |
| **Filter** | Selected/unselected | Filtering content |
| **Input** | With remove button | User input, tags |
| **Suggestion** | Outlined | Suggested actions |

#### Chip Specifications

| Property | Value |
|----------|-------|
| Height | 32dp |
| Corner radius | 8dp |
| Horizontal padding | 16dp (text only) |
| Horizontal padding | 8dp (with leading icon) |
| Icon size | 18dp |
| Text style | Label Large |
| Outline | 1dp, Outline color |

#### Chip Layout

```
Text only:
┌────────────────────┐
│ [16dp] [Label] [16dp] │  32dp
└────────────────────┘

With leading icon:
┌─────────────────────────┐
│ [8dp] [Icon] [8dp] [Label] [16dp] │  32dp
└─────────────────────────┘

Input chip with trailing remove:
┌──────────────────────────────────┐
│ [8dp] [Avatar] [8dp] [Label] [8dp] [✕] [8dp] │  32dp
└──────────────────────────────────┘
```

#### Chip States

| State | Container | Text Color |
|-------|-----------|------------|
| Enabled | Transparent + Outline | On Surface |
| Selected | Secondary Container | On Secondary Container |
| Hover | 8% On Surface | On Surface |
| Focused | Focus ring | On Surface |
| Pressed | 12% On Surface | On Surface |
| Disabled | 12% On Surface | 38% On Surface |

---

## Responsive Breakpoints

### Window Size Classes

| Class | Width Range | Columns | Margins |
|-------|-------------|---------|---------|
| **Compact** | 0-599dp | 4 | 16dp |
| **Medium** | 600-839dp | 12 | 24dp |
| **Expanded** | 840-1199dp | 12 | 24dp |
| **Large** | 1200-1599dp | 12 | 24dp |
| **Extra Large** | 1600dp+ | 12 | 24dp |

### Layout Adaptations

| Compact | Medium | Expanded |
|---------|--------|----------|
| Navigation Bar (bottom) | Navigation Rail | Navigation Drawer |
| Full-width cards | 2-column cards | 3+ column cards |
| Stack layouts | Side-by-side | Side-by-side + detail |
| Single pane | List-detail | List-detail-detail |

---

## Motion & Animation

### Duration Scale

| Token | Duration | Usage |
|-------|----------|-------|
| **Short 1** | 50ms | Micro-interactions |
| **Short 2** | 100ms | Simple state changes |
| **Short 3** | 150ms | Hover, selection |
| **Short 4** | 200ms | Small movements |
| **Medium 1** | 250ms | Standard transitions |
| **Medium 2** | 300ms | Component transitions |
| **Medium 3** | 350ms | Page transitions |
| **Medium 4** | 400ms | Complex animations |
| **Long 1** | 450ms | Elaborate animations |
| **Long 2** | 500ms | Very complex |
| **Long 3** | 550ms | Extended sequences |
| **Long 4** | 600ms | Maximum duration |

### Easing Curves

| Token | Curve | Usage |
|-------|-------|-------|
| **Standard** | cubic-bezier(0.2, 0, 0, 1) | Default motion |
| **Standard Decelerate** | cubic-bezier(0, 0, 0, 1) | Entering elements |
| **Standard Accelerate** | cubic-bezier(0.3, 0, 1, 1) | Exiting elements |
| **Emphasized** | cubic-bezier(0.2, 0, 0, 1) | Important transitions |
| **Emphasized Decelerate** | cubic-bezier(0.05, 0.7, 0.1, 1) | Key entrances |
| **Emphasized Accelerate** | cubic-bezier(0.3, 0, 0.8, 0.15) | Key exits |

---

## Accessibility

### Touch Target Requirements

| Requirement | Value |
|-------------|-------|
| Minimum touch target | 48dp x 48dp |
| Minimum spacing between targets | 8dp |

### Color Contrast Requirements

| Content Type | Minimum Ratio |
|--------------|---------------|
| Normal text | 4.5:1 |
| Large text (18sp+) | 3:1 |
| UI components | 3:1 |
| Non-text content | 3:1 |

### Focus Visibility

| Requirement | Specification |
|-------------|---------------|
| Focus indicator | Clearly visible ring |
| Focus ring width | 3dp |
| Focus ring offset | 2dp |
| Focus ring contrast | 3:1 against adjacent colors |

---

## Quick Reference Tables

### Component Heights

| Component | Height |
|-----------|--------|
| Button | 40dp |
| FAB (standard) | 56dp |
| FAB (small) | 40dp |
| FAB (large) | 96dp |
| Text Field | 56dp |
| Search Bar | 56dp |
| Navigation Bar | 80dp |
| Tab (text) | 48dp |
| Tab (icon + text) | 64dp |
| Chip | 32dp |
| List item (1-line) | 56dp |
| List item (2-line) | 72dp |
| List item (3-line) | 88dp |
| Top App Bar | 64dp |

### Common Padding Values

| Context | Value |
|---------|-------|
| Button horizontal | 24dp |
| Card internal | 16dp |
| List item horizontal | 16dp |
| Dialog | 24dp |
| Screen margins (mobile) | 16dp |
| Screen margins (tablet+) | 24dp |
| Icon button touch padding | 12dp |

### Corner Radius Quick Reference

| Component | Radius |
|-----------|--------|
| Buttons | Full (pill) |
| Cards | 12dp |
| Dialogs | 28dp |
| Chips | 8dp |
| Text fields | 4dp |
| FAB (standard) | 16dp |
| Navigation pill | 16dp |
| Search bar | Full (28dp) |
| Bottom sheet | 28dp (top) |

---

## Sources

- [Material Design 3 Official Documentation](https://m3.material.io/)
- [M3 Typography](https://m3.material.io/styles/typography/applying-type)
- [M3 Color System](https://m3.material.io/styles/color/roles)
- [M3 Shape System](https://m3.material.io/styles/shape/corner-radius-scale)
- [M3 Elevation](https://m3.material.io/styles/elevation/applying-elevation)
- [M3 Components](https://m3.material.io/components)
- [M3 Layout](https://m3.material.io/foundations/layout/understanding-layout/spacing)
- [Material 3 in Compose - Android Developers](https://developer.android.com/develop/ui/compose/designsystems/material3)
- [Material Web Typography](https://material-web.dev/theming/typography/)
- [M3 Expressive Updates](https://supercharge.design/blog/material-3-expressive)

---

*Last updated: January 2026*
*Based on Material Design 3 and M3 Expressive specifications*
