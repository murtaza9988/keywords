"use client";

import React from 'react';
import { ActiveKeywordView } from './types';
import { ExportControls } from './ExportControls';

interface ProjectDetailToolbarProps {
  activeView: ActiveKeywordView;
  onExportParentKeywords: () => Promise<void>;
  onImportParentKeywords: (file: File) => Promise<void>;
  onExportCSV: () => Promise<void>;
}

export function ProjectDetailToolbar({
  activeView,
  onExportParentKeywords,
  onImportParentKeywords,
  onExportCSV,
}: ProjectDetailToolbarProps): React.ReactElement {
  return (
    <div className="bg-surface border-b border-border">
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-end gap-2">
        <ExportControls
          activeView={activeView}
          onExportParentKeywords={onExportParentKeywords}
          onImportParentKeywords={onImportParentKeywords}
          onExportCSV={onExportCSV}
        />
      </div>
    </div>
  );
}
