"use client";
import React from 'react';
import Header from '@/app/projects/components/Header';
import { Card } from '@/components/ui/Card';

export default function DesignGuidelinesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-[1100px] mx-auto px-4 py-8">
        <Card className="p-8 space-y-8">
          <div>
            <h2 className="text-ui-page">Design Guidelines</h2>
            <p className="text-ui-muted mt-2">
              Use these standards to keep the UI consistent, readable, and stable during user actions.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <section className="space-y-4">
              <h3 className="text-ui-heading border-b border-border pb-2">Color Palette</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-background"></div>
                  <div className="text-ui-meta flex justify-between"><span>Background</span> <span className="font-mono">var(--background)</span></div>
                </div>
                <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-surface"></div>
                  <div className="text-ui-meta flex justify-between"><span>Surface</span> <span className="font-mono">var(--surface)</span></div>
                </div>
                <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-surface-muted"></div>
                  <div className="text-ui-meta flex justify-between"><span>Surface Muted</span> <span className="font-mono">var(--surface-muted)</span></div>
                </div>
                <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-surface-strong"></div>
                  <div className="text-ui-meta flex justify-between"><span>Surface Strong</span> <span className="font-mono">var(--surface-strong)</span></div>
                </div>
                <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-border"></div>
                  <div className="text-ui-meta flex justify-between"><span>Border</span> <span className="font-mono">var(--border)</span></div>
                </div>
                <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-accent"></div>
                  <div className="text-ui-meta flex justify-between"><span>Accent</span> <span className="font-mono">var(--accent)</span></div>
                </div>
                 <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-muted"></div>
                  <div className="text-ui-meta flex justify-between"><span>Muted</span> <span className="font-mono">var(--muted)</span></div>
                </div>
                 <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-foreground"></div>
                  <div className="text-ui-meta flex justify-between"><span>Foreground</span> <span className="font-mono">var(--foreground)</span></div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-ui-heading border-b border-border pb-2">Typography & Weight Rules</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-ui-meta">Page Title (18px, 600)</p>
                  <div className="text-ui-page">Design Guidelines</div>
                </div>
                <div className="space-y-1">
                  <p className="text-ui-meta">Section Heading (16px, 600)</p>
                  <div className="text-ui-heading">Typography & Weight Rules</div>
                </div>
                <div className="space-y-1">
                  <p className="text-ui-meta">Subheading / Card Label (14px, 600)</p>
                  <div className="text-ui-title">Card Header</div>
                </div>
                <div className="space-y-1">
                  <p className="text-ui-meta">Body (12px, 400)</p>
                  <div className="text-ui-body">The quick brown fox jumps over the lazy dog. Use for primary descriptions.</div>
                </div>
                <div className="space-y-1">
                  <p className="text-ui-meta">Secondary / Muted Body (12px, 400)</p>
                  <div className="text-ui-muted">Secondary information sits on muted color, never smaller than 11px.</div>
                </div>
                <div className="space-y-1">
                  <p className="text-ui-meta">Label / Meta (11px, 600)</p>
                  <div className="text-ui-label">Label / Meta</div>
                </div>
                <div className="space-y-1">
                  <p className="text-ui-meta">Table Header (11px, 600)</p>
                  <div className="text-ui-label">Keyword Volume Difficulty</div>
                </div>
                <div className="space-y-1">
                  <p className="text-ui-meta">UI Tabs (11px, 500)</p>
                  <div className="text-ui-tab">View 1 (UG; 3,413/100.00%)</div>
                </div>
                <ul className="list-disc pl-5 text-ui-muted space-y-2">
                  <li>Use 600 weight for headings, 500 for UI tabs, 400 for body, and 300 only for long-form secondary notes.</li>
                  <li>Bold emphasis is reserved for key values or callouts only (never whole paragraphs).</li>
                  <li>Keep line height around 1.4 for body and 1.2 for headings to preserve density.</li>
                </ul>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-ui-heading">Color Usage</h3>
              <ul className="list-disc pl-5 text-ui-muted space-y-2">
                <li>Primary text: <strong>var(--foreground)</strong> on background/surface for maximum contrast.</li>
                <li>Secondary text: <strong>var(--muted)</strong> for helper labels, metadata, and timestamps.</li>
                <li>Surfaces: use <strong>var(--surface)</strong> for cards and panels, <strong>var(--surface-muted)</strong> for grouped areas.</li>
                <li>Borders: keep to 1px with <strong>var(--border)</strong> to define edges without heavy lines.</li>
                <li>Accent: <strong>var(--accent)</strong> is for primary actions, highlights, and status emphasis only.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-ui-heading">Text Hierarchy & Alignment</h3>
              <ul className="list-disc pl-5 text-ui-muted space-y-2">
                <li>Headings align left by default; center alignment is reserved for empty states or hero pages.</li>
                <li>Labels and meta text align to the left edge of their related control or value.</li>
                <li>Table headers are uppercase, 12px, 600 weight, and align left; numeric columns align right.</li>
                <li>Body text is 13px, 400 weight, with 4-8px spacing above metadata and 12-16px spacing between paragraphs.</li>
                <li>Inline emphasis uses bold for the value only, never for surrounding descriptors.</li>
              </ul>
            </section>
            <section className="space-y-3">
              <h3 className="text-ui-heading">Vertical Spacing Rules</h3>
              <ul className="list-disc pl-5 text-ui-muted space-y-2">
                <li>Base spacing unit: 8px. Use 8, 16, 24, 32, 40px increments for vertical rhythm.</li>
                <li>Heading to body: 12-16px margin. Section to section: 24-32px margin.</li>
                <li>Card padding: 24-32px; nested groups use 16px padding with 12-16px gap between items.</li>
                <li>Table rows: 12px top/bottom padding; header row gets an extra 4px above to separate.</li>
                <li>Form fields: label sits 6-8px above input; helper text sits 6px below.</li>
                <li>Example: H2 (18px) uses 12px bottom margin; body paragraphs use 16px bottom margin.</li>
                <li>Example: list groups use 8px item gap, 16px section gap, and 24px between cards.</li>
              </ul>
            </section>
            <section className="space-y-3">
              <h3 className="text-ui-heading">Tables</h3>
              <ul className="list-disc pl-5 text-ui-muted space-y-2">
                <li>Use fixed table layouts to keep columns stable.</li>
                <li>Prioritize <strong>Keyword (55%)</strong> and <strong>Tokens (30%)</strong> columns.</li>
                <li>Keep SERP column minimal (approx 40px) using icons.</li>
                <li>Numeric columns should be compact (~35-40px) with minimal padding.</li>
              </ul>
            </section>
            <section className="space-y-3">
              <h3 className="text-ui-heading">Interaction & States</h3>
              <ul className="list-disc pl-5 text-ui-muted space-y-2">
                <li>Maintain consistent element positions during filtering and searching.</li>
                <li>Show clear active states for tabs and primary actions.</li>
                <li>Use subtle hover styles rather than large shifts or animations.</li>
                <li>Keep grouped action areas visually aligned and centered within shaded containers.</li>
              </ul>
            </section>
          </div>
        </Card>
      </main>
    </div>
  );
}
