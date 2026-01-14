"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';
import FileUploader from './FileUploader';
import CSVUploadDropdown from './CSVUploadDropdown';
import ProcessingProgressBar from './ProcessingProgressBar';
import { ProcessingStatus } from './types';

interface ProcessingPanelProps {
  projectId: string;
  isUploading: boolean;
  processingStatus: ProcessingStatus;
  processingMessage: string;
  displayProgress: number;
  processingCurrentFile: string | null;
  processingQueue: string[];
  csvUploadsRefreshKey?: number;
  onUploadStart: () => void;
  onUploadBatchStart: (files: File[]) => void;
  onUploadSuccess: (status: ProcessingStatus, message?: string) => void;
  onUploadError: (message: string) => void;
}

export function ProcessingPanel({
  projectId,
  isUploading,
  processingStatus,
  processingMessage,
  displayProgress,
  processingCurrentFile,
  processingQueue,
  csvUploadsRefreshKey,
  onUploadStart,
  onUploadBatchStart,
  onUploadSuccess,
  onUploadError,
}: ProcessingPanelProps): React.ReactElement {
  const isProcessing = processingStatus === 'queued' || processingStatus === 'processing';
  const showUploadLoader = isUploading || isProcessing;

  return (
    <div className="rounded-lg border border-border bg-surface-muted/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[220px] flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Upload CSVs</span>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[180px] max-w-[220px]">
              <FileUploader
                projectId={projectId}
                onUploadStart={onUploadStart}
                onUploadBatchStart={onUploadBatchStart}
                onUploadSuccess={onUploadSuccess}
                onUploadError={onUploadError}
              />
            </div>
            <CSVUploadDropdown projectId={projectId} refreshKey={csvUploadsRefreshKey} />
          </div>
        </div>
      </div>
      <div className="flex items-center h-6 mt-3">
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
        projectId={projectId}
        onReset={() => {
          // Trigger status refresh after reset
          onUploadSuccess('idle', 'Processing reset. You can now try uploading again.');
        }}
      />
    </div>
  );
}
