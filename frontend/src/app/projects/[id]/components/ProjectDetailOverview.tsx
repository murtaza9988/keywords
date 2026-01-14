"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';
import FileUploader from './FileUploader';
import CSVUploadDropdown from './CSVUploadDropdown';
import ProcessingProgressBar from './ProcessingProgressBar';
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
  showUploadLoader: boolean;
  isUploading: boolean;
  processingStatus: ProcessingStatus;
  processingMessage: string;
  displayProgress: number;
  processingCurrentFile: string | null;
  processingQueue: string[];
  onUploadStart: () => void;
  onUploadSuccess: (status: ProcessingStatus, message?: string) => void;
  onUploadError: (message: string) => void;
}

export function ProjectDetailOverview({
  projectId,
  stats,
  totalChildKeywords,
  showUploadLoader,
  isUploading,
  processingStatus,
  processingMessage,
  displayProgress,
  processingCurrentFile,
  processingQueue,
  onUploadStart,
  onUploadSuccess,
  onUploadError,
}: ProjectDetailOverviewProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-surface-muted/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-[220px] flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Upload CSVs</span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[180px] max-w-[220px]">
                <FileUploader
                  projectId={projectId}
                  onUploadStart={onUploadStart}
                  onUploadSuccess={onUploadSuccess}
                  onUploadError={onUploadError}
                />
              </div>
              <CSVUploadDropdown projectId={projectId} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center h-6">
        {showUploadLoader ? (
          <div className="flex items-center text-blue-600">
            <Loader2 size={16} className="animate-spin mr-2" />
            <span className="text-xs">
              {isUploading ? "Uploading..." : "Processing..."}
            </span>
          </div>
        ) : processingStatus === 'error' && !isUploading ? (
          <div className="text-red-600 text-xs">
            {processingMessage || 'Processing failed. Try uploading again.'}
          </div>
        ) : (
          <span className="text-xs text-transparent">Status</span>
        )}
      </div>
      <ProcessingProgressBar
        status={processingStatus}
        progress={displayProgress}
        currentFileName={processingCurrentFile}
        queuedFiles={processingQueue}
        message={processingMessage}
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
