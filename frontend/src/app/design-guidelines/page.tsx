"use client";
import React, { useState } from 'react';
import Header from '@/app/projects/components/Header';
import { Card } from '@/components/ui/Card';

type TabId = 'overview' | 'typography' | 'color' | 'spacing' | 'shape' | 'elevation' | 'components' | 'states';

interface SpecRow {
  token: string;
  size: string;
  lineHeight: string;
  weight: string;
  letterSpacing: string;
}

interface ColorRole {
  token: string;
  role: string;
  usage: string;
}

interface SpacingRow {
  token: string;
  value: string;
  usage: string;
}

interface ShapeRow {
  token: string;
  value: string;
  usage: string;
}

interface ElevationRow {
  level: string;
  value: string;
  usage: string;
}

interface ComponentSpec {
  property: string;
  value: string;
}

export default function DesignGuidelinesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'typography', label: 'Typography' },
    { id: 'color', label: 'Color System' },
    { id: 'spacing', label: 'Spacing & Layout' },
    { id: 'shape', label: 'Shape' },
    { id: 'elevation', label: 'Elevation' },
    { id: 'components', label: 'Components' },
    { id: 'states', label: 'States' },
  ];

  // Typography specifications
  const typeScale: SpecRow[] = [
    { token: 'Display Large', size: '57sp', lineHeight: '64sp', weight: '400', letterSpacing: '-0.25sp' },
    { token: 'Display Medium', size: '45sp', lineHeight: '52sp', weight: '400', letterSpacing: '0sp' },
    { token: 'Display Small', size: '36sp', lineHeight: '44sp', weight: '400', letterSpacing: '0sp' },
    { token: 'Headline Large', size: '32sp', lineHeight: '40sp', weight: '400', letterSpacing: '0sp' },
    { token: 'Headline Medium', size: '28sp', lineHeight: '36sp', weight: '400', letterSpacing: '0sp' },
    { token: 'Headline Small', size: '24sp', lineHeight: '32sp', weight: '400', letterSpacing: '0sp' },
    { token: 'Title Large', size: '22sp', lineHeight: '28sp', weight: '400', letterSpacing: '0sp' },
    { token: 'Title Medium', size: '16sp', lineHeight: '24sp', weight: '500', letterSpacing: '0.15sp' },
    { token: 'Title Small', size: '14sp', lineHeight: '20sp', weight: '500', letterSpacing: '0.1sp' },
    { token: 'Body Large', size: '16sp', lineHeight: '24sp', weight: '400', letterSpacing: '0.5sp' },
    { token: 'Body Medium', size: '14sp', lineHeight: '20sp', weight: '400', letterSpacing: '0.25sp' },
    { token: 'Body Small', size: '12sp', lineHeight: '16sp', weight: '400', letterSpacing: '0.4sp' },
    { token: 'Label Large', size: '14sp', lineHeight: '20sp', weight: '500', letterSpacing: '0.1sp' },
    { token: 'Label Medium', size: '12sp', lineHeight: '16sp', weight: '500', letterSpacing: '0.5sp' },
    { token: 'Label Small', size: '11sp', lineHeight: '16sp', weight: '500', letterSpacing: '0.5sp' },
  ];

  // Color roles
  const primaryColors: ColorRole[] = [
    { token: 'Primary', role: 'Key color', usage: 'High-emphasis buttons, active states, links' },
    { token: 'On Primary', role: 'Text/icons on primary', usage: 'Content displayed on primary color' },
    { token: 'Primary Container', role: 'Less prominent containers', usage: 'Filled tonal buttons, chips' },
    { token: 'On Primary Container', role: 'Text/icons on container', usage: 'Content on primary container' },
  ];

  const secondaryColors: ColorRole[] = [
    { token: 'Secondary', role: 'Accent color', usage: 'Filter chips, switches' },
    { token: 'On Secondary', role: 'Text/icons on secondary', usage: 'Content on secondary' },
    { token: 'Secondary Container', role: 'Subtle containers', usage: 'Less prominent chips, toggles' },
    { token: 'On Secondary Container', role: 'Text/icons on container', usage: 'Content on secondary container' },
  ];

  const surfaceColors: ColorRole[] = [
    { token: 'Surface', role: 'Main background', usage: 'Primary app background' },
    { token: 'Surface Dim', role: 'Dimmed surface', usage: 'De-emphasized backgrounds' },
    { token: 'Surface Container', role: 'Standard container', usage: 'Cards, dialogs' },
    { token: 'Surface Container High', role: 'Higher level', usage: 'Elevated containers' },
    { token: 'On Surface', role: 'Primary text', usage: 'Main text color' },
    { token: 'On Surface Variant', role: 'Secondary text', usage: 'Supporting text' },
  ];

  // Spacing scale
  const spacingScale: SpacingRow[] = [
    { token: 'None', value: '0dp', usage: 'No spacing' },
    { token: 'Extra Small', value: '4dp', usage: 'Tight grouping, icon padding' },
    { token: 'Small', value: '8dp', usage: 'Related elements, chips' },
    { token: 'Medium', value: '16dp', usage: 'Standard margins, padding' },
    { token: 'Large', value: '24dp', usage: 'Section spacing, card padding' },
    { token: 'Extra Large', value: '32dp', usage: 'Major sections' },
    { token: '2XL', value: '48dp', usage: 'Large gaps' },
    { token: '3XL', value: '64dp', usage: 'Hero sections' },
  ];

  // Shape scale
  const shapeScale: ShapeRow[] = [
    { token: 'None', value: '0dp', usage: 'Sharp corners' },
    { token: 'Extra Small', value: '4dp', usage: 'Text fields, small buttons' },
    { token: 'Small', value: '8dp', usage: 'Chips, outlined cards' },
    { token: 'Medium', value: '12dp', usage: 'Cards (elevated/filled)' },
    { token: 'Large', value: '16dp', usage: 'FAB, navigation' },
    { token: 'Extra Large', value: '28dp', usage: 'Dialogs, sheets' },
    { token: 'Full', value: '50% / 9999dp', usage: 'Pills, avatars, buttons' },
  ];

  // Elevation levels
  const elevationLevels: ElevationRow[] = [
    { level: 'Level 0', value: '0dp', usage: 'Flat surfaces, filled buttons' },
    { level: 'Level 1', value: '1dp', usage: 'Elevated cards, filled inputs' },
    { level: 'Level 2', value: '3dp', usage: 'Elevated buttons, cards on hover' },
    { level: 'Level 3', value: '6dp', usage: 'FABs, menus' },
    { level: 'Level 4', value: '8dp', usage: 'Navigation drawers' },
    { level: 'Level 5', value: '12dp', usage: 'Dialogs, modals' },
  ];

  // Button specs
  const buttonSpecs: ComponentSpec[] = [
    { property: 'Height', value: '40dp' },
    { property: 'Minimum width', value: '64dp' },
    { property: 'Corner radius', value: 'Full (20dp for 40dp height)' },
    { property: 'Horizontal padding (text only)', value: '24dp' },
    { property: 'Horizontal padding (with icon)', value: '16dp' },
    { property: 'Icon-to-label gap', value: '8dp' },
    { property: 'Icon size', value: '18dp' },
    { property: 'Text style', value: 'Label Large' },
    { property: 'Text case', value: 'Sentence case' },
  ];

  // Card specs
  const cardSpecs: ComponentSpec[] = [
    { property: 'Corner radius', value: '12dp' },
    { property: 'Internal padding', value: '16dp' },
    { property: 'Outline (outlined)', value: '1dp, Outline Variant' },
    { property: 'Elevation (elevated)', value: 'Level 1 (1dp)' },
    { property: 'Elevation (filled)', value: 'Level 0' },
  ];

  // Navigation bar specs
  const navBarSpecs: ComponentSpec[] = [
    { property: 'Height', value: '80dp' },
    { property: 'Icon size', value: '24dp' },
    { property: 'Label text style', value: 'Label Medium (12sp)' },
    { property: 'Items', value: '3-5 destinations' },
    { property: 'Active indicator width', value: '64dp' },
    { property: 'Active indicator height', value: '32dp' },
    { property: 'Active indicator radius', value: 'Full (16dp)' },
  ];

  // Tab specs
  const tabSpecs: ComponentSpec[] = [
    { property: 'Height (text only)', value: '48dp' },
    { property: 'Height (with icon)', value: '64dp' },
    { property: 'Minimum width', value: '90dp' },
    { property: 'Maximum width', value: '360dp' },
    { property: 'Horizontal padding', value: '16dp' },
    { property: 'Indicator height', value: '3dp' },
    { property: 'Text style', value: 'Title Small (14sp, Medium)' },
    { property: 'Icon size', value: '24dp' },
  ];

  // Search bar specs
  const searchBarSpecs: ComponentSpec[] = [
    { property: 'Height', value: '56dp' },
    { property: 'Corner radius', value: 'Full (28dp)' },
    { property: 'Horizontal padding', value: '16dp' },
    { property: 'Icon size', value: '24dp' },
    { property: 'Text style', value: 'Body Large' },
  ];

  // Text field specs
  const textFieldSpecs: ComponentSpec[] = [
    { property: 'Height', value: '56dp' },
    { property: 'Corner radius (filled)', value: '4dp (top only)' },
    { property: 'Corner radius (outlined)', value: '4dp (all)' },
    { property: 'Horizontal padding', value: '16dp' },
    { property: 'Label text style', value: 'Body Small (floating)' },
    { property: 'Input text style', value: 'Body Large' },
    { property: 'Indicator line (filled)', value: '1dp (inactive), 2dp (active)' },
  ];

  // Chip specs
  const chipSpecs: ComponentSpec[] = [
    { property: 'Height', value: '32dp' },
    { property: 'Corner radius', value: '8dp' },
    { property: 'Horizontal padding (text only)', value: '16dp' },
    { property: 'Horizontal padding (with icon)', value: '8dp' },
    { property: 'Icon size', value: '18dp' },
    { property: 'Text style', value: 'Label Large' },
    { property: 'Outline', value: '1dp, Outline color' },
  ];

  // Dialog specs
  const dialogSpecs: ComponentSpec[] = [
    { property: 'Min width', value: '280dp' },
    { property: 'Max width', value: '560dp' },
    { property: 'Corner radius', value: '28dp' },
    { property: 'Padding', value: '24dp' },
    { property: 'Elevation', value: 'Level 3 (6dp)' },
    { property: 'Button alignment', value: 'Right-aligned' },
    { property: 'Button gap', value: '8dp' },
  ];

  // State opacities
  const stateOpacities = [
    { state: 'Enabled', opacity: '0%', description: 'Default state' },
    { state: 'Hover', opacity: '8%', description: 'Cursor over element' },
    { state: 'Focus', opacity: '10%', description: 'Keyboard focus' },
    { state: 'Pressed', opacity: '10-12%', description: 'Active touch/click' },
    { state: 'Dragged', opacity: '16%', description: 'Being dragged' },
    { state: 'Disabled (container)', opacity: '12%', description: 'Not interactive' },
    { state: 'Disabled (content)', opacity: '38%', description: 'Reduced visibility' },
  ];

  const renderTable = (headers: string[], rows: (string | React.ReactNode)[][]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-ui-body">
        <thead>
          <tr className="border-b border-border">
            {headers.map((header, i) => (
              <th key={i} className="text-ui-label py-3 px-4 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-surface-muted/50">
              {row.map((cell, j) => (
                <td key={j} className="py-3 px-4">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderSpecTable = (specs: ComponentSpec[]) => renderTable(
    ['Property', 'Value'],
    specs.map(s => [s.property, <code key={s.property} className="text-accent">{s.value}</code>])
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-[1200px] mx-auto px-4 py-8">
        <Card className="p-8 space-y-6">
          <div>
            <h1 className="text-ui-page text-2xl font-semibold">Material Design 3 Guidelines</h1>
            <p className="text-ui-muted mt-2">
              Comprehensive design system reference based on{' '}
              <a href="https://m3.material.io/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                Material Design 3
              </a>
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 border-b border-border pb-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full text-ui-tab transition-colors ${
                  activeTab === tab.id
                    ? 'bg-accent text-white'
                    : 'bg-surface-muted hover:bg-surface-strong text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Material Design 3 Overview</h2>
                <p className="text-ui-body">
                  Material Design 3 (M3), also known as Material You, is Google&apos;s latest design system that emphasizes
                  personalization, accessibility, and expressive design. It introduces dynamic color, updated typography,
                  and refined component specifications.
                </p>
                <div className="grid gap-4 md:grid-cols-3 mt-6">
                  <div className="p-4 bg-surface-muted rounded-lg">
                    <h3 className="text-ui-title font-semibold mb-2">Token-Based</h3>
                    <p className="text-ui-muted text-sm">Semantic tokens separate design values from implementation, enabling easy theming.</p>
                  </div>
                  <div className="p-4 bg-surface-muted rounded-lg">
                    <h3 className="text-ui-title font-semibold mb-2">Dynamic Color</h3>
                    <p className="text-ui-muted text-sm">Colors adapt based on user preferences and content, creating personalized experiences.</p>
                  </div>
                  <div className="p-4 bg-surface-muted rounded-lg">
                    <h3 className="text-ui-title font-semibold mb-2">Accessible</h3>
                    <p className="text-ui-muted text-sm">Built-in contrast ratios and touch targets ensure usability for all users.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Quick Reference</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="text-ui-label text-xs uppercase mb-2">Button Height</h3>
                    <p className="text-2xl font-semibold text-accent">40dp</p>
                  </div>
                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="text-ui-label text-xs uppercase mb-2">Card Radius</h3>
                    <p className="text-2xl font-semibold text-accent">12dp</p>
                  </div>
                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="text-ui-label text-xs uppercase mb-2">Touch Target</h3>
                    <p className="text-2xl font-semibold text-accent">48dp</p>
                  </div>
                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="text-ui-label text-xs uppercase mb-2">Base Spacing</h3>
                    <p className="text-2xl font-semibold text-accent">8dp</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Component Heights at a Glance</h2>
                {renderTable(
                  ['Component', 'Height'],
                  [
                    ['Button', '40dp'],
                    ['FAB (standard)', '56dp'],
                    ['FAB (small)', '40dp'],
                    ['FAB (large)', '96dp'],
                    ['Text Field', '56dp'],
                    ['Search Bar', '56dp'],
                    ['Navigation Bar', '80dp'],
                    ['Tab (text only)', '48dp'],
                    ['Tab (with icon)', '64dp'],
                    ['Chip', '32dp'],
                    ['List item (1-line)', '56dp'],
                    ['List item (2-line)', '72dp'],
                    ['List item (3-line)', '88dp'],
                    ['Top App Bar', '64dp'],
                  ]
                )}
              </section>
            </div>
          )}

          {/* Typography Tab */}
          {activeTab === 'typography' && (
            <div className="space-y-8">
              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Type Scale</h2>
                <p className="text-ui-muted">
                  M3 uses Roboto as the default font with a 15-token type scale organized into 5 categories (Display, Headline, Title, Body, Label),
                  each with 3 sizes (Large, Medium, Small).
                </p>
                {renderTable(
                  ['Token', 'Size', 'Line Height', 'Weight', 'Letter Spacing'],
                  typeScale.map(t => [
                    <span key={t.token} className="font-medium">{t.token}</span>,
                    <code key={`${t.token}-size`} className="text-accent">{t.size}</code>,
                    t.lineHeight,
                    t.weight,
                    t.letterSpacing
                  ])
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Typography Usage</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="text-ui-title font-semibold">Display</h3>
                    <p className="text-ui-muted text-sm">Hero text, large numerals. Short text only; best for wide screens.</p>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-ui-title font-semibold">Headline</h3>
                    <p className="text-ui-muted text-sm">Screen titles, section headers. High-emphasis short text.</p>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-ui-title font-semibold">Title</h3>
                    <p className="text-ui-muted text-sm">Subheadings, card headers. Medium-emphasis text.</p>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-ui-title font-semibold">Body</h3>
                    <p className="text-ui-muted text-sm">Long-form text, paragraphs. Primary readable text.</p>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-ui-title font-semibold">Label</h3>
                    <p className="text-ui-muted text-sm">Buttons, tags, captions. Small, utility text.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Font Weights</h2>
                {renderTable(
                  ['Weight Name', 'Value', 'Usage'],
                  [
                    ['Regular', '400', 'Display, Headline, Body'],
                    ['Medium', '500', 'Title (Medium, Small), Label'],
                    ['Semi-Bold', '600', 'Emphasized text (optional)'],
                    ['Bold', '700', 'Heavy emphasis (optional)'],
                  ]
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">CSS Token Naming</h2>
                <pre className="bg-surface-muted p-4 rounded-lg text-sm overflow-x-auto">
{`--md-sys-typescale-{category}-{size}-{property}

/* Examples */
--md-sys-typescale-body-medium-size: 14px;
--md-sys-typescale-body-medium-line-height: 20px;
--md-sys-typescale-body-medium-weight: 400;
--md-sys-typescale-body-medium-tracking: 0.25px;`}
                </pre>
              </section>
            </div>
          )}

          {/* Color Tab */}
          {activeTab === 'color' && (
            <div className="space-y-8">
              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Color Architecture</h2>
                <p className="text-ui-muted">
                  M3 uses a token-based color system that separates semantic roles from actual color values,
                  enabling seamless light/dark mode transitions.
                </p>
                <div className="bg-surface-muted p-4 rounded-lg font-mono text-sm">
                  Reference Tokens → System Tokens → Component Tokens<br/>
                  (blue-500) → (primary) → (button-container)
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Primary Colors</h2>
                {renderTable(
                  ['Token', 'Role', 'Usage'],
                  primaryColors.map(c => [
                    <span key={c.token} className="font-medium">{c.token}</span>,
                    c.role,
                    c.usage
                  ])
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Secondary Colors</h2>
                {renderTable(
                  ['Token', 'Role', 'Usage'],
                  secondaryColors.map(c => [
                    <span key={c.token} className="font-medium">{c.token}</span>,
                    c.role,
                    c.usage
                  ])
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Surface & Background</h2>
                {renderTable(
                  ['Token', 'Role', 'Usage'],
                  surfaceColors.map(c => [
                    <span key={c.token} className="font-medium">{c.token}</span>,
                    c.role,
                    c.usage
                  ])
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Color Application Rules</h2>
                <ul className="list-disc pl-5 text-ui-muted space-y-2">
                  <li><strong>Use semantic tokens, not literal colors</strong> — Button isn&apos;t &quot;blue&quot;, it&apos;s &quot;primary&quot;</li>
                  <li><strong>Pairing rules for accessibility</strong> — Use on-primary on primary, on-primary-container on primary-container</li>
                  <li><strong>Normal text contrast</strong> — Minimum 4.5:1 ratio</li>
                  <li><strong>Large text contrast</strong> — Minimum 3:1 ratio (18sp+ or 14sp+ bold)</li>
                  <li><strong>UI components</strong> — Minimum 3:1 ratio against adjacent colors</li>
                </ul>
              </section>
            </div>
          )}

          {/* Spacing Tab */}
          {activeTab === 'spacing' && (
            <div className="space-y-8">
              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Baseline Grid</h2>
                <p className="text-ui-muted">
                  M3 uses an <strong>8dp baseline grid</strong> for all measurements. Smaller elements use a 4dp grid.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Spacing Scale</h2>
                {renderTable(
                  ['Token', 'Value', 'Usage'],
                  spacingScale.map(s => [
                    <span key={s.token} className="font-medium">{s.token}</span>,
                    <code key={`${s.token}-value`} className="text-accent">{s.value}</code>,
                    s.usage
                  ])
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Margin Guidelines</h2>
                {renderTable(
                  ['Context', 'Margin'],
                  [
                    ['Screen edge (mobile)', '16dp'],
                    ['Screen edge (tablet)', '24dp'],
                    ['Screen edge (desktop)', '24-40dp'],
                    ['Content within cards', '16dp'],
                    ['Between cards', '8dp'],
                  ]
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Touch Targets</h2>
                {renderTable(
                  ['Type', 'Size'],
                  [
                    ['Minimum touch target', '48dp × 48dp'],
                    ['Dense touch target', '40dp × 40dp'],
                    ['Icon tap area (24dp icon)', '48dp'],
                    ['Minimum spacing between targets', '8dp'],
                  ]
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Responsive Breakpoints</h2>
                {renderTable(
                  ['Class', 'Width Range', 'Columns', 'Margins'],
                  [
                    ['Compact', '0-599dp', '4', '16dp'],
                    ['Medium', '600-839dp', '12', '24dp'],
                    ['Expanded', '840-1199dp', '12', '24dp'],
                    ['Large', '1200-1599dp', '12', '24dp'],
                    ['Extra Large', '1600dp+', '12', '24dp'],
                  ]
                )}
              </section>
            </div>
          )}

          {/* Shape Tab */}
          {activeTab === 'shape' && (
            <div className="space-y-8">
              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Corner Radius Scale</h2>
                <p className="text-ui-muted">
                  Shape communicates state, hierarchy, and brand identity. M3 uses a consistent scale for corner radii.
                </p>
                {renderTable(
                  ['Token', 'Value', 'Usage'],
                  shapeScale.map(s => [
                    <span key={s.token} className="font-medium">{s.token}</span>,
                    <code key={`${s.token}-value`} className="text-accent">{s.value}</code>,
                    s.usage
                  ])
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Shape by Component</h2>
                {renderTable(
                  ['Component', 'Corner Radius'],
                  [
                    ['Buttons (filled, outlined)', 'Full (pill-shaped)'],
                    ['FAB (standard)', '16dp'],
                    ['Cards', '12dp'],
                    ['Dialogs', '28dp'],
                    ['Bottom Sheets', '28dp (top only)'],
                    ['Chips', '8dp'],
                    ['Text Fields', '4dp'],
                    ['Search Bar', 'Full (28dp)'],
                    ['Navigation Bar', '0dp'],
                    ['Navigation Pill (active indicator)', '16dp'],
                  ]
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Shape Application Rules</h2>
                <ul className="list-disc pl-5 text-ui-muted space-y-2">
                  <li><strong>Consistent rounding</strong> — All corners of a card should have the same radius</li>
                  <li><strong>Nested elements</strong> — Inner elements should have smaller or equal radius to container</li>
                  <li><strong>Shape morphing (M3 Expressive)</strong> — Shapes can animate between states</li>
                </ul>
              </section>
            </div>
          )}

          {/* Elevation Tab */}
          {activeTab === 'elevation' && (
            <div className="space-y-8">
              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Elevation Levels</h2>
                <p className="text-ui-muted">
                  Elevation is the relative distance between surfaces along the z-axis.
                  M3 uses 6 levels of elevation.
                </p>
                {renderTable(
                  ['Level', 'Value', 'Usage'],
                  elevationLevels.map(e => [
                    <span key={e.level} className="font-medium">{e.level}</span>,
                    <code key={`${e.level}-value`} className="text-accent">{e.value}</code>,
                    e.usage
                  ])
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Elevation Types</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="text-ui-title font-semibold mb-2">Shadow Elevation</h3>
                    <ul className="text-ui-muted text-sm space-y-1">
                      <li>Traditional drop shadows</li>
                      <li>Higher elevation = larger, more diffuse shadow</li>
                      <li>Used for distinct layering</li>
                    </ul>
                  </div>
                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="text-ui-title font-semibold mb-2">Tonal Elevation</h3>
                    <ul className="text-ui-muted text-sm space-y-1">
                      <li>Uses color tinting instead of shadows</li>
                      <li>Surface tinted with primary color</li>
                      <li>Higher elevation = more prominent tint</li>
                      <li>Preferred method in M3</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Elevation State Changes</h2>
                {renderTable(
                  ['Interaction', 'Elevation Change'],
                  [
                    ['Default', 'Base elevation'],
                    ['Hover', '+1 level'],
                    ['Pressed', 'Base or -1 level'],
                    ['Dragged', '+2 levels'],
                    ['Disabled', '0dp'],
                  ]
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">CSS Shadow Values</h2>
                <pre className="bg-surface-muted p-4 rounded-lg text-sm overflow-x-auto">
{`/* Level 1 */
box-shadow: 0 1px 2px rgba(0,0,0,0.3),
            0 1px 3px 1px rgba(0,0,0,0.15);

/* Level 2 */
box-shadow: 0 1px 2px rgba(0,0,0,0.3),
            0 2px 6px 2px rgba(0,0,0,0.15);

/* Level 3 */
box-shadow: 0 4px 8px 3px rgba(0,0,0,0.15),
            0 1px 3px rgba(0,0,0,0.3);

/* Level 4 */
box-shadow: 0 6px 10px 4px rgba(0,0,0,0.15),
            0 2px 3px rgba(0,0,0,0.3);

/* Level 5 */
box-shadow: 0 8px 12px 6px rgba(0,0,0,0.15),
            0 4px 4px rgba(0,0,0,0.3);`}
                </pre>
              </section>
            </div>
          )}

          {/* Components Tab */}
          {activeTab === 'components' && (
            <div className="space-y-8">
              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Buttons</h2>
                <p className="text-ui-muted mb-4">
                  M3 buttons have pill-shaped corners, use sentence case (not ALL CAPS), and come in 5 variants:
                  Filled, Filled Tonal, Elevated, Outlined, and Text.
                </p>
                {renderSpecTable(buttonSpecs)}
                <div className="mt-4 p-4 bg-surface-muted rounded-lg">
                  <h4 className="text-ui-label font-semibold mb-2">FAB Sizes</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div><span className="text-ui-muted">Small:</span> 40dp, icon 24dp, radius 12dp</div>
                    <div><span className="text-ui-muted">Standard:</span> 56dp, icon 24dp, radius 16dp</div>
                    <div><span className="text-ui-muted">Large:</span> 96dp, icon 36dp, radius 28dp</div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Cards</h2>
                <p className="text-ui-muted mb-4">
                  Three card types: Elevated (shadow), Filled (tonal), and Outlined (border).
                </p>
                {renderSpecTable(cardSpecs)}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Navigation Bar</h2>
                <p className="text-ui-muted mb-4">
                  Bottom navigation for mobile with 3-5 destinations. Active state uses a pill-shaped indicator.
                </p>
                {renderSpecTable(navBarSpecs)}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Tabs</h2>
                <p className="text-ui-muted mb-4">
                  Primary tabs (top-level navigation) and Secondary tabs (content filtering).
                </p>
                {renderSpecTable(tabSpecs)}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Search Bar</h2>
                {renderSpecTable(searchBarSpecs)}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Text Fields</h2>
                <p className="text-ui-muted mb-4">
                  Filled (default) and Outlined variants with floating labels.
                </p>
                {renderSpecTable(textFieldSpecs)}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Chips</h2>
                <p className="text-ui-muted mb-4">
                  Four types: Assist, Filter, Input, and Suggestion chips.
                </p>
                {renderSpecTable(chipSpecs)}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Dialogs</h2>
                {renderSpecTable(dialogSpecs)}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Lists</h2>
                {renderTable(
                  ['Type', 'Height', 'Notes'],
                  [
                    ['One-line', '56dp', 'Headline only'],
                    ['Two-line', '72dp', 'Headline + supporting text'],
                    ['Three-line', '88dp', 'Headline + 2 lines supporting'],
                  ]
                )}
                <p className="text-ui-muted text-sm mt-2">
                  Horizontal padding: 16dp. Leading element gap: 16dp. Icon size: 24dp. Avatar size: 40dp.
                </p>
              </section>
            </div>
          )}

          {/* States Tab */}
          {activeTab === 'states' && (
            <div className="space-y-8">
              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">State Layer System</h2>
                <p className="text-ui-muted">
                  States are communicated through overlay layers with fixed opacity on top of the component color.
                  The state layer uses the same color as the content (text/icon).
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">State Layer Opacities</h2>
                {renderTable(
                  ['State', 'Opacity', 'Description'],
                  stateOpacities.map(s => [
                    <span key={s.state} className="font-medium">{s.state}</span>,
                    <code key={`${s.state}-opacity`} className="text-accent">{s.opacity}</code>,
                    s.description
                  ])
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">State Layer Color Rule</h2>
                <div className="bg-surface-muted p-4 rounded-lg">
                  <pre className="text-sm">
{`Container: primary-container
Content: on-primary-container
State layer: on-primary-container @ {state opacity}`}
                  </pre>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Focus Indicators</h2>
                {renderTable(
                  ['Property', 'Value'],
                  [
                    ['Focus ring width', '3dp'],
                    ['Focus ring offset', '2dp from component edge'],
                    ['Focus ring color', 'Secondary or custom'],
                    ['Focus ring contrast', '3:1 against adjacent colors'],
                  ]
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-ui-heading text-lg font-semibold">Disabled State</h2>
                <ul className="list-disc pl-5 text-ui-muted space-y-2">
                  <li>Container opacity: 12% of enabled</li>
                  <li>Content opacity: 38% of enabled</li>
                  <li>Elevation: 0dp</li>
                  <li>No interaction</li>
                </ul>
              </section>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-border pt-6 mt-8">
            <p className="text-ui-muted text-sm">
              Based on{' '}
              <a href="https://m3.material.io/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                Material Design 3
              </a>{' '}
              and M3 Expressive specifications. Last updated: January 2026.
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
