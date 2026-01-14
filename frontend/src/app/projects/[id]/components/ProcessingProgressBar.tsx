// ProcessingProgressBar.tsx
import React, { useState } from 'react';
import { ProcessingStatus } from './types';
import { CheckCircle2, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import apiClient from '@/lib/apiClient';

interface ProcessingProgressBarProps {
  status: ProcessingStatus;
  progress: number;
  currentFileName?: string | null;
  queuedFiles?: string[];
  message?: string;
  projectId?: string;
  onReset?: () => void;
}

const ProcessingProgressBar: React.FC<ProcessingProgressBarProps> = ({ 
  status, 
  progress,
  currentFileName,
  queuedFiles,
  message,
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
    { key: 'uploading', label: 'Upload CSV' },
    { key: 'combining', label: 'Combine chunks' },
    { key: 'queued', label: 'Queue processing' },
    { key: 'processing', label: 'Process keywords' },
    { key: 'complete', label: 'Complete' }
  ];

  const stepOrder: Record<ProcessingStatus, number> = {
    idle: 0,
    uploading: 1,
    combining: 2,
    queued: 3,
    processing: 4,
    complete: 5,
    error: 4
  };

  const activeStep = stepOrder[status] ?? 0;
  const queuedCount = queuedFiles?.length ?? 0;

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
              <span>
                {status === 'queued'
                  ? 'Queued for processing...'
                  : status === 'complete'
                    ? 'Processing complete.'
                    : `Processing CSV: ${Math.round(safeProgress)}%`
                }
              </span>
            </>
          )}
        </div>
        {message && (
          <span className="text-xs text-muted">{message}</span>
        )}
        {currentFileName && (
          <span className="text-xs text-muted">Current file: {currentFileName}</span>
        )}
        {queuedCount > 0 && (
          <span className="text-xs text-muted">Queued files: {queuedCount}</span>
        )}
      </div>

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
