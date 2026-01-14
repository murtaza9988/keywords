"use client";
import React from 'react';
import Header from '@/app/projects/components/Header';
import { Card } from '@/components/ui/Card';

const backlogItems = [
  {
    name: 'Compound normalization rules',
    problemStatement:
      'Compound keywords and multi-token phrases normalize inconsistently, causing duplicate clusters and unstable rollups when users compare grouped vs. ungrouped views.',
    definitionOfDone:
      'Compound normalization applies deterministic token ordering, preserves semantic modifiers, and ships with regression tests covering clustered keyword rollups and UI counts.',
    scope: {
      type: 'Full stack',
      why: 'Requires backend normalization logic, persisted field updates, and front-end display consistency checks.',
    },
    impactedAreas: [
      'backend keyword normalization pipeline',
      'keyword grouping + cluster score modules',
      'frontend keyword table aggregation logic',
    ],
    dependencies: ['Normalization rules approved by SEO team', 'Test fixtures from sample projects'],
    risks: ['May change existing cluster IDs', 'Requires careful communication to avoid user confusion'],
    status: 'Planned',
  },
  {
    name: 'Numeric normalization for volume & difficulty',
    problemStatement:
      'Volume and difficulty values are inconsistent (string vs. number), leading to sorting inaccuracies and display drift across tables and exports.',
    definitionOfDone:
      'All numeric inputs are parsed, validated, and stored as numbers with consistent rounding rules; UI tables sort and format identically.',
    scope: {
      type: 'Back-end + Front-end',
      why: 'Needs backend parsing + schema updates and frontend formatting/sorting updates.',
    },
    impactedAreas: [
      'backend ingestion + validation layer',
      'database schema numeric fields',
      'frontend keyword/token table renderers',
    ],
    dependencies: ['Schema migration plan', 'Updated export formatting requirements'],
    risks: ['Potential mismatch with historical exports', 'Migration errors if invalid legacy values exist'],
    status: 'In discovery',
  },
  {
    name: 'Upload notification staging',
    problemStatement:
      'Users do not receive clear feedback during large uploads, which causes double submissions and uncertainty around processing.',
    definitionOfDone:
      'Upload events emit staged notifications (queued → processing → completed/failed) with timestamps and clear retry paths.',
    scope: {
      type: 'Full stack',
      why: 'Requires job queue hooks, API status endpoints, and UI notification rendering.',
    },
    impactedAreas: [
      'backend upload job worker',
      'notifications/event status API',
      'frontend upload flow + toast/notification surface',
    ],
    dependencies: ['Queue event taxonomy finalized', 'Notification design tokens'],
    risks: ['Notification spam if debounce rules are missing', 'State mismatch on refresh'],
    status: 'Planned',
  },
  {
    name: 'Backfill + migration playbook',
    problemStatement:
      'Normalization changes require a safe backfill and migration path; without a playbook, historical data consistency cannot be guaranteed.',
    definitionOfDone:
      'Documented, automated backfill steps exist with dry-run mode, verification reports, and rollback procedures.',
    scope: {
      type: 'Back-end',
      why: 'Focuses on data migrations, backfill scripts, and operational checks.',
    },
    impactedAreas: [
      'migration scripts',
      'data verification reports',
      'operations runbook',
    ],
    dependencies: ['Normalized schema finalized', 'Access to staging data snapshots'],
    risks: ['Long-running migrations', 'Unexpected data drift across environments'],
    status: 'Proposed',
  },
];

const renderList = (items: string[]) => (
  <ul className="list-disc pl-4 text-[13px] text-muted space-y-1">
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);

export default function BacklogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-[1100px] mx-auto px-4 py-8">
        <Card className="p-8 space-y-8">
          <header className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Backlog</h2>
            <p className="text-[13px] text-muted">
              Structured feature backlog capturing scope, risks, and dependencies for upcoming normalization and upload work.
            </p>
          </header>

          <div className="space-y-6">
            {backlogItems.map((item) => (
              <section
                key={item.name}
                className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-foreground">{item.name}</h3>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-accent bg-accent/10 border border-accent/30 px-2 py-1 rounded-full">
                    {item.status}
                  </span>
                </div>

                <dl className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <dt className="text-[11px] uppercase tracking-wider text-muted">Problem statement</dt>
                    <dd className="text-[13px] text-foreground">{item.problemStatement}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-[11px] uppercase tracking-wider text-muted">Definition of done</dt>
                    <dd className="text-[13px] text-foreground">{item.definitionOfDone}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-[11px] uppercase tracking-wider text-muted">Scope</dt>
                    <dd className="text-[13px] text-foreground">
                      <span className="font-semibold">{item.scope.type}</span> — {item.scope.why}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-[11px] uppercase tracking-wider text-muted">Impacted areas</dt>
                    <dd>{renderList(item.impactedAreas)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-[11px] uppercase tracking-wider text-muted">Dependencies</dt>
                    <dd>{renderList(item.dependencies)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-[11px] uppercase tracking-wider text-muted">Risks</dt>
                    <dd>{renderList(item.risks)}</dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
