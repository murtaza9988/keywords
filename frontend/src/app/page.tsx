import Link from 'next/link';

import { cn } from '@/lib/cn';

const baseButtonClasses =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 px-4 py-3 text-base';

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[length:24px_24px] opacity-70" />
      <main className="relative z-10 w-full max-w-4xl text-center flex flex-col items-center gap-8">
        <span className="inline-flex items-center rounded-full border border-border/70 bg-surface/80 px-4 py-1 text-sm uppercase tracking-[0.2em] text-muted">
          SEO Workflow Companion
        </span>
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
            Turn messy keyword lists into prioritized SEO action plans.
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Manager centralizes keyword research, clusters intent, and highlights the pages that need your
            attention—so SEOs can move faster from discovery to content briefs.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/login" className={cn(baseButtonClasses, 'bg-accent text-white hover:bg-accent-strong')}>
            Get started
          </Link>
          <Link
            href="/login"
            className={cn(baseButtonClasses, 'border border-border text-foreground hover:bg-surface-muted')}
          >
            Sign in
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3 text-left w-full">
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-6">
            <h2 className="text-lg font-semibold mb-2">Keyword intelligence</h2>
            <p className="text-sm text-muted">
              Upload, normalize, and segment massive keyword exports without losing the context of intent.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-6">
            <h2 className="text-lg font-semibold mb-2">Opportunity scoring</h2>
            <p className="text-sm text-muted">
              Quickly spot high-impact terms and content gaps so you can prioritize what wins next.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-6">
            <h2 className="text-lg font-semibold mb-2">Team-ready exports</h2>
            <p className="text-sm text-muted">
              Generate clean, client-ready exports and shareable insights in minutes.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
