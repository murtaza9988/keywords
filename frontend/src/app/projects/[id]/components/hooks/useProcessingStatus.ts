"use client";
import { useCallback, useEffect, useState } from 'react';
import { AppDispatch } from '@/store/store';
import { setKeywordsForView } from '@/store/projectSlice';
import { checkProcessingStatus as checkProcessingStatusApi } from '@/lib/api/keywords';
import { ProjectDetailAction } from '../ProjectDetail.state';
import {
  ProcessingStatus,
  ActiveKeywordView,
  Keyword,
  SortParams
} from '../types';
import { ProcessingKeyword } from '@/lib/types';
import { FilterParams } from './useKeywordFetching';

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

function normalizeKeywordStatus(
  status: string | null | undefined,
  fallback: ActiveKeywordView
): Keyword['status'] {
  if (status === 'ungrouped' || status === 'grouped' || status === 'confirmed' || status === 'blocked') {
    return status;
  }
  return fallback;
}

interface UseProcessingStatusProps {
  projectIdStr: string;
  projectIdNum: number;
  dispatch: AppDispatch;
  detailDispatch: React.Dispatch<ProjectDetailAction>;
  addSnackbarMessage: (text: string, type: 'success' | 'error' | 'info', options?: { description?: string; stage?: ProcessingStatus }) => void;
  bumpLogsRefresh: () => void;
  fetchKeywords: (
    page?: number,
    limit?: number,
    view?: ActiveKeywordView,
    sort?: SortParams,
    filters?: FilterParams,
    forceRefresh?: boolean
  ) => Promise<void>;
  fetchProjectStats: () => Promise<void>;
  statusCheckIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
  statusCheckIntervalMsRef: React.MutableRefObject<number | null>;
  lastStatusErrorRef: React.MutableRefObject<string | null>;
  statusErrorCountRef: React.MutableRefObject<number>;
  lastStatusErrorToastTimeRef: React.MutableRefObject<number>;
  processingStatus: ProcessingStatus;
  processingLocked: boolean;
  processingQueue: string[];
  processingCurrentFile: string | null;
  processingQueuedJobs: number | undefined;
  processingRunningJobs: number | undefined;
}

export interface UseProcessingStatusReturn {
  csvUploadsRefreshKey: number;
  checkProcessingStatus: () => Promise<void>;
  startProcessingCheck: () => void;
  stopProcessingCheck: () => void;
  handleUploadStart: () => void;
  handleUploadBatchStart: (files: File[]) => void;
  handleUploadSuccess: (
    status: ProcessingStatus,
    message?: string,
    paginationLimit?: number,
    activeView?: ActiveKeywordView,
    sortParams?: SortParams,
    filterParams?: FilterParams
  ) => void;
  handleUploadError: (message: string) => void;
}

export function useProcessingStatus({
  projectIdStr,
  projectIdNum,
  dispatch,
  detailDispatch,
  addSnackbarMessage,
  bumpLogsRefresh,
  fetchKeywords,
  fetchProjectStats,
  statusCheckIntervalRef,
  statusCheckIntervalMsRef,
  lastStatusErrorRef,
  statusErrorCountRef,
  lastStatusErrorToastTimeRef,
  processingStatus,
  processingLocked,
  processingQueue,
  processingCurrentFile,
  processingQueuedJobs,
  processingRunningJobs,
}: UseProcessingStatusProps): UseProcessingStatusReturn {
  const [csvUploadsRefreshKey, setCsvUploadsRefreshKey] = useState(0);

  const stopProcessingCheck = useCallback(() => {
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
      statusCheckIntervalRef.current = null;
    }
    statusCheckIntervalMsRef.current = null;
  }, [statusCheckIntervalRef, statusCheckIntervalMsRef]);

  const checkProcessingStatus = useCallback(async () => {
    if (!projectIdStr) return;

    try {
      const data = await checkProcessingStatusApi(projectIdStr);

      // Reset error tracking on successful API call
      statusErrorCountRef.current = 0;
      lastStatusErrorRef.current = null;
      lastStatusErrorToastTimeRef.current = 0;

      if (data.progress !== undefined) {
        const normalizedProgress = Math.max(0, Math.min(100, data.progress));
        detailDispatch({
          type: 'updateProcessing',
          payload: { processingProgress: normalizedProgress },
        });
      }
      detailDispatch({
        type: 'updateProcessing',
        payload: {
          processingMessage: data.message ?? '',
          processingStage: data.stage ?? null,
          processingStageDetail: data.stageDetail ?? null,
          processingCurrentFile: data.currentFileName ?? null,
          processingQueue: data.queuedFiles ?? [],
          processingQueuedJobs: data.queuedJobs ?? 0,
          processingRunningJobs: data.runningJobs ?? 0,
          processingSucceededJobs: data.succeededJobs ?? 0,
          processingFailedJobs: data.failedJobs ?? 0,
          processingFileErrors: data.fileErrors ?? [],
          uploadedFileCount: data.uploadedFileCount ?? 0,
          processedFileCount: data.processedFileCount ?? 0,
          uploadedFiles: data.uploadedFiles ?? [],
          processedFiles: data.processedFiles ?? [],
          processingLocked: Boolean(data.locked),
        },
      });

      if (data.status === 'complete') {
        detailDispatch({
          type: 'updateProcessing',
          payload: {
            processingStatus: 'complete',
            isUploading: false,
            uploadSuccess: true,
          },
        });
        addSnackbarMessage('Processing complete', 'success', {
          stage: 'complete',
          description: 'Your keywords are ready to review.'
        });
        fetchKeywords(1, 250, 'ungrouped', { column: 'volume', direction: 'desc' }, {
          tokens: [],
          include: '',
          exclude: '',
          minVolume: '',
          maxVolume: '',
          minLength: '',
          maxLength: '',
          minDifficulty: '',
          maxDifficulty: '',
          minRating: '',
          maxRating: '',
          serpFeatures: [],
        }, true);

        fetchProjectStats();
        bumpLogsRefresh();
        return;
      }
      if (data.status !== processingStatus) {
        detailDispatch({
          type: 'updateProcessing',
          payload: { processingStatus: data.status },
        });

        if (data.status === 'error') {
          detailDispatch({
            type: 'updateProcessing',
            payload: { isUploading: false, processingProgress: 0 },
          });
          addSnackbarMessage(data.message || 'File processing failed', 'error');
        } else if (data.status === 'idle') {
          detailDispatch({
            type: 'updateProcessing',
            payload: { isUploading: false },
          });
        } else if (data.status === 'uploading' || data.status === 'combining') {
          detailDispatch({
            type: 'updateProcessing',
            payload: { isUploading: true },
          });
        } else if (data.status === 'queued' || data.status === 'processing') {
          detailDispatch({
            type: 'updateProcessing',
            payload: { isUploading: false },
          });
        }
      }

      if ((data.status === 'queued' || data.status === 'processing') &&
          data.keywords && data.keywords.length > 0) {
        const keywords = data.keywords.map((kw: ProcessingKeyword) => {
          let parsedTokens: string[] = [];
          const serpFeatures = Array.isArray(kw.serpFeatures) ? kw.serpFeatures : [];
          try {
            if (typeof kw.tokens === 'string') {
              parsedTokens = JSON.parse(kw.tokens);
            } else if (Array.isArray(kw.tokens)) {
              parsedTokens = kw.tokens;
            }
          } catch (err) {
            console.warn('Failed to parse tokens for keyword: ' + kw.keyword, err);
            if (typeof kw.tokens === 'string') {
              parsedTokens = kw.tokens.split(',').map((t: string) => t.trim()).filter(Boolean);
            }
          }

          return {
            id: kw.id || Date.now() + Math.random(),
            project_id: projectIdNum,
            keyword: kw.keyword || '',
            tokens: parsedTokens,
            volume: kw.volume || 0,
            difficulty: kw.difficulty || 0,
            isParent: kw.is_parent || false,
            groupId: kw.group_id || null,
            groupName: null,
            status: normalizeKeywordStatus(kw.status, 'ungrouped'),
            childCount: kw.child_count || 0,
            original_volume: kw.original_volume || kw.volume || 0,
            serpFeatures,
            length: (kw.keyword || '').length
          };
        });

        dispatch(setKeywordsForView({
          projectId: projectIdStr,
          view: 'ungrouped',
          keywords: keywords.map((kw: Keyword) => ({
            ...kw,
            original_volume: kw.volume || 0,
            project_id: projectIdNum,
            status: 'ungrouped' as const,
            groupName: kw.keyword || '',
            serpFeatures: kw.serpFeatures ?? [],
            length: (kw.keyword || '').length
          })),
        }));
      }
    } catch (error) {
      console.error('Error checking processing status:', error);
      const message = 'Error checking status: ' + (isError(error) ? error.message : 'Unknown error');

      // Increment error count
      statusErrorCountRef.current += 1;
      const errorCount = statusErrorCountRef.current;
      const now = Date.now();
      const timeSinceLastToast = now - lastStatusErrorToastTimeRef.current;
      const isNewError = lastStatusErrorRef.current !== message;

      // Only show toast if:
      // 1. Error count <= 3 (first few errors)
      // 2. OR it's a new/different error
      // 3. OR it's been > 30 seconds since last toast
      // AND error count < 10 (circuit breaker - stop showing after 10 consecutive errors)
      const shouldShowToast = errorCount < 10 && (
        errorCount <= 3 ||
        isNewError ||
        timeSinceLastToast > 30000
      );

      if (shouldShowToast) {
        addSnackbarMessage(
          errorCount > 3
            ? `${message} (error ${errorCount})`
            : message,
          'error'
        );
        lastStatusErrorToastTimeRef.current = now;
      }

      lastStatusErrorRef.current = message;

      detailDispatch({
        type: 'updateProcessing',
        payload: { isUploading: false },
      });
      detailDispatch({
        type: 'updateProcessing',
        payload: {
          processingStatus: 'error',
          processingProgress: 0,
          processingMessage: message,
        },
      });

      // Circuit breaker: If too many consecutive errors, stop polling
      if (errorCount >= 5) {
        console.warn(`[Circuit Breaker] Stopping status polling after ${errorCount} consecutive errors`);
        stopProcessingCheck();
      }
    }
  }, [
    projectIdStr, processingStatus,
    fetchKeywords,
    addSnackbarMessage,
    dispatch, projectIdNum, fetchProjectStats, bumpLogsRefresh,
    stopProcessingCheck, statusErrorCountRef, lastStatusErrorRef,
    lastStatusErrorToastTimeRef, detailDispatch
  ]);

  const startProcessingCheck = useCallback(() => {
    // Reset error tracking when starting a new polling cycle
    statusErrorCountRef.current = 0;
    lastStatusErrorRef.current = null;
    lastStatusErrorToastTimeRef.current = 0;

    stopProcessingCheck();
    checkProcessingStatus();
    statusCheckIntervalRef.current = setInterval(checkProcessingStatus, 1000);
    statusCheckIntervalMsRef.current = 1000;
  }, [checkProcessingStatus, stopProcessingCheck, statusCheckIntervalRef, statusCheckIntervalMsRef, statusErrorCountRef, lastStatusErrorRef, lastStatusErrorToastTimeRef]);

  // Auto-adjust polling interval based on status
  useEffect(() => {
    const hasActiveStatus = (
      processingStatus === 'uploading' ||
      processingStatus === 'combining' ||
      processingStatus === 'queued' ||
      processingStatus === 'processing'
    );
    const hasQueuedFiles = processingQueue.length > 0;
    const hasCurrentFile = Boolean(processingCurrentFile);
    const hasJobSignals = (processingQueuedJobs ?? 0) > 0 || (processingRunningJobs ?? 0) > 0;
    const shouldPollFast = hasActiveStatus || hasQueuedFiles || hasCurrentFile || hasJobSignals;
    const shouldPollSlow = !shouldPollFast && processingLocked;
    const nextIntervalMs = shouldPollFast ? 1000 : shouldPollSlow ? 5000 : null;

    if (nextIntervalMs === null) {
      stopProcessingCheck();
      return;
    }

    if (
      !statusCheckIntervalRef.current ||
      statusCheckIntervalMsRef.current !== nextIntervalMs
    ) {
      stopProcessingCheck();
      checkProcessingStatus();
      statusCheckIntervalRef.current = setInterval(checkProcessingStatus, nextIntervalMs);
      statusCheckIntervalMsRef.current = nextIntervalMs;
    }
  }, [
    processingStatus,
    processingLocked,
    processingQueue.length,
    processingCurrentFile,
    processingQueuedJobs,
    processingRunningJobs,
    checkProcessingStatus,
    stopProcessingCheck,
    statusCheckIntervalRef,
    statusCheckIntervalMsRef,
  ]);

  // Cleanup on unmount
  useEffect(() => () => {
    stopProcessingCheck();
  }, [stopProcessingCheck]);

  const handleUploadStart = useCallback(() => {
    detailDispatch({
      type: 'updateProcessing',
      payload: {
        isUploading: true,
        processingStatus: 'uploading',
        processingProgress: 0,
        processingMessage: 'Uploading CSV...',
        processingFileErrors: [],
      },
    });
    setCsvUploadsRefreshKey((prev: number) => prev + 1);
    startProcessingCheck();
    bumpLogsRefresh();
  }, [startProcessingCheck, bumpLogsRefresh, detailDispatch]);

  const handleUploadBatchStart = useCallback((files: File[]) => {
    detailDispatch({
      type: 'updateProcessing',
      payload: { processingQueue: files.map((file) => file.name) },
    });
    setCsvUploadsRefreshKey((prev: number) => prev + 1);
  }, [detailDispatch]);

  const handleUploadSuccess = useCallback(
    (
      status: ProcessingStatus,
      message?: string,
      paginationLimit = 250,
      activeView: ActiveKeywordView = 'ungrouped',
      sortParams: SortParams = { column: 'volume', direction: 'desc' },
      filterParams: FilterParams = {
        tokens: [],
        include: '',
        exclude: '',
        minVolume: '',
        maxVolume: '',
        minLength: '',
        maxLength: '',
        minDifficulty: '',
        maxDifficulty: '',
        minRating: '',
        maxRating: '',
        serpFeatures: [],
      }
    ) => {
      detailDispatch({
        type: 'updateProcessing',
        payload: {
          processingStatus: status,
          processingMessage: message || '',
          processingFileErrors: [],
        },
      });
      setCsvUploadsRefreshKey((prev: number) => prev + 1);
      if (status === 'complete') {
        detailDispatch({
          type: 'updateProcessing',
          payload: {
            isUploading: false,
            uploadSuccess: true,
            processingProgress: 100,
          },
        });
        stopProcessingCheck();
        addSnackbarMessage(message || 'File uploaded and processed successfully', 'success');
        fetchProjectStats();
        fetchKeywords(1, paginationLimit, activeView, sortParams, filterParams, true);
        bumpLogsRefresh();
      } else if (status === 'queued' || status === 'processing') {
        startProcessingCheck();
        addSnackbarMessage('Upload complete', 'success', {
          stage: 'queued',
          description: message || (status === 'processing'
            ? 'Processing has started.'
            : 'Processing is queued and will begin shortly.')
        });
      } else {
        detailDispatch({
          type: 'updateProcessing',
          payload: { isUploading: false },
        });
        if (message) addSnackbarMessage(message, 'success');
      }
    },
    [
      addSnackbarMessage, startProcessingCheck, stopProcessingCheck, bumpLogsRefresh,
      fetchKeywords, fetchProjectStats, detailDispatch
    ]
  );

  const handleUploadError = useCallback(
    (message: string) => {
      detailDispatch({
        type: 'updateProcessing',
        payload: {
          isUploading: false,
          processingStatus: 'error',
          processingProgress: 0,
          displayProgress: 0,
          processingMessage: message,
          processingFileErrors: [],
        },
      });
      setCsvUploadsRefreshKey((prev: number) => prev + 1);
      addSnackbarMessage(message, 'error');
      stopProcessingCheck();
    },
    [addSnackbarMessage, stopProcessingCheck, detailDispatch]
  );

  return {
    csvUploadsRefreshKey,
    checkProcessingStatus,
    startProcessingCheck,
    stopProcessingCheck,
    handleUploadStart,
    handleUploadBatchStart,
    handleUploadSuccess,
    handleUploadError,
  };
}
