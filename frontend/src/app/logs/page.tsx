import React from 'react';
import Header from '@/app/projects/components/Header';
import { LogsTable } from '@/app/projects/[id]/components/LogsTable';
import { Card } from '@/components/ui/Card';

export default function LogsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-[1100px] mx-auto px-4 py-8">
        <Card className="p-6 space-y-4">
          <header className="space-y-1">
            <h2 className="text-2xl font-semibold text-foreground">Activity Logs</h2>
            <p className="text-[13px] text-muted">
              Review activity across all projects, including actions, users, and timestamps.
            </p>
          </header>
          <LogsTable scope="global" />
        </Card>
      </main>
    </div>
  );
}
