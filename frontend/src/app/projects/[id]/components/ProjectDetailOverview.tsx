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
  processingSucceededJobs?: number;
  processingFailedJobs?: number;
  processingFileErrors: ProcessingFileError[];
  csvUploadsRefreshKey?: number;
  uploadedFiles?: string[];
  processedFiles?: string[];
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
  processingSucceededJobs,
  processingFailedJobs,
  processingFileErrors,
  csvUploadsRefreshKey,
  uploadedFiles,
  processedFiles,
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
        processingFileErrors={processingFileErrors}
        csvUploadsRefreshKey={csvUploadsRefreshKey}
        uploadedFiles={uploadedFiles}
        processedFiles={processedFiles}
        onUploadStart={onUploadStart}
        onUploadBatchStart={onUploadBatchStart}
        onUploadSuccess={onUploadSuccess}
        onUploadError={onUploadError}
      />
      <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-ui-label">Downloads</p>
            <p className="text-ui-muted">
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
          <p className="text-ui-label">CSV files successfully processed</p>
          <p className="text-ui-heading">{(processingSucceededJobs ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-ui-label">CSV files failed</p>
          <p className="text-ui-heading">{(processingFailedJobs ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-ui-label">Total keywords uploaded</p>
          <p className="text-ui-heading">{stats.totalKeywords.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-ui-label">Total parent keywords</p>
          <p className="text-ui-heading">{stats.totalParentKeywords.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-ui-label">Total child keywords</p>
          <p className="text-ui-heading">{totalChildKeywords.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-ui-label">Parent tokens</p>
          <p className="text-ui-heading">{stats.parentTokenCount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-ui-label">Child tokens</p>
          <p className="text-ui-heading">{stats.childTokenCount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-ui-label">Total groups</p>
          <p className="text-ui-heading">{stats.groupCount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-ui-label">Grouped pages</p>
          <p className="text-ui-heading">{stats.groupedPages.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-ui-label">Confirmed pages</p>
          <p className="text-ui-heading">{stats.confirmedPages.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-ui-label">Blocked parent keywords</p>
          <p className="text-ui-heading">{stats.blockedCount.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
