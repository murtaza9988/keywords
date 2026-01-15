"use client";

import React from 'react';
import { ProcessingPanel } from './ProcessingPanel';
import { ProcessingFileError, ProcessingStatus } from './types';
import apiClient from '@/lib/apiClient';
import { Button } from '@/components/ui/Button';

interface ProjectStatsSummary {
  totalKeywords: number;
  totalParentKeywords: number;
  parentTokenCount: number;
  childTokenCount: number;
  groupCount: number;
  groupedPages: number;
  confirmedPages: number;
  blockedCount: number;
}

interface ProjectDetailOverviewProps {
  projectId: string;
  stats: ProjectStatsSummary;
  totalChildKeywords: number;
  isUploading: boolean;
  processingStatus: ProcessingStatus;
  processingMessage: string;
  processingStage?: string | null;
  processingStageDetail?: string | null;
  displayProgress: number;
  processingCurrentFile: string | null;
  processingQueue: string[];
  processingUploadedFiles: string[];
  processingProcessedFiles: string[];
  processingFileErrors: ProcessingFileError[];
  csvUploadsRefreshKey?: number;
  onUploadStart: () => void;
  onUploadBatchStart: (files: File[]) => void;
  onUploadSuccess: (status: ProcessingStatus, message?: string) => void;
  onUploadError: (message: string) => void;
}

export function ProjectDetailOverview({
  projectId,
  stats,
  totalChildKeywords,
  isUploading,
  processingStatus,
  processingMessage,
  processingStage,
  processingStageDetail,
  displayProgress,
  processingCurrentFile,
  processingQueue,
  processingUploadedFiles,
  processingProcessedFiles,
  processingFileErrors,
  csvUploadsRefreshKey,
  onUploadStart,
  onUploadBatchStart,
  onUploadSuccess,
  onUploadError,
}: ProjectDetailOverviewProps): React.ReactElement {
  const downloadOutput = async (view: 'grouped' | 'confirmed') => {
    const blobData = await apiClient.exportGroupedKeywords(projectId, view);
    const url = window.URL.createObjectURL(blobData);
    const link = document.createElement('a');
    link.href = url;
    const filename =
      `${view}_keywords_${projectId}_` + new Date().toISOString().slice(0, 10) + '.csv';
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-4">
      <ProcessingPanel
        projectId={projectId}
        isUploading={isUploading}
        processingStatus={processingStatus}
        processingMessage={processingMessage}
        processingStage={processingStage}
        processingStageDetail={processingStageDetail}
        displayProgress={displayProgress}
        processingCurrentFile={processingCurrentFile}
        processingQueue={processingQueue}
        processingUploadedFiles={processingUploadedFiles}
        processingProcessedFiles={processingProcessedFiles}
        processingFileErrors={processingFileErrors}
        csvUploadsRefreshKey={csvUploadsRefreshKey}
        onUploadStart={onUploadStart}
        onUploadBatchStart={onUploadBatchStart}
        onUploadSuccess={onUploadSuccess}
        onUploadError={onUploadError}
      />
      <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Downloads</p>
            <p className="text-xs text-muted">
              Uploaded CSVs (including combined batch CSVs) are downloadable via the “CSV Uploads” dropdown. Final output
              CSV is generated from the database via Export.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => downloadOutput('grouped')}>
              Download grouped output CSV
            </Button>
            <Button size="sm" variant="secondary" onClick={() => downloadOutput('confirmed')}>
              Download confirmed output CSV
            </Button>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total keywords uploaded</p>
          <p className="text-lg font-semibold text-foreground">{stats.totalKeywords.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total parent keywords</p>
          <p className="text-lg font-semibold text-foreground">{stats.totalParentKeywords.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total child keywords</p>
          <p className="text-lg font-semibold text-foreground">{totalChildKeywords.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Parent tokens</p>
          <p className="text-lg font-semibold text-foreground">{stats.parentTokenCount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Child tokens</p>
          <p className="text-lg font-semibold text-foreground">{stats.childTokenCount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total groups</p>
          <p className="text-lg font-semibold text-foreground">{stats.groupCount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Grouped pages</p>
          <p className="text-lg font-semibold text-foreground">{stats.groupedPages.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Confirmed pages</p>
          <p className="text-lg font-semibold text-foreground">{stats.confirmedPages.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Blocked parent keywords</p>
          <p className="text-lg font-semibold text-foreground">{stats.blockedCount.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
