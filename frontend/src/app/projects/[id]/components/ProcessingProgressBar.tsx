// ProcessingProgressBar.tsx
import React, { useState } from 'react';
import { ProcessingFileError, ProcessingStatus } from './types';
import { CheckCircle2, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import apiClient from '@/lib/apiClient';

const STAGE_LABELS: Record<string, string> = {
  db_prepare: 'Preparing database',
  read_csv: 'Reading CSV',
  count_rows: 'Counting rows',
  import_rows: 'Importing rows',
  persist: 'Saving keywords',
  group: 'Grouping keywords',
  complete: 'Complete',
};

const buildOrderedFileList = ({
  uploadedFiles,
  processedFiles,
  queuedFiles,
  currentFileName,
  fileErrors,
}: {
  uploadedFiles: string[];
  processedFiles: string[];
  queuedFiles: string[];
  currentFileName?: string | null;
  fileErrors: ProcessingFileError[];
}): string[] => {
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (name?: string | null) => {
    if (!name) return;
    if (seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };

  if (uploadedFiles.length > 0) {
    uploadedFiles.forEach(add);
  }
  add(currentFileName);
  queuedFiles.forEach(add);
  processedFiles.forEach(add);
  fileErrors.forEach((error) => add(error.fileName));

  return names;
};

const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  count === 1 ? singular : plural;

interface ProcessingProgressBarProps {
  status: ProcessingStatus;
  progress: number;
  currentFileName?: string | null;
  queuedFiles?: string[];
  uploadedFiles?: string[];
  processedFiles?: string[];
  fileErrors?: ProcessingFileError[];
  message?: string;
  stage?: string | null;
  stageDetail?: string | null;
  projectId?: string;
  onReset?: () => void;
}

const ProcessingProgressBar: React.FC<ProcessingProgressBarProps> = ({ 
  status, 
  progress,
  currentFileName,
  queuedFiles,
  uploadedFiles,
  processedFiles,
  fileErrors,
  message,
  stage,
  stageDetail,
  projectId,
  onReset
}) => {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!projectId || isResetting) return;
    
    setIsResetting(true);
    try {
      await apiClient.resetProcessing(projectId);
      onReset?.();
    } catch (error) {
      console.error('Failed to reset processing:', error);
    } finally {
      setIsResetting(false);
    }
  };
  if (status === 'idle') {
    return null;
  }

  // Ensure progress is always between 0-100
  const safeProgress = Math.max(0, Math.min(100, progress));
  
  // Custom color based on progress
  const getBarColor = () => {
    if (status === 'error') return 'bg-red-500';
    if (safeProgress < 30) return 'bg-blue-500';
    if (safeProgress < 60) return 'bg-blue-600';
    if (safeProgress < 90) return 'bg-green-500';
    return 'bg-green-600';
  };

  const steps = [
    { key: 'upload', label: 'Upload CSV(s)' },
    { key: 'combine', label: 'Combine (chunks/batch)' },
    { key: 'queue', label: 'Queue processing' },
    { key: 'import', label: 'Import rows (validate → tokenize → dedupe)' },
    { key: 'persist', label: 'Save keywords to database' },
    { key: 'group', label: 'Final grouping pass' },
    { key: 'complete', label: 'Complete' },
  ];

  const processingStageToStepIndex = (s?: string | null): number => {
    switch (s) {
      case 'db_prepare':
      case 'read_csv':
      case 'count_rows':
      case 'import_rows':
        return 4;
      case 'persist':
        return 5;
      case 'group':
        return 6;
      case 'complete':
        return 7;
      default:
        return 4;
    }
  };

  const activeStep = (() => {
    if (status === 'uploading') return 1;
    if (status === 'combining') return 2;
    if (status === 'queued') return 3;
    if (status === 'processing') return processingStageToStepIndex(stage);
    if (status === 'complete') return 7;
    if (status === 'error') return stage ? processingStageToStepIndex(stage) : 4;
    return 0;
  })();
  const queuedCount = queuedFiles?.length ?? 0;
  const safeFileErrors = fileErrors?.filter((error) => error && (error.fileName || error.message)) ?? [];
  const safeUploadedFiles = uploadedFiles ?? [];
  const safeProcessedFiles = processedFiles ?? [];
  const processedFileSet = new Set(safeProcessedFiles);
  const queuedFileSet = new Set(queuedFiles ?? []);
  const errorMap = new Map(
    safeFileErrors
      .filter((error) => error.fileName)
      .map((error) => [error.fileName as string, error])
  );
  const currentStageLabel = stage ? STAGE_LABELS[stage] || stage : null;
  const fileStatusLabel = {
    combining: 'Combining',
    uploading: 'Uploading',
  }[status] ?? 'Uploaded';

  const orderedFiles = buildOrderedFileList({
    uploadedFiles: safeUploadedFiles,
    processedFiles: safeProcessedFiles,
    queuedFiles: queuedFiles ?? [],
    currentFileName,
    fileErrors: safeFileErrors,
  });
  const totalFileCount = safeUploadedFiles.length;
  const processedFileCount = safeProcessedFiles.length;
  const fileSummary = totalFileCount > 0
    ? `${processedFileCount}/${totalFileCount} ${pluralize(totalFileCount, 'file')} processed`
    : null;
  const statusText = status === 'queued'
    ? 'Queued for processing...'
    : status === 'complete'
      ? `Processed ${processedFileCount} ${pluralize(processedFileCount, 'file')}.`
      : `Processing CSV: ${Math.round(safeProgress)}%`;

  return (
    <div className="w-full mt-3 rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-1 text-xs text-muted">
        <div className="flex flex-wrap items-center justify-between gap-2 text-foreground">
          {status === 'error' ? (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-red-600">Processing failed</span>
              {projectId && (
                <button
                  onClick={handleReset}
                  disabled={isResetting}
                  className="ml-2 inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors"
                >
                  <RotateCcw className={`h-3 w-3 ${isResetting ? 'animate-spin' : ''}`} />
                  {isResetting ? 'Resetting...' : 'Reset & Retry'}
                </button>
              )}
            </div>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span>{statusText}</span>
            </>
          )}
        </div>
        {message && (
          <span className="text-xs text-muted">{message}</span>
        )}
        {stageDetail && (
          <span className="text-xs text-muted">{stageDetail}</span>
        )}
        {stage && status === 'processing' && (
          <span className="text-xs text-muted">Stage: {stage}</span>
        )}
        {currentFileName && (
          <span className="text-xs text-muted">Current file: {currentFileName}</span>
        )}
        {queuedCount > 0 && (
          <span className="text-xs text-muted">Queued files: {queuedCount}</span>
        )}
      </div>
      {orderedFiles.length > 0 && (
        <div className="mt-2 rounded-md border border-border bg-surface-muted/40 px-3 py-2 text-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted">
            <span>Files</span>
            {fileSummary && <span>{fileSummary}</span>}
          </div>
          <ol className="mt-2 space-y-2">
            {orderedFiles.map((fileName, index) => {
              const errorEntry = errorMap.get(fileName);
              const isCurrent = currentFileName === fileName && status !== 'error';
              const isComplete = processedFileSet.has(fileName);
              const isQueued = queuedFileSet.has(fileName);
              const isUploading = ['uploading', 'combining'].includes(status);
              const detail = errorEntry?.stageDetail
                || errorEntry?.message
                || (isCurrent ? stageDetail || currentStageLabel : null);

              if (errorEntry) {
                return (
                  <li key={`${fileName}-${index}`} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" />
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-red-700">{fileName}</span>
                      <span className="text-[11px] text-red-600">Error</span>
                      {detail && <span className="text-[11px] text-red-500">{detail}</span>}
                    </div>
                  </li>
                );
              }

              if (isComplete) {
                return (
                  <li key={`${fileName}-${index}`} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500" />
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-foreground">{fileName}</span>
                      <span className="text-[11px] text-green-600">Complete</span>
                    </div>
                  </li>
                );
              }

              if (isCurrent) {
                return (
                  <li key={`${fileName}-${index}`} className="flex items-start gap-2">
                    <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-blue-500" />
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-foreground">{fileName}</span>
                      <span className="text-[11px] text-blue-600">Processing</span>
                      {detail && <span className="text-[11px] text-muted">{detail}</span>}
                    </div>
                  </li>
                );
              }

              if (isQueued) {
                return (
                  <li key={`${fileName}-${index}`} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-gray-300" />
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-foreground">{fileName}</span>
                      <span className="text-[11px] text-muted">Queued</span>
                    </div>
                  </li>
                );
              }

              return (
                <li key={`${fileName}-${index}`} className="flex items-start gap-2">
                  {isUploading ? (
                    <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-blue-400" />
                  ) : (
                    <span className="mt-1 h-2 w-2 rounded-full bg-gray-200" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-foreground">{fileName}</span>
                    <span className="text-[11px] text-muted">{fileStatusLabel}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {safeFileErrors.length > 0 && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-red-600">
            File errors
          </div>
          <ul className="mt-2 space-y-1">
            {safeFileErrors.map((error, index) => (
              <li key={`${error.fileName ?? 'unknown'}-${index}`} className="flex flex-col">
                <span className="font-medium text-red-700">
                  {error.fileName ?? 'Unknown file'}
                </span>
                <span className="text-red-600">{error.message ?? 'Unknown error'}</span>
                {error.stageDetail && (
                  <span className="text-red-500">{error.stageDetail}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {steps.map((step, index) => {
          const stepIndex = index + 1;
          const isComplete = status === 'complete'
            ? stepIndex <= activeStep
            : status !== 'error' && stepIndex < activeStep;
          const isActive = status !== 'error' && status !== 'complete' && stepIndex === activeStep;
          const isError = status === 'error' && stepIndex === activeStep;

          return (
            <div key={step.key} className="flex items-center gap-2 text-xs">
              {isComplete ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : isError ? (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              ) : (
                <span className="h-4 w-4 rounded-full border border-gray-300" />
              )}
              <span
                className={`${
                  isComplete ? 'text-foreground' : isActive ? 'text-blue-600' : isError ? 'text-red-600' : 'text-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${getBarColor()}`}
          style={{
            width: `${safeProgress}%`,
            transition: 'width 0.3s ease-out'
          }}
        />
      </div>
    </div>
  );
};

export default ProcessingProgressBar;
