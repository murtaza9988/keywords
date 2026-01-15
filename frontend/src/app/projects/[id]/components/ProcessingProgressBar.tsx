import React, { useMemo, useState } from 'react';
import { ProcessingFileError, ProcessingStatus } from './types';
import { CheckCircle2, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
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

const steps = [
  { key: 'upload', label: 'Upload' },
  { key: 'combine', label: 'Combine' },
  { key: 'queue', label: 'Queue' },
  { key: 'import', label: 'Import' },
  { key: 'persist', label: 'Persist' },
  { key: 'group', label: 'Group' },
  { key: 'complete', label: 'Complete' },
] as const;

type StepKey = typeof steps[number]['key'];

const stageLabelMap: Record<string, string> = {
  db_prepare: 'Prepare database',
  read_csv: 'Read CSV',
  count_rows: 'Count rows',
  import_rows: 'Import rows',
  persist: 'Persist keywords',
  group: 'Group keywords',
  complete: 'Complete',
};

const stepIndexByKey = new Map<StepKey, number>(
  steps.map((step, index) => [step.key, index])
);

const stageToStepKey = (value?: string | null): StepKey => {
  switch (value) {
    case 'db_prepare':
    case 'read_csv':
    case 'count_rows':
    case 'import_rows':
      return 'import';
    case 'persist':
      return 'persist';
    case 'group':
      return 'group';
    case 'complete':
      return 'complete';
    case 'queue':
      return 'queue';
    default:
      return 'import';
  }
};

const statusToStepKey = (value: ProcessingStatus, currentStage?: string | null): StepKey => {
  switch (value) {
    case 'uploading':
      return 'upload';
    case 'combining':
      return 'combine';
    case 'queued':
      return 'queue';
    case 'processing':
      return stageToStepKey(currentStage);
    case 'complete':
      return 'complete';
    case 'error':
      return stageToStepKey(currentStage);
    default:
      return 'upload';
  }
};

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

  if (status === 'idle') {
    return null;
  }

  const safeProgress = Math.max(0, Math.min(100, progress));
  const safeFileErrors = fileErrors?.filter((error) => error && (error.fileName || error.message)) ?? [];
  const namedErrors = safeFileErrors.filter((error) => Boolean(error.fileName));
  const generalErrors = safeFileErrors.filter((error) => !error.fileName);
  const errorMap = new Map(
    namedErrors.map((error) => [error.fileName as string, error])
  );
  const safeUploadedFiles = uploadedFiles ?? [];
  const safeProcessedFiles = processedFiles ?? [];
  const queuedList = queuedFiles ?? [];
  const processedSet = new Set(safeProcessedFiles);
  const queuedSet = new Set(queuedList);
  const fileList = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    const addFile = (name?: string | null) => {
      if (!name || seen.has(name)) return;
      seen.add(name);
      ordered.push(name);
    };

    queuedList.forEach(addFile);
    safeUploadedFiles.forEach(addFile);
    addFile(currentFileName);
    safeProcessedFiles.forEach(addFile);
    errorMap.forEach((_, fileName) => addFile(fileName));

    return ordered;
  }, [queuedList, safeUploadedFiles, currentFileName, safeProcessedFiles, errorMap]);

  const derivedTotalFiles = uploadedFileCount
    ?? Math.max(fileList.length, safeUploadedFiles.length, safeProcessedFiles.length);
  const totalFiles = Math.max(derivedTotalFiles, processedFileCount ?? 0);
  const processedCount = processedFileCount ?? safeProcessedFiles.length;
  const allFilesComplete = totalFiles > 0 && processedCount >= totalFiles;
  const effectiveStatus = status === 'error' ? 'error' : allFilesComplete ? 'complete' : status;
  const normalizedProgress = allFilesComplete ? 100 : safeProgress;
  const uploadStepKey = status === 'combining' ? 'combine' : 'upload';
  const stageLabel = stage ? (stageLabelMap[stage] ?? stage.replace(/_/g, ' ')) : null;

  const getBarColor = () => {
    if (effectiveStatus === 'error') return 'bg-red-500';
    if (normalizedProgress < 30) return 'bg-blue-500';
    if (normalizedProgress < 60) return 'bg-blue-600';
    if (normalizedProgress < 90) return 'bg-green-500';
    return 'bg-green-600';
  };

  const statusTone = (() => {
    switch (effectiveStatus) {
      case 'error':
        return { label: 'Error', className: 'bg-red-50 text-red-700 border-red-200' };
      case 'complete':
        return { label: 'Complete', className: 'bg-green-50 text-green-700 border-green-200' };
      case 'queued':
        return { label: 'Queued', className: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'processing':
        return { label: 'Processing', className: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'combining':
        return { label: 'Combining', className: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'uploading':
        return { label: 'Uploading', className: 'bg-blue-50 text-blue-700 border-blue-200' };
      default:
        return { label: 'In progress', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
  })();

  const fileEntries = useMemo(() => {
    return fileList.map((fileName) => {
      const error = errorMap.get(fileName);
      const isComplete = processedSet.has(fileName) || effectiveStatus === 'complete';
      const isCurrent = fileName === currentFileName;
      const isQueued = queuedSet.has(fileName);

      const derivedStepKey = (() => {
        if (isComplete) return 'complete';
        if (error?.stage) return stageToStepKey(error.stage);
        if (isCurrent) return statusToStepKey(status, stage);
        if (isQueued) return 'queue';
        if (safeUploadedFiles.includes(fileName)) return uploadStepKey;
        if (status === 'uploading' || status === 'combining') return uploadStepKey;
        return 'upload';
      })();

      const activeStepIndex = stepIndexByKey.get(derivedStepKey) ?? 0;
      const label = (() => {
        if (error) return 'Error';
        if (isComplete) return 'Complete';
        if (isCurrent) return status === 'queued' ? 'Queued' : 'Processing';
        if (isQueued) return 'Queued';
        if (status === 'combining') return 'Combining';
        if (status === 'uploading') return 'Uploading';
        if (safeUploadedFiles.includes(fileName)) return 'Uploaded';
        return 'Waiting';
      })();

      const tone = (() => {
        if (error) return 'bg-red-50 text-red-700 border-red-200';
        if (isComplete) return 'bg-green-50 text-green-700 border-green-200';
        if (label === 'Queued') return 'bg-amber-50 text-amber-700 border-amber-200';
        if (label === 'Processing' || label === 'Uploading' || label === 'Combining') {
          return 'bg-blue-50 text-blue-700 border-blue-200';
        }
        return 'bg-slate-100 text-slate-600 border-slate-200';
      })();

      return {
        name: fileName,
        label,
        tone,
        error,
        activeStepIndex,
        isComplete,
        isCurrent,
      };
    });
  }, [
    fileList,
    errorMap,
    processedSet,
    effectiveStatus,
    currentFileName,
    queuedSet,
    safeUploadedFiles,
    uploadStepKey,
    status,
    stage,
  ]);

  return (
    <div className="w-full mt-4 rounded-xl border border-border bg-white shadow-sm">
      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {effectiveStatus === 'error' ? (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            ) : effectiveStatus === 'complete' ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">CSV processing</p>
              <p className="text-xs text-muted">
                {totalFiles > 0 ? `${processedCount}/${totalFiles} files complete` : 'Awaiting CSV uploads'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone.className}`}>
              {statusTone.label}
            </span>
            {effectiveStatus === 'error' && projectId && (
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className={`h-3 w-3 ${isResetting ? 'animate-spin' : ''}`} />
                {isResetting ? 'Resetting...' : 'Reset & Retry'}
              </button>
            )}
          </div>
        </div>

        {(message || stageDetail || stageLabel || currentFileName) && (
          <div className="flex flex-col gap-1 text-xs text-muted">
            {message && <span>{message}</span>}
            {stageLabel && <span>Active stage: {stageLabel}</span>}
            {stageDetail && <span>{stageDetail}</span>}
            {currentFileName && <span>Active file: {currentFileName}</span>}
          </div>
        )}

        {generalErrors.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {generalErrors.map((error, index) => (
              <div key={`${error.message ?? 'error'}-${index}`} className="flex flex-col">
                <span className="font-semibold">Upload error</span>
                <span>{error.message ?? 'Unknown error'}</span>
                {error.stageDetail && <span className="text-red-600">{error.stageDetail}</span>}
              </div>
            ))}
          </div>
        )}

        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${getBarColor()}`}
            style={{ width: `${normalizedProgress}%` }}
          />
        </div>
      </div>

      <div className="border-t border-border bg-surface-muted/20 px-4 py-3">
        <div className="grid gap-3">
          {fileEntries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-white px-3 py-4 text-center text-xs text-muted">
              Upload one or more CSV files to see detailed progress for each file.
            </div>
          ) : (
            fileEntries.map((file) => (
              <div
                key={file.name}
                data-testid={`processing-file-${file.name}`}
                className="rounded-lg border border-border bg-white px-3 py-3 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {file.error ? (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    ) : file.isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : file.isCurrent ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    ) : (
                      <span className="h-3 w-3 rounded-full border border-slate-300" />
                    )}
                    <span className="text-sm font-medium text-foreground">{file.name}</span>
                  </div>
                  <span
                    data-testid={`processing-file-status-${file.name}`}
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${file.tone}`}
                  >
                    {file.label}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted sm:grid-cols-4 lg:grid-cols-7">
                  {steps.map((step, index) => {
                    const isComplete = file.isComplete || index < file.activeStepIndex;
                    const isActive = !file.isComplete && index === file.activeStepIndex && !file.error;
                    const isError = Boolean(file.error) && index === file.activeStepIndex;
                    const icon = isComplete ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : isError ? (
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                    ) : isActive ? (
                      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    ) : (
                      <span className="h-3 w-3 rounded-full border border-slate-300" />
                    );

                    const textTone = isComplete
                      ? 'text-foreground'
                      : isError
                        ? 'text-red-600'
                        : isActive
                          ? 'text-blue-600'
                          : 'text-muted';

                    return (
                      <div key={`${file.name}-${step.key}`} className="flex items-center gap-1.5">
                        {icon}
                        <span className={textTone}>{step.label}</span>
                      </div>
                    );
                  })}
                </div>

                {file.isCurrent && (stageLabel || stageDetail) && (
                  <div className="mt-2 text-xs text-muted">
                    {stageLabel && <div>Current stage: {stageLabel}</div>}
                    {stageDetail && <div>{stageDetail}</div>}
                  </div>
                )}

                {file.error && (
                  <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-700">
                    <div className="font-semibold">Error: {file.error.message ?? 'Unknown error'}</div>
                    {file.error.stage && (
                      <div className="text-red-600">
                        Stage: {stageLabelMap[file.error.stage] ?? file.error.stage}
                      </div>
                    )}
                    {file.error.stageDetail && (
                      <div className="text-red-600">{file.error.stageDetail}</div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessingProgressBar;
