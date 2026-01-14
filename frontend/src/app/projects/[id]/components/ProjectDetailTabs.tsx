"use client";

import React from 'react';

export type ProjectDetailTab = 'overview' | 'process' | 'group' | 'notes' | 'logs';

interface ProjectDetailTabsProps {
  activeTab: ProjectDetailTab;
  onTabChange: (tab: ProjectDetailTab) => void;
}

export function ProjectDetailTabs({
  activeTab,
  onTabChange,
}: ProjectDetailTabsProps): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-2 border border-border rounded-lg bg-surface-muted/40 p-1 mb-4 justify-center">
      {(['overview', 'process', 'group', 'notes', 'logs'] as const).map(tab => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={
            'px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ' +
            (activeTab === tab
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-muted hover:text-foreground hover:bg-surface-muted')
          }
        >
          {tab === 'overview'
            ? 'Overview'
            : tab === 'process'
            ? 'Process'
            : tab === 'group'
            ? 'Group'
            : tab === 'notes'
            ? 'Notes'
            : 'Logs'}
        </button>
      ))}
    </div>
  );
}
