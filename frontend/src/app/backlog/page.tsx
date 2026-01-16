"use client";
import React from 'react';
import Header from '@/app/projects/components/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
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
  const [complexityFilter, setComplexityFilter] = React.useState<'All' | 'Low' | 'Medium' | 'High'>('All');
  const [impactFilter, setImpactFilter] = React.useState<'All' | 'Low' | 'Medium' | 'High'>('All');
  const [selectedItem, setSelectedItem] = React.useState<BacklogItem | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return backlogItems
      .filter((item) => {
        if (priorityFilter !== 'All' && item.priority !== priorityFilter) return false;
        if (statusFilter !== 'All' && item.status !== statusFilter) return false;
        if (complexityFilter !== 'All') {
          if (complexityFilter === 'Low' && item.complexity > 3) return false;
          if (complexityFilter === 'Medium' && (item.complexity <= 3 || item.complexity > 7)) return false;
          if (complexityFilter === 'High' && item.complexity <= 7) return false;
        }
        if (impactFilter !== 'All') {
          if (impactFilter === 'Low' && item.impact > 3) return false;
          if (impactFilter === 'Medium' && (item.impact <= 3 || item.impact > 7)) return false;
          if (impactFilter === 'High' && item.impact <= 7) return false;
        }
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
  }, [query, priorityFilter, statusFilter, complexityFilter, impactFilter]);

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

          <section className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="p-6 bg-surface border-border">
                <div className="text-center">
                  <div className="text-3xl font-bold text-accent">{counts.total}</div>
                  <div className="text-ui-meta mt-1">Total Backlog Items</div>
                </div>
              </Card>
              <Card className="p-6 bg-surface border-border">
                <div className="text-center">
                  <div className="text-3xl font-bold text-accent">{filtered.length}</div>
                  <div className="text-ui-meta mt-1">Filtered Items</div>
                </div>
              </Card>
              <Card className="p-6 bg-surface border-border">
                <div className="text-center">
                  <div className="text-3xl font-bold text-accent">
                    {Math.round(backlogItems.reduce((sum, item) => sum + item.impact, 0) / backlogItems.length * 10) / 10}
                  </div>
                  <div className="text-ui-meta mt-1">Avg Impact Score</div>
                </div>
              </Card>
              <Card className="p-6 bg-surface border-border">
                <div className="text-center">
                  <div className="text-3xl font-bold text-accent">
                    {Math.round(backlogItems.reduce((sum, item) => sum + item.complexity, 0) / backlogItems.length * 10) / 10}
                  </div>
                  <div className="text-ui-meta mt-1">Avg Complexity Score</div>
                </div>
              </Card>
            </div>

            <Card className="p-6 bg-surface border-border space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-ui-title font-semibold">Filters</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search backlog (name, category, notes…)"
                    aria-label="Search backlog"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-ui-label text-sm">Priority:</span>
                  <Pill
                    label="All"
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
                <div className="flex items-center gap-2">
                  <span className="text-ui-label text-sm">Status:</span>
                  <Pill
                    label="All"
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
                <div className="flex items-center gap-2">
                  <span className="text-ui-label text-sm">Complexity:</span>
                  {(['All', 'Low', 'Medium', 'High'] as const).map((level) => (
                    <Pill
                      key={level}
                      label={level}
                      active={complexityFilter === level}
                      onClick={() => setComplexityFilter(level)}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-ui-label text-sm">Impact:</span>
                  {(['All', 'Low', 'Medium', 'High'] as const).map((level) => (
                    <Pill
                      key={level}
                      label={level}
                      active={impactFilter === level}
                      onClick={() => setImpactFilter(level)}
                    />
                  ))}
                </div>
              </div>
            </Card>
          </section>

          <Card className="p-6 bg-surface border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 text-ui-label font-semibold">ID</th>
                    <th className="pb-3 text-ui-label font-semibold">Name</th>
                    <th className="pb-3 text-ui-label font-semibold">Category</th>
                    <th className="pb-3 text-ui-label font-semibold">Priority</th>
                    <th className="pb-3 text-ui-label font-semibold">Status</th>
                    <th className="pb-3 text-ui-label font-semibold">Impact</th>
                    <th className="pb-3 text-ui-label font-semibold">Complexity</th>
                    <th className="pb-3 text-ui-label font-semibold">Area</th>
                    <th className="pb-3 text-ui-label font-semibold">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border hover:bg-background cursor-pointer transition-colors"
                      onClick={() => setSelectedItem(item)}
                    >
                      <td className="py-3 text-ui-meta">#{item.id}</td>
                      <td className="py-3 text-ui-body font-medium">{item.name}</td>
                      <td className="py-3 text-ui-meta">{item.category}</td>
                      <td className="py-3">
                        <span className="text-ui-label text-white bg-accent border border-accent px-2 py-1 rounded-full text-xs">
                          {item.priority}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="text-ui-label text-accent bg-accent/10 border border-accent/30 px-2 py-1 rounded-full text-xs">
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 text-ui-body">{item.impact}/10</td>
                      <td className="py-3 text-ui-body">{item.complexity}/10</td>
                      <td className="py-3 text-ui-meta">{item.area}</td>
                      <td className="py-3 text-ui-meta">{item.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {selectedItem && (
            <Modal
              open={!!selectedItem}
              onClose={() => setSelectedItem(null)}
            >
              <div className="space-y-4">
                <h3 className="text-ui-heading">{selectedItem.name} (#{selectedItem.id})</h3>
                
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border bg-background px-2 py-1 text-sm">
                    {selectedItem.category}
                  </span>
                  <span className="rounded-full border border-border bg-background px-2 py-1 text-sm">
                    {selectedItem.area}
                  </span>
                  <span className="rounded-full border border-border bg-background px-2 py-1 text-sm">
                    {selectedItem.type}
                  </span>
                  <span className="text-white bg-accent border border-accent px-2 py-1 rounded-full text-sm">
                    {selectedItem.priority}
                  </span>
                  <span className="text-accent bg-accent/10 border border-accent/30 px-2 py-1 rounded-full text-sm">
                    {selectedItem.status}
                  </span>
                </div>

                <dl className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <dt className="text-ui-label">Scores</dt>
                    <dd className="text-ui-body">
                      Impact <span className="font-semibold">{selectedItem.impact}/10</span> · Complexity{' '}
                      <span className="font-semibold">{selectedItem.complexity}/10</span>
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-ui-label">Problem statement</dt>
                    <dd className="text-ui-body">{selectedItem.problemStatement}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-ui-label">Definition of done</dt>
                    <dd className="text-ui-body">{selectedItem.definitionOfDone}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-ui-label">Scope</dt>
                    <dd className="text-ui-body">
                      <span className="font-semibold">{selectedItem.scope.type}</span> — {selectedItem.scope.why}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-ui-label">Impacted areas</dt>
                    <dd>{renderList(selectedItem.impactedAreas)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-ui-label">Dependencies</dt>
                    <dd>{renderList(selectedItem.dependencies)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-ui-label">Risks</dt>
                    <dd>{renderList(selectedItem.risks)}</dd>
                  </div>
                </dl>
              </div>
            </Modal>
          )}
        </Card>
      </main>
    </div>
  );
}
