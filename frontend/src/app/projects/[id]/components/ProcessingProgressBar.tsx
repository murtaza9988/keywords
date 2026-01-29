// ProcessingProgressBar.tsx
import React, { useMemo, useState } from 'react';
import { ProcessingFileError, ProcessingStatus } from './types';
import { CheckCircle2, Loader2, AlertTriangle, RotateCcw, Wifi, FileX, Clock } from 'lucide-react';
import apiClient from '@/lib/apiClient';

interface ProcessingProgressBarProps {
  status: ProcessingStatus;
  progress: number;
  currentFileName?: string | null;
  queuedFiles?: string[];
  fileErrors?: ProcessingFileError[];
  uploadedFileCount?: number;
  processedFileCount?: number;
  uploadedFiles?: string[];
  processedFiles?: string[];
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
  fileErrors,
  uploadedFileCount,
  processedFileCount,
  uploadedFiles,
  processedFiles,
  message,
  stage,
  stageDetail,
  projectId,
  onReset,
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

  // Ensure progress is always between 0-100
  const safeProgress = Math.max(0, Math.min(100, progress));
  
  // Custom color based on progress
  const getBarColor = () => {
    if (status === 'error') return 'bg-danger';
    if (safeProgress < 30) return 'bg-accent';
    if (safeProgress < 60) return 'bg-accent';
    if (safeProgress < 90) return 'bg-success';
    return 'bg-success';
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
  const safeFileErrors = useMemo(
    () => fileErrors?.filter((error) => error && (error.fileName || error.message)) ?? [],
    [fileErrors]
  );
  const safeUploadedFiles = useMemo(() => uploadedFiles ?? [], [uploadedFiles]);
  const safeProcessedFiles = useMemo(() => processedFiles ?? [], [processedFiles]);
  const queuedList = useMemo(() => queuedFiles ?? [], [queuedFiles]);
  const processedSet = useMemo(() => new Set(safeProcessedFiles), [safeProcessedFiles]);
  const totalFiles = useMemo(
    () => uploadedFileCount ?? safeUploadedFiles.length,
    [uploadedFileCount, safeUploadedFiles]
  );
  const processedCount = useMemo(
    () => processedFileCount ?? safeProcessedFiles.length,
    [processedFileCount, safeProcessedFiles]
  );
  const showUploadSummary = useMemo(
    () => totalFiles > 0 || safeUploadedFiles.length > 0 || safeProcessedFiles.length > 0,
    [totalFiles, safeUploadedFiles, safeProcessedFiles]
  );
  const queueItems = useMemo(
    () => [
      ...(currentFileName ? [{ name: currentFileName, status: 'current' as const }] : []),
      ...queuedList.map((file) => ({ name: file, status: 'queued' as const })),
    ],
    [currentFileName, queuedList]
  );
  const queuedCount = queueItems.length;

  // Enhanced error type detection
  const getErrorIcon = (error: ProcessingFileError) => {
    const message = error.message?.toLowerCase() || '';
    const stage = error.stage?.toLowerCase() || '';

    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return <Wifi className="h-4 w-4 text-orange-500" />;
    }
    if (message.includes('validation') || message.includes('format') || message.includes('invalid')) {
      return <FileX className="h-4 w-4 text-red-500" />;
    }
    if (stage.includes('duplicate') || message.includes('duplicate')) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    return <AlertTriangle className="h-4 w-4 text-red-500" />;
  };

  // Estimated time calculation (rough estimate based on file size and processing stage)
  const getEstimatedTimeRemaining = useMemo(() => {
    if (status !== 'processing' && status !== 'queued') return null;
    
    const remainingFiles = queuedCount;
    if (remainingFiles === 0) return 'Completing...';
    
    // Rough estimate: 30 seconds per file for processing
    const estimatedSeconds = remainingFiles * 30;
    if (estimatedSeconds < 60) return '< 1 min remaining';
    if (estimatedSeconds < 3600) return `${Math.ceil(estimatedSeconds / 60)} min remaining`;
    return `${Math.ceil(estimatedSeconds / 3600)} hr remaining`;
  }, [status, queuedCount]);

  const shouldHide = status === 'idle' && !showUploadSummary && safeFileErrors.length === 0;
  if (shouldHide) {
    return null;
  }

  return (
    <div className="w-full mt-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-1 text-ui-muted">
        <div className="flex flex-wrap items-center justify-between gap-2 text-foreground">
          {status === 'error' ? (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-danger" />
              <span className="text-danger font-medium">Processing failed</span>
              {projectId && (
                <button
                  onClick={handleReset}
                  disabled={isResetting}
                  className="ml-2 inline-flex items-center gap-1 rounded-md bg-error-container px-2 py-1 text-ui-meta font-medium text-danger hover:bg-error-container disabled:opacity-50 transition-colors"
                >
                  <RotateCcw className={`h-3 w-3 ${isResetting ? 'animate-spin' : ''}`} />
                  {isResetting ? 'Resetting...' : 'Reset & Retry'}
                </button>
              )}
            </div>
          ) : status === 'idle' ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-muted" />
              <span>
                {showUploadSummary
                  ? 'Last upload summary'
                  : 'Idle'
                }
              </span>
            </>
          ) : (
            <>
              {status === 'complete' ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
              )}
              <span>
                {status === 'queued'
                  ? 'Queued for processing...'
                  : status === 'complete'
                    ? 'Processing complete.'
                    : `Processing CSV: ${Math.round(safeProgress)}%`
                }
              </span>
              {getEstimatedTimeRemaining && (
                <span className="text-ui-meta text-sm">
                  {getEstimatedTimeRemaining}
                </span>
              )}
            </>
          )}
        </div>
        {message && (
          <span className="text-ui-muted">{message}</span>
        )}
        {stageDetail && (
          <span className="text-ui-muted">{stageDetail}</span>
        )}
        {stage && status === 'processing' && (
          <span className="text-ui-muted">Stage: {stage}</span>
        )}
        {currentFileName && (
          <span className="text-ui-muted">Current file: {currentFileName}</span>
        )}
        {queuedCount > 0 && (
          <span className="text-ui-muted">Queued files: {queuedCount}</span>
        )}
        {showUploadSummary && (
          <span className="text-ui-muted">
            Processed {processedCount}/{totalFiles} CSVs
          </span>
        )}
      </div>
      {showUploadSummary && (
        <div className="mt-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-ui-muted">
          <div className="flex items-center justify-between text-ui-label">
            <span>Uploads</span>
            <span className="text-ui-meta font-medium">
              Processed {processedCount}/{totalFiles} CSVs
            </span>
          </div>
          {safeUploadedFiles.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {safeUploadedFiles.map((file) => {
                const isProcessed = processedSet.has(file);
                return (
                  <li key={file} className="flex items-center gap-2">
                    {isProcessed ? (
                      <CheckCircle2 className="h-3 w-3 text-success" />
                    ) : (
                      <span className="h-3 w-3 rounded-full border border-border" />
                    )}
                    <span className={isProcessed ? 'text-foreground' : 'text-ui-muted'}>
                      {file}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-2 text-ui-muted">No uploaded files yet.</div>
          )}
        </div>
      )}
      {queueItems.length > 0 && (
        <div className="mt-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-ui-muted">
          <div className="flex items-center justify-between">
            <div className="text-ui-label flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Queue ({queueItems.length})
              {getEstimatedTimeRemaining && (
                <span className="text-ui-meta text-xs">
                  ~{getEstimatedTimeRemaining}
                </span>
              )}
            </div>
          </div>
          <ol className="mt-2 space-y-1">
            {queueItems.map((file, index) => (
              <li key={`${file.name}-${file.status}`} className="flex items-center gap-2">
                {file.status === 'current' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent flex-shrink-0" />
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-ui-meta text-xs">#{index + 1}</span>
                    <Clock className="h-3 w-3 text-muted" />
                  </div>
                )}
                <span className={file.status === 'current' ? 'text-accent font-medium' : 'text-ui-muted'}>
                  {file.name}
                </span>
                <span className="text-ui-meta">
                  {file.status === 'current' ? 'Processing...' : 'Queued'}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {safeFileErrors.length > 0 && (
        <div className="mt-2 rounded-md border border-error-container bg-error-container px-3 py-2 text-ui-meta text-danger">
          <div className="text-ui-label text-danger flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            File errors ({safeFileErrors.length})
          </div>
          <ul className="mt-2 space-y-1">
            {safeFileErrors.map((error, index) => (
              <li key={`${error.fileName ?? 'unknown'}-${index}`} className="flex flex-col">
                <div className="flex items-start gap-2">
                  {getErrorIcon(error)}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-danger">
                      {error.fileName ?? 'Unknown file'}
                    </span>
                    <span className="text-danger/90 block">{error.message ?? 'Unknown error'}</span>
                    {error.stageDetail && (
                      <span className="text-danger/80 text-xs block mt-1">{error.stageDetail}</span>
                    )}
                  </div>
                </div>
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
            <div key={step.key} className="flex items-center gap-2 text-ui-meta">
              {isComplete ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : isError ? (
                <AlertTriangle className="h-4 w-4 text-danger" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
              ) : (
                <span className="h-4 w-4 rounded-full border border-border" />
              )}
              <span
                className={`${
                  isComplete ? 'text-foreground' : isActive ? 'text-accent font-medium' : isError ? 'text-danger' : 'text-muted'
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
