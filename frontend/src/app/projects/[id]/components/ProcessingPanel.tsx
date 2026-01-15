"use client";

import React from 'react';
import FileUploader from './FileUploader';
import CSVUploadDropdown from './CSVUploadDropdown';
import ProcessingProgressBar from './ProcessingProgressBar';
import { ProcessingFileError, ProcessingStatus } from './types';

interface ProcessingPanelProps {
  projectId: string;
  isUploading: boolean;
  processingStatus: ProcessingStatus;
  processingMessage: string;
  displayProgress: number;
  processingCurrentFile: string | null;
  processingQueue: string[];
  processingFileErrors: ProcessingFileError[];
  uploadedFileCount: number;
  processedFileCount: number;
  uploadedFiles: string[];
  processedFiles: string[];
  processingStage?: string | null;
  processingStageDetail?: string | null;
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
  processingFileErrors,
  uploadedFileCount,
  processedFileCount,
  uploadedFiles,
  processedFiles,
  processingStage,
  processingStageDetail,
  csvUploadsRefreshKey,
  onUploadStart,
  onUploadBatchStart,
  onUploadSuccess,
  onUploadError,
}: ProcessingPanelProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-border bg-white px-4 py-4 shadow-sm">
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
          {isUploading && (
            <span className="text-xs text-blue-600">Uploading files...</span>
          )}
        </div>
      </div>
      <ProcessingProgressBar
        status={processingStatus}
        progress={displayProgress}
        currentFileName={processingCurrentFile}
        queuedFiles={processingQueue}
        fileErrors={processingFileErrors}
        uploadedFileCount={uploadedFileCount}
        processedFileCount={processedFileCount}
        uploadedFiles={uploadedFiles}
        processedFiles={processedFiles}
        message={processingMessage}
        stage={processingStage}
        stageDetail={processingStageDetail}
        projectId={projectId}
        onReset={() => {
          // Trigger status refresh after reset
          onUploadSuccess('idle', 'Processing reset. You can now try uploading again.');
        }}
      />
    </div>
  );
}
