"use client";

import React from 'react';
import { ProcessingPanel } from './ProcessingPanel';
import { ProcessingStatus } from './types';

interface ProjectStatsSummary {
  totalKeywords: number;
  totalParentKeywords: number;
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
  displayProgress: number;
  processingCurrentFile: string | null;
  processingQueue: string[];
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
  displayProgress,
  processingCurrentFile,
  processingQueue,
  onUploadStart,
  onUploadBatchStart,
  onUploadSuccess,
  onUploadError,
}: ProjectDetailOverviewProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <ProcessingPanel
        projectId={projectId}
        isUploading={isUploading}
        processingStatus={processingStatus}
        processingMessage={processingMessage}
        displayProgress={displayProgress}
        processingCurrentFile={processingCurrentFile}
        processingQueue={processingQueue}
        onUploadStart={onUploadStart}
        onUploadSuccess={onUploadSuccess}
        onUploadError={onUploadError}
      />
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
