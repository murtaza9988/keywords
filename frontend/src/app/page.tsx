import Link from 'next/link';
import { cn } from '@/lib/cn';

export default function Home() {
  return (
    <div className="min-h-screen bg-surface text-on-surface relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--md-sys-color-outline-variant)_1px,transparent_1px)] bg-[length:24px_24px] opacity-30" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-12 px-6 py-16 text-center">
        {/* Badge/Chip */}
        <span className={cn(
          "inline-flex items-center",
          // M3 chip styling
          "h-8 px-4 rounded-lg",
          "border border-outline-variant",
          "bg-surface-container text-on-surface-variant",
          "text-label-large font-medium"
        )}>
          SEO Workflow Companion
        </span>

        {/* Hero section */}
        <div className="space-y-4">
          <h1 className="text-headline-medium md:text-headline-large tracking-tight text-on-surface">
            Turn messy keyword lists into prioritized SEO action plans.
          </h1>
          <p className="text-body-large text-on-surface-variant max-w-2xl mx-auto">
            Manager centralizes keyword research, clusters intent, and highlights the pages that need your
            attention—so SEOs can move faster from discovery to content briefs.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className={cn(
              // M3 Filled button
              "inline-flex items-center justify-center gap-2",
              "h-10 min-w-[64px] px-6",
              "rounded-full font-medium text-label-large",
              "bg-primary text-on-primary",
              "hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)]",
              "hover:bg-[color-mix(in_srgb,var(--md-sys-color-primary)_92%,var(--md-sys-color-on-primary)_8%)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
            )}
          >
            Get started
          </Link>
          <Link
            href="/login"
            className={cn(
              // M3 Outlined button
              "inline-flex items-center justify-center gap-2",
              "h-10 min-w-[64px] px-6",
              "rounded-full font-medium text-label-large",
              "border border-outline bg-transparent text-primary",
              "hover:bg-[color-mix(in_srgb,transparent_92%,var(--md-sys-color-primary)_8%)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
            )}
          >
            Sign in
          </Link>
        </div>

        {/* Main feature card */}
        <section className={cn(
          "grid w-full gap-6 text-left md:grid-cols-[1.2fr_1fr] md:p-8",
          // M3 Card styling - elevated
          "rounded-xl p-6",
          "bg-surface-container-low",
          "shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)]"
        )}>
          <div className="space-y-4">
            <h2 className="text-title-large text-on-surface">
              Everything you need to ship smarter SEO strategy
            </h2>
            <p className="text-body-medium text-on-surface-variant">
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
                <div
                  key={item}
                  className={cn(
                    // M3 outlined card style
                    "flex items-start gap-3 p-4",
                    "rounded-xl",
                    "bg-surface border border-outline-variant"
                  )}
                >
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  <p className="text-body-medium text-on-surface">{item}</p>
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
                className={cn(
                  // M3 filled card style
                  "rounded-xl p-5 text-left",
                  "bg-surface-container-highest"
                )}
              >
                <p className="text-label-medium text-on-surface-variant uppercase tracking-wide">{stat.label}</p>
                <p className="mt-2 text-title-medium text-on-surface">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Feature cards */}
        <div className="grid gap-6 md:grid-cols-3 text-left w-full">
          {[
            {
              title: 'Keyword intelligence',
              description: 'Upload, normalize, and segment massive keyword exports without losing the context of intent.'
            },
            {
              title: 'Opportunity scoring',
              description: 'Quickly spot high-impact terms and content gaps so you can prioritize what wins next.'
            },
            {
              title: 'Team-ready exports',
              description: 'Generate clean, client-ready exports and shareable insights in minutes.'
            }
          ].map((feature) => (
            <div
              key={feature.title}
              className={cn(
                // M3 outlined card
                "rounded-xl p-6",
                "bg-surface border border-outline-variant",
                // Hover effect
                "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
                "hover:bg-[color-mix(in_srgb,var(--md-sys-color-surface)_92%,var(--md-sys-color-on-surface)_8%)]"
              )}
            >
              <h3 className="text-title-medium text-on-surface mb-2">{feature.title}</h3>
              <p className="text-body-medium text-on-surface-variant">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-auto w-full border-t border-outline-variant pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <span className="text-body-small text-on-surface-variant">
              © 2025 Manager. Built for SEO teams who move fast.
            </span>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-label-large text-primary hover:underline transition-colors"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="text-label-large text-primary hover:underline transition-colors"
              >
                Support
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
