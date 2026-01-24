# Material Design 3 (M3) Comprehensive Design Guidelines

> A complete reference for implementing Material Design 3 (Material You) and **Material 3 Expressive** in applications.
> Based on official specifications from [m3.material.io](https://m3.material.io/)

---

## What's New: Material 3 Expressive

**Material 3 Expressive** (M3E) is the latest evolution of Material Design 3, introduced at Google I/O 2025 and rolled out with Android 16. It is not a new generation ("Material 4") but an expansion of Material You, backed by 46 research studies with over 18,000 participants worldwide.

### Key M3 Expressive Features

| Feature | Description |
|---------|-------------|
| **35 New Shapes** | Expanded shape library with shape morphing capabilities |
| **15 New/Updated Components** | Button Groups, FAB Menu, Loading Indicator, Split Button, Toolbars, and more |
| **Fluid Motion** | Shape morphing animations and spring physics |
| **Variable Fonts** | Dynamic typography with customizable font axes |
| **Enhanced Colors** | Deeper tonal palettes with expanded tertiary color support |
| **5 Button Sizes** | XS, S, M, L, XL sizing system for buttons |

### M3 Expressive Timeline

- **May 2025**: Announced at Google I/O 2025
- **September 2025**: Rolled out to Pixel devices with Android 16 QPR1
- **December 2025**: Adopted by major Google apps (Gmail, Chrome, Keep, Docs, Files)

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
   - [Top App Bar](#top-app-bar)
   - [Bottom App Bar](#bottom-app-bar)
   - [Navigation Rail](#navigation-rail)
   - [Navigation Drawer](#navigation-drawer)
   - [Menus](#menus)
   - [Snackbar](#snackbar)
   - [Progress Indicators](#progress-indicators)
   - [Sliders](#sliders)
   - [Switch](#switch)
   - [Checkbox](#checkbox)
   - [Radio Button](#radio-button)
   - [Badges](#badges)
   - [Tooltips](#tooltips)
   - [Bottom Sheets](#bottom-sheets)
   - [Dividers](#dividers)
   - [Segmented Buttons](#segmented-buttons)
   - [Chips](#chips)
   - [Date Picker](#date-picker)
   - [Time Picker](#time-picker)
   - [Scrim](#scrim)
9. [M3 Expressive Components](#m3-expressive-components)
   - [Button Groups](#button-groups)
   - [Split Button](#split-button)
   - [FAB Menu](#fab-menu)
   - [Loading Indicator](#loading-indicator)
   - [Toolbars](#toolbars)
10. [Shape Morphing](#shape-morphing)

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

### M3 Expressive Typography Enhancements

M3 Expressive introduces **variable fonts** for more expressive and dynamic typography.

#### Variable Font Axes

| Axis | Code | Description |
|------|------|-------------|
| **Weight** | wght | Dynamic weight adjustment (100-900) |
| **Width** | wdth | Character width (75%-125%) |
| **Optical Size** | opsz | Automatic optical adjustments |
| **Grade** | GRAD | Fine-tune weight without changing width |

#### Enhanced Type Hierarchy

M3 Expressive emphasizes:
- **Larger headline sizes** for key actions and important content
- **Heavier weights** for improved attention hierarchy
- **Dynamic scaling** based on context and interaction state

```css
/* Variable font example */
font-family: 'Roboto Flex', sans-serif;
font-variation-settings: 'wght' 500, 'wdth' 100;
```

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

### M3 Expressive Color Enhancements

M3 Expressive expands the color system with deeper tonal palettes and enhanced tertiary color support.

#### Expanded Tertiary Palette

| Token | Role | M3 Expressive Enhancement |
|-------|------|---------------------------|
| **Tertiary** | Brand accent | More prominent in UI hierarchy |
| **Tertiary Container** | Accent backgrounds | Expanded usage for visual variety |
| **On Tertiary** | Content on tertiary | Improved contrast options |

#### Deeper Tonal Palettes

M3 Expressive generates more tonal variations for each color role:

| Tone Level | Light Mode | Dark Mode |
|------------|------------|-----------|
| 0 | Black | Black |
| 10 | Darkest | Lightest |
| 20 | Darker | Lighter |
| 30 | Dark | Light |
| 40 | Medium-dark | Medium-light |
| 50 | Medium | Medium |
| 60 | Medium-light | Medium-dark |
| 70 | Light | Dark |
| 80 | Lighter | Darker |
| 90 | Lightest | Darkest |
| 95 | Near white | Near black |
| 99 | Off-white | Off-black |
| 100 | White | White |

#### Dynamic Color Enhancements

```kotlin
// Compose dynamic color with M3 Expressive
val colorScheme = if (dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
    val context = LocalContext.current
    if (darkTheme) dynamicDarkColorScheme(context)
    else dynamicLightColorScheme(context)
} else {
    if (darkTheme) darkColorScheme() else lightColorScheme()
}
```

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

### M3 Expressive Shape Library (35 Shapes)

M3 Expressive introduces an expanded library of **35 distinctive shapes** that enable more diverse interfaces and fluid transitions.

#### Shape Categories

| Category | Examples | Usage |
|----------|----------|-------|
| **Rounded Rectangle** | Standard corners | Buttons, cards, containers |
| **Squircle** | Superellipse curves | Modern app icons, smooth transitions |
| **Pill** | Full radius ends | Tags, chips, toggles |
| **Organic** | Asymmetric curves | Playful, branded elements |
| **Cut Corners** | Chamfered edges | Technical, angular designs |
| **Scalloped** | Wave-like edges | Decorative elements |
| **Clover** | Multi-lobed | Loading indicators, special states |

#### Shape Principles

1. **Shape as Brand Expression**
   - Use consistent shape vocabulary across your app
   - Shapes communicate personality and brand identity

2. **Shape for Visual Rhythm**
   - Contrasting shapes create hierarchy
   - Similar shapes group related elements

3. **Shape for State Communication**
   - Shape changes can indicate interaction states
   - Morphing shapes draw attention to changes

#### Squircle Specifications

The **squircle** (superellipse) is a key M3 Expressive shape:

```css
/* CSS approximation of squircle */
border-radius: 30% / 30%;

/* Or using clip-path for precise squircle */
clip-path: path('...');
```

| Property | Value |
|----------|-------|
| Curvature exponent | ~2.5-4 (vs 2 for ellipse) |
| Visual smoothness | Higher than standard radius |
| Use case | App icons, FABs, modal containers |

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

#### M3 Expressive Button Sizes

M3 Expressive introduces a **5-tier sizing system** for buttons (XS to XL):

| Size | Height | Icon Size | Horizontal Padding | Icon-Label Gap |
|------|--------|-----------|-------------------|----------------|
| **XS** | 28dp | 20dp | 12dp | 4dp |
| **S** | 32dp | 20dp | 16dp | 8dp |
| **M** | 40dp | 24dp | 24dp | 8dp |
| **L** | 48dp | 32dp | 48dp | 12dp |
| **XL** | 56dp | 40dp | 64dp | 16dp |

> **Note**: All sizes maintain a minimum touch target of 48dp.

#### Button Shape Morphing (M3 Expressive)

Buttons can dynamically change shape in response to user input:

| State | Shape Behavior |
|-------|----------------|
| Default | Standard corner radius |
| Pressed | Slight compression with spring animation |
| Selected | Shape morph (e.g., circle to squircle) |
| Loading | Animated shape transformation |

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

### Top App Bar

#### Top App Bar Types

| Type | Height | Usage |
|------|--------|-------|
| **Small** | 64dp | Default, standard screens |
| **Medium** | 112dp | More prominent titles |
| **Large** | 152dp | Hero screens, emphasis |

#### Top App Bar Specifications

| Property | Value |
|----------|-------|
| Height (small) | 64dp |
| Navigation icon | 24dp, 16dp from start |
| Title text style | Title Large (22sp) |
| Action icons | 24dp, 12dp gap between |
| Horizontal padding | 16dp |
| Elevation (scrolled) | Level 2 (3dp) |

#### Top App Bar Layout

```
┌──────────────────────────────────────────────────┐
│ [16dp] [Nav ←] [16dp] [Title...] [Action] [Action] [16dp] │
│                                     24dp    24dp          │
└──────────────────────────────────────────────────┘
                        64dp height
```

---

### Bottom App Bar

> **⚠️ M3 Expressive Deprecation Notice**: The Bottom App Bar is being deprecated in M3 Expressive. Use the new **Docked Toolbar** or **Floating Toolbar** instead. See [Toolbars](#toolbars) section.

#### Specifications (Legacy)

| Property | Value |
|----------|-------|
| Height | 80dp |
| Horizontal padding | 16dp |
| Icon size | 24dp |
| Icon gap | 16dp |
| FAB position | End, overlapping edge |
| Background | Surface Container |
| Elevation | Level 2 (3dp) |

---

### Navigation Rail

#### Specifications

| Property | Value |
|----------|-------|
| Width | 80dp |
| Item height | 56dp |
| Icon size | 24dp |
| Label text style | Label Medium (12sp) |
| Items | 3-7 destinations |
| FAB position | Top, above items |
| Active indicator | 56dp × 32dp, Full radius |

#### Navigation Rail Layout

```
┌────────┐
│  FAB   │ ← Optional
│ [16dp] │
│ [Icon] │
│ [4dp]  │
│ [Label]│
│ [12dp] │
│ [Icon] │
│ [4dp]  │
│ [Label]│
└────────┘
  80dp wide
```

---

### Navigation Drawer

#### Specifications

| Property | Value |
|----------|-------|
| Width | 360dp (max) |
| Corner radius | 0dp (standard), 16dp (modal) |
| Header height | 56dp minimum |
| Item height | 56dp |
| Item horizontal padding | 28dp start, 24dp end |
| Item corner radius | Full (28dp) |
| Icon size | 24dp |
| Icon-to-label gap | 12dp |
| Label text style | Label Large |
| Section divider | 1dp, 16dp vertical padding |

#### Drawer Types

| Type | Behavior | Width |
|------|----------|-------|
| **Standard** | Persistent, pushes content | 256-360dp |
| **Modal** | Overlay, scrim behind | 256-360dp |
| **Bottom** | Slides from bottom (mobile) | Full width |

---

### Menus

#### Menu Specifications

| Property | Value |
|----------|-------|
| Min width | 112dp |
| Max width | 280dp |
| Corner radius | 4dp |
| Elevation | Level 2 (3dp) |
| Vertical padding | 8dp |
| Item height | 48dp |
| Item horizontal padding | 12dp |
| Icon size | 24dp |
| Icon-to-text gap | 12dp |
| Text style | Body Large |
| Divider | 1dp, 8dp vertical margin |

#### Menu Item Layout

```
┌──────────────────────────────────┐
│ [12dp] [Icon 24dp] [12dp] [Label...] [12dp] │  48dp
└──────────────────────────────────┘
```

---

### Snackbar

#### Specifications

| Property | Value |
|----------|-------|
| Min width | 344dp |
| Max width | 672dp (desktop) |
| Height | 48dp (single-line), 68dp (two-line) |
| Corner radius | 4dp |
| Horizontal margin | 8dp from screen edge |
| Bottom margin | 8dp |
| Internal padding | 16dp |
| Text style | Body Medium |
| Action text style | Label Large |
| Action color | Inverse Primary |
| Background | Inverse Surface |
| Text color | Inverse On Surface |

#### Snackbar Layout

```
┌─────────────────────────────────────────┐
│ [16dp] [Message text...] [Action] [16dp] │  48dp
└─────────────────────────────────────────┘
```

#### Snackbar Behavior

| Property | Value |
|----------|-------|
| Default duration | 4 seconds |
| With action duration | 10 seconds |
| Position | Bottom center (mobile), bottom left (desktop) |
| Animation | Fade in from bottom |

---

### Progress Indicators

#### Linear Progress Indicator

| Property | Value |
|----------|-------|
| Height | 4dp |
| Corner radius | 2dp (ends) |
| Track color | Surface Container Highest |
| Indicator color | Primary |
| Gap | 4dp (between indicator and track) |
| Stop indicator | 4dp circle at end |

#### Circular Progress Indicator

| Property | Value |
|----------|-------|
| Size (small) | 24dp |
| Size (medium) | 40dp |
| Size (large) | 48dp |
| Stroke width | 4dp |
| Track color | Surface Container Highest |
| Indicator color | Primary |
| Gap | 4dp at 12 o'clock position |

#### M3 Expressive Progress Indicators

M3 Expressive updates progress indicators with **wavy shapes** for longer processes:

| Variant | Description | Use Case |
|---------|-------------|----------|
| **Standard** | Flat, smooth indicator | Quick operations |
| **Wavy** | Undulating shape animation | Longer processes (5+ seconds) |
| **Thicker** | Increased stroke width | Higher visibility |

> **Note**: For operations under 5 seconds, use the new [Loading Indicator](#loading-indicator) instead of circular progress indicators.

---

### Sliders

#### Slider Specifications

| Property | Value |
|----------|-------|
| Track height | 4dp |
| Track corner radius | 2dp |
| Handle size | 20dp |
| Handle shape | Rounded rectangle or circle |
| Touch target | 48dp |
| Active track color | Primary |
| Inactive track color | Surface Container Highest |
| Handle color | Primary |

#### Slider with Value Label

| Property | Value |
|----------|-------|
| Label width | 28dp minimum |
| Label height | 28dp |
| Label corner radius | 14dp |
| Label text style | Label Medium |
| Label offset | 8dp above handle |

---

### Switch

#### Switch Specifications

| Property | Value |
|----------|-------|
| Width | 52dp |
| Height | 32dp |
| Track corner radius | Full (16dp) |
| Handle size (off) | 16dp |
| Handle size (on) | 24dp |
| Handle offset | 4dp from track edge |
| Icon size (optional) | 16dp |

#### Switch Colors

| State | Track | Handle |
|-------|-------|--------|
| Off | Surface Container Highest | Outline |
| On | Primary | On Primary |
| Disabled Off | Surface Container Highest @ 12% | On Surface @ 38% |
| Disabled On | On Surface @ 12% | Surface @ 100% |

---

### Checkbox

#### Checkbox Specifications

| Property | Value |
|----------|-------|
| Size | 18dp |
| Corner radius | 2dp |
| Stroke width | 2dp |
| Touch target | 48dp |
| Check icon | 12dp |

#### Checkbox States

| State | Container | Icon |
|-------|-----------|------|
| Unchecked | Transparent, Outline border | None |
| Checked | Primary | On Primary (check) |
| Indeterminate | Primary | On Primary (dash) |
| Error | Error | On Error |
| Disabled | On Surface @ 38% | On Surface @ 38% |

---

### Radio Button

#### Radio Button Specifications

| Property | Value |
|----------|-------|
| Size | 20dp |
| Inner circle (selected) | 10dp |
| Stroke width | 2dp |
| Touch target | 48dp |

#### Radio Button States

| State | Outer Circle | Inner Circle |
|-------|--------------|--------------|
| Unselected | On Surface Variant | None |
| Selected | Primary | Primary |
| Disabled | On Surface @ 38% | On Surface @ 38% |

---

### Badges

#### Badge Types

| Type | Usage |
|------|-------|
| **Small** | Status indicator only |
| **Large** | With count or label |

#### Badge Specifications

| Property | Small | Large |
|----------|-------|-------|
| Size | 6dp | 16dp height, min 16dp width |
| Corner radius | Full (3dp) | Full (8dp) |
| Text style | N/A | Label Small |
| Horizontal padding | N/A | 4dp |
| Color | Error | Error |
| Text color | N/A | On Error |

#### Badge Placement

| Property | Value |
|----------|-------|
| Position | Top-right of icon |
| Offset | -4dp from corner |
| Max digits | 3 (999+) |

---

### Tooltips

#### Plain Tooltip

| Property | Value |
|----------|-------|
| Height | 24dp |
| Corner radius | 4dp |
| Horizontal padding | 8dp |
| Text style | Body Small |
| Background | Inverse Surface |
| Text color | Inverse On Surface |
| Max width | 200dp |

#### Rich Tooltip

| Property | Value |
|----------|-------|
| Min width | 200dp |
| Max width | 312dp |
| Corner radius | 12dp |
| Padding | 16dp |
| Title text style | Title Small |
| Body text style | Body Medium |
| Background | Surface Container |
| Elevation | Level 2 (3dp) |

---

### Bottom Sheets

#### Bottom Sheet Types

| Type | Behavior |
|------|----------|
| **Standard** | Non-modal, coexists with content |
| **Modal** | Blocks content, requires scrim |

#### Bottom Sheet Specifications

| Property | Standard | Modal |
|----------|----------|-------|
| Corner radius | 28dp (top) | 28dp (top) |
| Min height | 256dp | 256dp |
| Max height | 90% of screen | 90% of screen |
| Horizontal padding | 16dp | 16dp |
| Top padding | 22dp | 22dp |
| Drag handle width | 32dp | 32dp |
| Drag handle height | 4dp | 4dp |
| Drag handle margin | 22dp top | 22dp top |
| Background | Surface Container Low | Surface Container Low |
| Scrim | None | Scrim @ 32% |
| Elevation | Level 1 | Level 1 |

---

### Dividers

#### Divider Specifications

| Property | Value |
|----------|-------|
| Thickness | 1dp |
| Color | Outline Variant |

#### Divider Types

| Type | Horizontal Inset |
|------|------------------|
| **Full-width** | 0dp |
| **Inset** | 16dp start |
| **Middle inset** | 16dp both sides |

---

### Segmented Buttons

#### Specifications

| Property | Value |
|----------|-------|
| Height | 40dp |
| Min segment width | 48dp |
| Corner radius | Full (20dp) |
| Border | 1dp, Outline |
| Icon size | 18dp |
| Text style | Label Large |
| Horizontal padding | 12dp |
| Icon-to-text gap | 8dp |
| Segments | 2-5 |

#### Segmented Button States

| State | Container | Content |
|-------|-----------|---------|
| Unselected | Transparent | On Surface |
| Selected | Secondary Container | On Secondary Container |
| Disabled | Transparent | On Surface @ 38% |

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

### Date Picker

#### Date Picker Types

| Type | Usage |
|------|-------|
| **Docked** | Inline, embedded in layout |
| **Modal** | Overlay dialog |
| **Input** | Text field with picker |

#### Date Picker Specifications

| Property | Value |
|----------|-------|
| Width (modal) | 328dp |
| Header height | 120dp |
| Day cell size | 40dp |
| Day cell touch target | 48dp |
| Corner radius (modal) | 28dp |
| Title text style | Label Large |
| Selected date text style | Headline Large |
| Day text style | Body Large |
| Month navigation icon | 24dp |
| Horizontal padding | 12dp |
| Vertical padding | 16dp |

#### Date Picker Colors

| Element | Color |
|---------|-------|
| Header background | Surface Container High |
| Selected day | Primary |
| Selected day text | On Primary |
| Today indicator | Primary (outline) |
| Day in range | Secondary Container |

---

### Time Picker

#### Time Picker Types

| Type | Usage |
|------|-------|
| **Dial** | Clock face selection |
| **Input** | Keyboard entry |

#### Time Picker Specifications

| Property | Value |
|----------|-------|
| Width (modal) | 328dp |
| Clock dial size | 256dp |
| Clock center dot | 8dp |
| Hour/minute selector | 48dp |
| AM/PM toggle height | 72dp |
| Corner radius (modal) | 28dp |
| Title text style | Label Medium |
| Time text style | Display Large |

---

### Scrim

#### Scrim Specifications

| Property | Value |
|----------|-------|
| Color | Scrim (neutral) |
| Opacity | 32% |
| z-index | Above content, below modal |

#### Scrim Usage

| Component | Scrim Required |
|-----------|----------------|
| Modal dialog | Yes |
| Modal bottom sheet | Yes |
| Modal navigation drawer | Yes |
| Modal side sheet | Yes |
| Standard bottom sheet | No |
| Menu | No |

---

## M3 Expressive Components

These components are new or significantly updated in Material 3 Expressive.

### Button Groups

Button Groups are containers that apply unified shape, motion, and width changes to groups of buttons.

#### Button Group Specifications

| Property | Value |
|----------|-------|
| Minimum buttons | 2 |
| Maximum buttons | 5 |
| Gap between buttons | 0dp (connected) or 8dp (separated) |
| Corner radius | Applied to group ends only (connected) |
| Available sizes | XS, S, M, L, XL |

#### Button Group Layout

```
Connected style:
┌──────────────────────────────────┐
│ [Button 1] │ [Button 2] │ [Button 3] │
└──────────────────────────────────┘
   ↑ Rounded    Square    Rounded ↑
   corners     corners    corners
```

#### Button Group Behavior

| Interaction | Behavior |
|-------------|----------|
| Single selection | One button active at a time |
| Multi selection | Multiple buttons can be active |
| Shape morphing | Active button can morph on selection |

---

### Split Button

Split buttons combine a primary action with a dropdown menu for additional options.

#### Split Button Specifications

| Property | Value |
|----------|-------|
| Heights | XS: 28dp, S: 32dp, M: 40dp, L: 48dp, XL: 56dp |
| Divider | 1dp vertical line |
| Menu indicator | Chevron/arrow icon |
| Styles | Elevated, Filled, Tonal, Outlined |
| Touch target | 48dp minimum per segment |

#### Split Button Layout

```
┌─────────────────────────────────┐
│ [Icon] [Primary Label] │ [▼] │
└─────────────────────────────────┘
         Primary action    Menu
```

#### Split Button States

| State | Primary Segment | Menu Segment |
|-------|-----------------|--------------|
| Default | Standard appearance | Chevron down |
| Menu open | Standard | Chevron rotates, shape morphs to circle (M/L/XL) |
| Pressed | State layer 12% | State layer 12% |
| Disabled | 38% opacity | 38% opacity |

> **Size Note**: For XS/SM sizes, the trailing segment uses a fixed width of 48dp instead of morphing to a circle.

---

### FAB Menu

The FAB Menu replaces speed dials and stacked small FABs with a more expressive menu system.

#### FAB Menu Specifications

| Property | Value |
|----------|-------|
| Trigger | Standard or Extended FAB |
| Menu items | 3-6 actions |
| Item size | Large touch targets |
| Corner radius | Matches expanded container |
| Elevation | Level 3 (6dp) |
| Animation | Expands from FAB position |

#### FAB Menu Layout

```
Collapsed:           Expanded:
┌─────┐              ┌─────────────────┐
│ FAB │   →→→        │ [Icon] Action 1 │
└─────┘              │ [Icon] Action 2 │
                     │ [Icon] Action 3 │
                     │ [Icon] Action 4 │
                     │─────────────────│
                     │      [✕]        │
                     └─────────────────┘
```

#### FAB Menu Colors

| Element | Color |
|---------|-------|
| Container | Primary Container |
| Icons | On Primary Container |
| Labels | On Primary Container |
| Scrim | 32% black overlay |

---

### Loading Indicator

The Loading Indicator is a looping shape morph animation designed for operations under 5 seconds.

#### Loading Indicator Specifications

| Property | Value |
|----------|-------|
| Size | 48dp (default) |
| Animation | 7 unique M3 shape morphs |
| Duration | ~2 seconds per loop |
| Color | Primary (default) |
| Use case | Pull-to-refresh, short waits |

#### Loading Indicator Usage

| Context | Implementation |
|---------|----------------|
| Pull-to-refresh | Inside `PullToRefreshBox` container |
| Page loading | Centered in container |
| Button loading | Replaces button content |
| Browser tab | Replaces favicon |
| App launch | Boot screen indicator |

#### Loading Indicator vs Progress Indicator

| Indicator | Duration | Shape | Use Case |
|-----------|----------|-------|----------|
| **Loading Indicator** | < 5 seconds | Morphing shapes | Quick operations |
| **Circular Progress** | > 5 seconds | Circle with track | Longer processes |
| **Linear Progress** | Any | Horizontal bar | Determinate progress |

```kotlin
// Compose implementation
@ExperimentalMaterial3ExpressiveApi
LoadingIndicator(
    modifier = Modifier.size(48.dp),
    color = MaterialTheme.colorScheme.primary
)
```

---

### Toolbars

Toolbars replace the deprecated Bottom App Bar with more flexible options.

#### Toolbar Types

| Type | Description | Use Case |
|------|-------------|----------|
| **Docked Toolbar** | Fixed to screen edge | Primary actions, navigation |
| **Floating Toolbar** | Floats above content | Contextual actions, flexible placement |

#### Docked Toolbar Specifications

| Property | Value |
|----------|-------|
| Height | 64dp (shorter than Bottom App Bar) |
| Horizontal padding | 16dp |
| Icon size | 24dp |
| Icon gap | 16dp |
| Corner radius | 0dp (edge-to-edge) |
| Background | Surface Container |
| Elevation | Level 2 (3dp) |
| Max actions | 4-5 icons |

#### Floating Toolbar Specifications

| Property | Value |
|----------|-------|
| Height | 48-56dp |
| Corner radius | Full (pill-shaped) |
| Horizontal margin | 16dp from edges |
| Vertical position | Flexible (top, bottom, or contextual) |
| Background | Surface Container High |
| Elevation | Level 3 (6dp) |
| Max actions | 3-6 icons |

#### Toolbar Layout

```
Docked Toolbar:
┌────────────────────────────────────────────────┐
│ [16dp] [Icon] [Icon] [Icon] [───] [FAB] [16dp] │  64dp
└────────────────────────────────────────────────┘

Floating Toolbar:
        ┌────────────────────────────────┐
        │ [Icon] [Icon] [Icon] │ [Icon] │  48dp
        └────────────────────────────────┘
              ↑ Rounded ends (pill shape)
```

---

## Shape Morphing

Shape morphing is a core M3 Expressive animation technique where UI elements smoothly transition between different shapes.

### Shape Morphing Principles

1. **Continuous Transformation**
   - Vertices interpolate smoothly between shapes
   - No discrete state jumps

2. **Matching Vertex Counts**
   - Shapes should have compatible vertex structures
   - Or use algorithmic vertex matching

3. **Timing Considerations**
   - Quick morphs (100-200ms) for direct feedback
   - Longer morphs (300-500ms) for emphasis

### Common Shape Morph Transitions

| Transition | From | To | Use Case |
|------------|------|-----|----------|
| **Activation** | Circle | Squircle | FAB press, icon activation |
| **Selection** | Rectangle | Rounded Rectangle | List item selection |
| **Expansion** | Compact | Expanded | Search bar, menus |
| **Loading** | Shape sequence | 7 M3 shapes | Loading indicator |

### Implementation Example

```kotlin
// Compose shape morphing with shared elements
@OptIn(ExperimentalSharedTransitionApi::class)
SharedTransitionLayout {
    AnimatedContent(targetState = expanded) { isExpanded ->
        if (isExpanded) {
            ExpandedContent(
                modifier = Modifier.sharedBounds(
                    sharedContentState = rememberSharedContentState("container"),
                    animatedVisibilityScope = this
                )
            )
        } else {
            CollapsedContent(
                modifier = Modifier.sharedBounds(
                    sharedContentState = rememberSharedContentState("container"),
                    animatedVisibilityScope = this
                )
            )
        }
    }
}
```

### Shape Morphing Best Practices

| Do | Don't |
|----|-------|
| Use for meaningful state changes | Morph for decorative purposes only |
| Keep transitions under 500ms | Create distracting long animations |
| Match brand shape language | Mix incompatible shape styles |
| Test on lower-end devices | Assume smooth performance everywhere |

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

### M3 Expressive Motion System

M3 Expressive introduces **fluid motion** with shape morphing and spring physics.

#### Spring Animations

| Parameter | Light | Medium | Heavy |
|-----------|-------|--------|-------|
| **Stiffness** | 200 | 400 | 800 |
| **Damping Ratio** | 0.7 | 0.8 | 0.9 |
| **Use Case** | Playful bounces | Standard interactions | Snappy responses |

```kotlin
// Compose spring animation example
spring(
    dampingRatio = Spring.DampingRatioMediumBouncy,
    stiffness = Spring.StiffnessMedium
)
```

#### Shape Morphing Principles

1. **Continuous Transformation**
   - Shapes flow smoothly between states
   - No abrupt changes or jumps

2. **Physics-Based Motion**
   - Spring animations create natural movement
   - Overshoot and settle for organic feel

3. **Context-Aware Duration**
   - Shorter morphs for quick feedback (100-200ms)
   - Longer morphs for emphasis (300-500ms)

#### Common Shape Morph Patterns

| Pattern | From → To | Use Case |
|---------|-----------|----------|
| **Circle to Squircle** | ● → ◼ | FAB expansion |
| **Pill to Rectangle** | ⬭ → ▭ | Search bar activation |
| **Sharp to Rounded** | ▢ → ◼ | Selection state |
| **Compress/Expand** | Scale down → up | Press feedback |

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
| Button (XS - M3E) | 28dp |
| Button (S - M3E) | 32dp |
| Button (L - M3E) | 48dp |
| Button (XL - M3E) | 56dp |
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
| Top App Bar (small) | 64dp |
| Top App Bar (medium) | 112dp |
| Top App Bar (large) | 152dp |
| Bottom App Bar (deprecated) | 80dp |
| Docked Toolbar (M3E) | 64dp |
| Floating Toolbar (M3E) | 48-56dp |
| Navigation Rail | 80dp wide |
| Navigation Drawer item | 56dp |
| Menu item | 48dp |
| Snackbar (single-line) | 48dp |
| Snackbar (two-line) | 68dp |
| Switch | 32dp |
| Checkbox | 18dp (48dp touch) |
| Radio Button | 20dp (48dp touch) |
| Segmented Button | 40dp |
| Slider handle | 20dp (48dp touch) |
| Progress (linear) | 4dp |
| Progress (circular) | 24-48dp |
| Loading Indicator (M3E) | 48dp |
| Badge (small) | 6dp |
| Badge (large) | 16dp |
| Tooltip (plain) | 24dp |
| Divider | 1dp |

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
| Menu | 4dp |
| Snackbar | 4dp |
| Switch track | Full (16dp) |
| Checkbox | 2dp |
| Segmented buttons | Full (20dp) |
| Tooltip (plain) | 4dp |
| Tooltip (rich) | 12dp |
| Navigation drawer item | Full (28dp) |
| Slider label | 14dp |
| Progress bar | 2dp |

---

## Sources

### Official Material Design Resources
- [Material Design 3 Official Documentation](https://m3.material.io/)
- [M3 Typography](https://m3.material.io/styles/typography/applying-type)
- [M3 Color System](https://m3.material.io/styles/color/roles)
- [M3 Color Schemes](https://m3.material.io/styles/color/choosing-a-scheme)
- [M3 Shape System](https://m3.material.io/styles/shape/corner-radius-scale)
- [M3 Shape Morphing](https://m3.material.io/styles/shape/shape-morph)
- [M3 Elevation](https://m3.material.io/styles/elevation/applying-elevation)
- [M3 Components](https://m3.material.io/components)
- [M3 All Buttons](https://m3.material.io/components/all-buttons)
- [M3 Button Groups](https://m3.material.io/components/button-groups/specs)
- [M3 Loading Indicator](https://m3.material.io/components/loading-indicator)
- [M3 Layout](https://m3.material.io/foundations/layout/understanding-layout/spacing)
- [Building with M3 Expressive](https://m3.material.io/blog/building-with-m3-expressive)

### Developer Resources
- [Material 3 in Compose - Android Developers](https://developer.android.com/develop/ui/compose/designsystems/material3)
- [M3 Expressive for Wear OS](https://developer.android.com/design/ui/wear/guides/get-started/apply)
- [Pull to Refresh in Compose](https://developer.android.com/develop/ui/compose/components/pull-to-refresh)
- [Material Web Typography](https://material-web.dev/theming/typography/)

### M3 Expressive Coverage
- [M3 Expressive: What's New and Why it Matters](https://supercharge.design/blog/material-3-expressive)
- [M3 Expressive Deep Dive](https://www.androidauthority.com/google-material-3-expressive-features-changes-availability-supported-devices-3556392/)
- [Google I/O 2025: Build with M3 Expressive](https://io.google/2025/explore/technical-session-24)
- [Google Official M3 Expressive Announcement](https://blog.google/products-and-platforms/platforms/android/material-3-expressive-android-wearos-launch/)
- [9to5Google M3 Expressive Guide](https://9to5google.com/guides/material-3-expressive/)

---

*Last updated: January 2026*
*Based on Material Design 3 and M3 Expressive specifications (Android 16, September 2025 rollout)*
