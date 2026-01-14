"use client";

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ActiveKeywordView } from './types';

interface ProjectDetailToolbarProps {
  activeView: ActiveKeywordView;
  isExportingParent: boolean;
  isImportingParent: boolean;
  isExporting: boolean;
  onExportParentKeywords: () => void;
  onImportParentKeywords: (file: File) => void;
  onExportCSV: () => void;
}

export function ProjectDetailToolbar({
  activeView,
  isExportingParent,
  isImportingParent,
  isExporting,
  onExportParentKeywords,
  onImportParentKeywords,
  onExportCSV,
}: ProjectDetailToolbarProps): React.ReactElement {
  return (
    <div className="bg-surface border-b border-border">
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-end gap-2">
        <Button
          onClick={onExportParentKeywords}
          disabled={isExportingParent}
          size="sm"
          className="px-2 py-1 text-[11px]"
        >
          {isExportingParent ? (
            <>
              <Spinner size="sm" className="border-muted border-t-foreground" />
              Exporting...
            </>
          ) : (
            'Export Parent KWs'
          )}
        </Button>
        <label className="inline-flex items-center">
          <span className="sr-only">Import Parent KWs</span>
          <Button disabled={isImportingParent} size="sm" className="px-2 py-1 text-[11px]">
            {isImportingParent ? (
              <>
                <Spinner size="sm" className="border-white/40 border-t-white" />
                Importing...
              </>
            ) : (
              'Import Parent KWs'
            )}
          </Button>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onImportParentKeywords(file);
                e.target.value = '';
              }
            }}
            className="hidden"
            disabled={isImportingParent}
          />
        </label>

        <Button
          onClick={onExportCSV}
          disabled={(activeView !== 'grouped' && activeView !== 'confirmed') || isExporting}
          variant="secondary"
        >
          {isExporting ? (
            <>
              <Spinner size="sm" className="border-white/40 border-t-white" />
              Exporting...
            </>
          ) : (
            'Export'
          )}
        </Button>
      </div>
    </div>
  );
}
