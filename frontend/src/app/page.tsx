import Link from 'next/link';

import { cn } from '@/lib/cn';

const baseButtonClasses =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 px-4 py-3 text-base';

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[length:24px_24px] opacity-70" />
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-12 px-6 py-16 text-center">
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

        <section className="grid w-full gap-6 rounded-3xl border border-border/60 bg-gradient-to-br from-white/90 via-surface/70 to-surface-muted/60 p-6 text-left md:grid-cols-[1.2fr_1fr] md:p-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Everything you need to ship smarter SEO strategy</h2>
            <p className="text-sm text-muted">
              Build momentum with a workflow that keeps research, clustering, and delivery in one place—no
              more spreadsheet chaos.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                'Automated grouping to reduce manual cleanup',
                'Intent tags to guide page briefs instantly',
                'Prioritization cues based on volume and difficulty',
                'Export-ready views for clients and content teams'
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-white/70 p-4">
                  <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                  <p className="text-sm text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { label: 'Average time saved', value: '6+ hrs / project' },
              { label: 'Keywords organized', value: '10k+ in minutes' },
              { label: 'Workflow clarity', value: 'Single source of truth' }
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border/70 bg-white/80 p-5 text-left shadow-sm"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-muted">{stat.label}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-3 text-left w-full">
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-6">
            <h3 className="text-lg font-semibold mb-2">Keyword intelligence</h3>
            <p className="text-sm text-muted">
              Upload, normalize, and segment massive keyword exports without losing the context of intent.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-6">
            <h3 className="text-lg font-semibold mb-2">Opportunity scoring</h3>
            <p className="text-sm text-muted">
              Quickly spot high-impact terms and content gaps so you can prioritize what wins next.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-6">
            <h3 className="text-lg font-semibold mb-2">Team-ready exports</h3>
            <p className="text-sm text-muted">
              Generate clean, client-ready exports and shareable insights in minutes.
            </p>
          </div>
        </div>

        <footer className="mt-auto w-full border-t border-border/70 pt-8 text-sm text-muted">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <span>© 2025 Manager. Built for SEO teams who move fast.</span>
            <div className="flex items-center gap-4">
              <Link href="/login" className="hover:text-foreground transition-colors">
                Get started
              </Link>
              <Link href="/login" className="hover:text-foreground transition-colors">
                Support
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
