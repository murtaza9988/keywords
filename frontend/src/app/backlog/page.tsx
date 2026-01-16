"use client";
import React from 'react';
import Header from '@/app/projects/components/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { backlogItems, type BacklogItem, type BacklogPriority, type BacklogStatus } from './backlogData';

const renderList = (items: string[]) => (
  <ul className="list-disc pl-4 text-ui-muted space-y-1">
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);

const priorities: BacklogPriority[] = ['P0', 'P1', 'P2'];
const statuses: BacklogStatus[] = ['Proposed', 'Planned', 'In discovery'];

function getCounts(items: BacklogItem[]) {
  return {
    total: items.length,
    byPriority: priorities.reduce(
      (acc, p) => {
        acc[p] = items.filter((i) => i.priority === p).length;
        return acc;
      },
      {} as Record<BacklogPriority, number>,
    ),
    byStatus: statuses.reduce(
      (acc, s) => {
        acc[s] = items.filter((i) => i.status === s).length;
        return acc;
      },
      {} as Record<BacklogStatus, number>,
    ),
  };
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-ui-tab font-medium transition-colors border ${
        active
          ? 'bg-accent text-white border-accent shadow-sm'
          : 'text-muted border-border hover:text-foreground hover:bg-surface-muted'
      }`}
    >
      {label}
    </button>
  );
}

export default function BacklogPage() {
  const [query, setQuery] = React.useState('');
  const [priorityFilter, setPriorityFilter] = React.useState<BacklogPriority | 'All'>('All');
  const [statusFilter, setStatusFilter] = React.useState<BacklogStatus | 'All'>('All');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return backlogItems
      .filter((item) => {
        if (priorityFilter !== 'All' && item.priority !== priorityFilter) return false;
        if (statusFilter !== 'All' && item.status !== statusFilter) return false;
        if (!q) return true;

        const haystack = [
          item.name,
          item.category,
          item.area,
          item.type,
          item.problemStatement,
          item.definitionOfDone,
          ...item.impactedAreas,
          ...item.dependencies,
          ...item.risks,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(q);
      })
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);
        if (b.impact !== a.impact) return b.impact - a.impact;
        return a.complexity - b.complexity;
      });
  }, [query, priorityFilter, statusFilter]);

  const counts = React.useMemo(() => getCounts(backlogItems), []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-[1100px] mx-auto px-4 py-8">
        <Card className="p-8 space-y-8">
          <header className="space-y-2">
            <h2 className="text-ui-page">Backlog</h2>
            <p className="text-ui-muted">
              Review-friendly list of remaining features, fixes, and product improvements.
            </p>
          </header>

          <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-ui-title font-semibold">Summary</div>
              <div className="text-ui-meta">Total: {counts.total}</div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-ui-meta">
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <span className="font-semibold text-foreground">Priorities:</span>{' '}
                P0 {counts.byPriority.P0} · P1 {counts.byPriority.P1} · P2 {counts.byPriority.P2}
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <span className="font-semibold text-foreground">Statuses:</span>{' '}
                Proposed {counts.byStatus.Proposed} · Planned {counts.byStatus.Planned} · In discovery{' '}
                {counts.byStatus['In discovery']}
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <span className="font-semibold text-foreground">Showing:</span> {filtered.length}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search backlog (name, category, notes…)"
                  aria-label="Search backlog"
                />
              </div>
              <div className="flex items-center gap-2">
                <Pill
                  label="All priorities"
                  active={priorityFilter === 'All'}
                  onClick={() => setPriorityFilter('All')}
                />
                {priorities.map((p) => (
                  <Pill
                    key={p}
                    label={p}
                    active={priorityFilter === p}
                    onClick={() => setPriorityFilter(p)}
                  />
                ))}
              </div>
              <div className="md:col-span-3 flex flex-wrap items-center gap-2">
                <Pill
                  label="All statuses"
                  active={statusFilter === 'All'}
                  onClick={() => setStatusFilter('All')}
                />
                {statuses.map((s) => (
                  <Pill
                    key={s}
                    label={s}
                    active={statusFilter === s}
                    onClick={() => setStatusFilter(s)}
                  />
                ))}
              </div>
            </div>
          </section>

          <div className="space-y-6">
            {filtered.map((item) => (
              <section
                key={item.id}
                className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-ui-heading">
                      <span className="text-muted mr-2">#{item.id}</span>
                      {item.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-ui-meta">
                      <span className="rounded-full border border-border bg-background px-2 py-0.5">
                        {item.category}
                      </span>
                      <span className="rounded-full border border-border bg-background px-2 py-0.5">
                        {item.area}
                      </span>
                      <span className="rounded-full border border-border bg-background px-2 py-0.5">
                        {item.type}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ui-label text-white bg-accent border border-accent px-2 py-1 rounded-full">
                      {item.priority}
                    </span>
                    <span className="text-ui-label text-accent bg-accent/10 border border-accent/30 px-2 py-1 rounded-full">
                      {item.status}
                    </span>
                  </div>
                </div>

                <dl className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <dt className="text-ui-label">Scores</dt>
                    <dd className="text-ui-body">
                      Impact <span className="font-semibold">{item.impact}/10</span> · Complexity{' '}
                      <span className="font-semibold">{item.complexity}/10</span>
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-ui-label">Problem statement</dt>
                    <dd className="text-ui-body">{item.problemStatement}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-ui-label">Definition of done</dt>
                    <dd className="text-ui-body">{item.definitionOfDone}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-ui-label">Scope</dt>
                    <dd className="text-ui-body">
                      <span className="font-semibold">{item.scope.type}</span> — {item.scope.why}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-ui-label">Impacted areas</dt>
                    <dd>{renderList(item.impactedAreas)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-ui-label">Dependencies</dt>
                    <dd>{renderList(item.dependencies)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-ui-label">Risks</dt>
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
