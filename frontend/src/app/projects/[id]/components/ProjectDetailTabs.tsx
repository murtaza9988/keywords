"use client";

import React from 'react';

export type ProjectDetailTab = 'overview' | 'process' | 'group' | 'notes' | 'logs';

interface ProjectDetailTabsProps {
  activeTab: ProjectDetailTab;
  processingLocked: boolean;
  onTabChange: (tab: ProjectDetailTab) => void;
}

export function ProjectDetailTabs({
  activeTab,
  processingLocked,
  onTabChange,
}: ProjectDetailTabsProps): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-2 border border-border rounded-lg bg-surface-muted p-1 mb-3 justify-center">
      {(['overview', 'process', 'group', 'notes', 'logs'] as const).map(tab => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={
            'px-3 py-1.5 text-ui-tab font-medium rounded-md transition-colors ' +
            (activeTab === tab
              ? 'bg-accent text-on-primary shadow-sm'
              : 'text-muted hover:text-foreground hover:bg-surface-container')
          }
        >
          {tab === 'overview'
            ? 'Overview'
            : tab === 'process'
            ? 'Process'
            : tab === 'group'
            ? (
              <span className="flex items-center gap-1.5">
                <span>Group</span>
                {processingLocked && (
                  <span className="text-ui-meta uppercase tracking-wide text-amber-100/90 [text-shadow:_0_1px_2px_rgb(0_0_0_/_20%)]">
                    🔒 Processing…
                  </span>
                )}
              </span>
            )
            : tab === 'notes'
            ? 'Notes'
            : 'Logs'}
        </button>
      ))}
    </div>
  );
}
