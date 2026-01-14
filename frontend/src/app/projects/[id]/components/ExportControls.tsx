"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ActiveKeywordView } from './types';

interface ExportControlsProps {
  activeView: ActiveKeywordView;
  onExportParentKeywords: () => Promise<void>;
  onImportParentKeywords: (file: File) => Promise<void>;
  onExportCSV: () => Promise<void>;
}

export function ExportControls({
  activeView,
  onExportParentKeywords,
  onImportParentKeywords,
  onExportCSV,
}: ExportControlsProps): React.ReactElement {
  const [isExportingParent, setIsExportingParent] = useState(false);
  const [isImportingParent, setIsImportingParent] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportParent = async () => {
    setIsExportingParent(true);
    try {
      await onExportParentKeywords();
    } finally {
      setIsExportingParent(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExportCSV();
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportParent = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImportingParent(true);
    try {
      await onImportParentKeywords(file);
    } finally {
      setIsImportingParent(false);
      event.target.value = '';
    }
  };

  return (
    <>
      <Button
        onClick={handleExportParent}
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
          onChange={handleImportParent}
          className="hidden"
          disabled={isImportingParent}
        />
      </label>

      <Button
        onClick={handleExport}
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
    </>
  );
}
