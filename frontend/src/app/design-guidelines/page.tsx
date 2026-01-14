"use client";
import React from 'react';
import Header from '@/app/projects/components/Header';
import { Card } from '@/components/ui/Card';

export default function DesignGuidelinesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-[1100px] mx-auto px-4 py-8">
        <Card className="p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Design Guidelines</h2>
            <p className="text-[13px] text-muted mt-2">
              Use these standards to keep the UI consistent, readable, and stable during user actions.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
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
              <h3 className="text-[15px] font-semibold text-foreground">Typography</h3>
              <ul className="list-disc pl-5 text-[13px] text-muted space-y-2">
                <li>Body and table text should default to 13px.</li>
                <li>Headers use 11–13px uppercase in tables for clarity.</li>
                <li>Use theme tokens (foreground/muted) for consistent coloration.</li>
              </ul>
            </section>
            <section className="space-y-3">
              <h3 className="text-[15px] font-semibold text-foreground">Tables</h3>
              <ul className="list-disc pl-5 text-[13px] text-muted space-y-2">
                <li>Use fixed table layouts to keep columns stable.</li>
                <li>Prioritize Keyword and Tokens columns; keep SERP width ~50px.</li>
                <li>Ensure all columns (through Rt) are visible without horizontal scrolling.</li>
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
