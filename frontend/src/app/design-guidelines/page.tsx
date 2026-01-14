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
            <h2 className="text-2xl font-semibold text-foreground">Design Guidelines</h2>
            <p className="text-[13px] text-muted mt-2">
              Use these standards to keep the UI consistent, readable, and stable during user actions.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <section className="space-y-4">
              <h3 className="text-[15px] font-semibold text-foreground border-b border-border pb-2">Color Palette</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-background"></div>
                  <div className="text-[11px] text-muted flex justify-between"><span>Background</span> <span className="font-mono">var(--background)</span></div>
                </div>
                <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-surface"></div>
                  <div className="text-[11px] text-muted flex justify-between"><span>Surface</span> <span className="font-mono">var(--surface)</span></div>
                </div>
                <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-surface-muted"></div>
                  <div className="text-[11px] text-muted flex justify-between"><span>Surface Muted</span> <span className="font-mono">var(--surface-muted)</span></div>
                </div>
                <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-surface-strong"></div>
                  <div className="text-[11px] text-muted flex justify-between"><span>Surface Strong</span> <span className="font-mono">var(--surface-strong)</span></div>
                </div>
                <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-border"></div>
                  <div className="text-[11px] text-muted flex justify-between"><span>Border</span> <span className="font-mono">var(--border)</span></div>
                </div>
                <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-accent"></div>
                  <div className="text-[11px] text-muted flex justify-between"><span>Accent</span> <span className="font-mono">var(--accent)</span></div>
                </div>
                 <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-muted"></div>
                  <div className="text-[11px] text-muted flex justify-between"><span>Muted</span> <span className="font-mono">var(--muted)</span></div>
                </div>
                 <div className="space-y-1">
                  <div className="h-10 w-full rounded border border-border bg-foreground"></div>
                  <div className="text-[11px] text-muted flex justify-between"><span>Foreground</span> <span className="font-mono">var(--foreground)</span></div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
               <h3 className="text-[15px] font-semibold text-foreground border-b border-border pb-2">Typography</h3>
               <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted">Heading 1 (24px)</p>
                    <div className="text-2xl font-semibold text-foreground">The quick brown fox jumps over the lazy dog</div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted">Heading 2 (18px)</p>
                    <div className="text-lg font-medium text-foreground">The quick brown fox jumps over the lazy dog</div>
                  </div>
                   <div className="space-y-1">
                    <p className="text-xs text-muted">Body (13px)</p>
                    <div className="text-[13px] font-light text-foreground">The quick brown fox jumps over the lazy dog. Standard body text used for most content.</div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted">Muted (13px)</p>
                    <div className="text-[13px] text-muted">The quick brown fox jumps over the lazy dog. Used for secondary information.</div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted">Table Header (11-13px Uppercase)</p>
                    <div className="text-[13px] uppercase tracking-wider font-medium text-muted">Keyword Volume Difficulty</div>
                  </div>
               </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-[15px] font-semibold text-foreground">Layout & Spacing</h3>
              <ul className="list-disc pl-5 text-[13px] text-muted space-y-2">
                <li>Keep primary content containers within a 1600px max width and center them.</li>
                <li>Reserve space for dynamic UI elements to prevent layout shifts.</li>
                <li>Use consistent vertical rhythm (8px increments) across sections.</li>
                <li>Avoid horizontal scrolling; layouts should fit within a single screen width.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-[15px] font-semibold text-foreground">Tables</h3>
              <ul className="list-disc pl-5 text-[13px] text-muted space-y-2">
                <li>Use fixed table layouts to keep columns stable.</li>
                <li>Prioritize <strong>Keyword (55%)</strong> and <strong>Tokens (30%)</strong> columns.</li>
                <li>Keep SERP column minimal (approx 40px) using icons.</li>
                <li>Numeric columns should be compact (~35-40px) with minimal padding.</li>
              </ul>
            </section>
            <section className="space-y-3">
              <h3 className="text-[15px] font-semibold text-foreground">Interaction & States</h3>
              <ul className="list-disc pl-5 text-[13px] text-muted space-y-2">
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
