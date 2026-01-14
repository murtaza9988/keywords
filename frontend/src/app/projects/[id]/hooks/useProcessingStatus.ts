"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import apiClient from '@/lib/apiClient';
import { setKeywordsForView } from '@/store/projectSlice';
import type {
  ActiveKeywordView,
  Keyword,
  ProcessingStatus,
  SortParams,
} from '../components/types';
import type { KeywordFilters } from './useProjectKeywords';

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

export function useProcessingStatus({
  projectIdStr,
  projectIdNum,
  activeView,
  paginationLimit,
  sortParams,
  filters,
  includeMatchType,
  excludeMatchType,
  fetchKeywords,
  fetchProjectStats,
  addSnackbarMessage,
  bumpLogsRefresh,
}: {
  projectIdStr: string;
  projectIdNum: number;
  activeView: ActiveKeywordView;
  paginationLimit: number;
  sortParams: SortParams;
  filters: KeywordFilters;
  includeMatchType: 'any' | 'all';
  excludeMatchType: 'any' | 'all';
  fetchKeywords: (options: {
    page?: number;
    limit?: number;
    view?: ActiveKeywordView;
    sort: SortParams;
    filters: KeywordFilters;
    includeMatchType: 'any' | 'all';
    excludeMatchType: 'any' | 'all';
    forceRefresh?: boolean;
  }) => Promise<void>;
  fetchProjectStats: () => Promise<void>;
  addSnackbarMessage: (
    text: string,
    type: 'success' | 'error' | 'info',
    options?: { description?: string; stage?: ProcessingStatus }
  ) => void;
  bumpLogsRefresh: () => void;
}) {
  const dispatch = useDispatch();
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const targetProgressRef = useRef<number>(0);

  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingCurrentFile, setProcessingCurrentFile] = useState<string | null>(null);
  const [processingQueue, setProcessingQueue] = useState<string[]>([]);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const stopProcessingCheck = useCallback(() => {
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
      statusCheckIntervalRef.current = null;
    }
  }, []);

  const checkProcessingStatus = useCallback(async () => {
    if (!projectIdStr) return;

    try {
      const data = await apiClient.checkProcessingStatus(projectIdStr);

      if (data.progress !== undefined) {
        const normalizedProgress = Math.max(0, Math.min(100, data.progress));
        setProcessingProgress(normalizedProgress);
      }
      setProcessingMessage(data.message ?? '');
      setProcessingCurrentFile(data.currentFileName ?? null);
      setProcessingQueue(data.queuedFiles ?? []);

      if (data.status === 'complete') {
        setProcessingStatus('complete');
        setIsUploading(false);
        stopProcessingCheck();
        addSnackbarMessage('Processing complete', 'success', {
          stage: 'complete',
          description: 'Your keywords are ready to review.',
        });
        await fetchKeywords({
          page: 1,
          limit: paginationLimit,
          view: activeView,
          sort: sortParams,
          filters,
          includeMatchType,
          excludeMatchType,
          forceRefresh: true,
        });

        await fetchProjectStats();
        bumpLogsRefresh();
        return;
      }
      if (data.status !== processingStatus) {
        setProcessingStatus(data.status);

        if (data.status === 'error') {
          setIsUploading(false);
          setProcessingProgress(0);
          addSnackbarMessage(data.message || 'File processing failed', 'error');
          stopProcessingCheck();
        } else if (data.status === 'idle') {
          setIsUploading(false);
          stopProcessingCheck();
        } else if (data.status === 'uploading' || data.status === 'combining') {
          setIsUploading(true);
        } else if (data.status === 'queued' || data.status === 'processing') {
          setIsUploading(false);
        }
      }

      if ((data.status === 'queued' || data.status === 'processing') && data.keywords && data.keywords.length > 0) {
        const keywords = data.keywords.map((kw) => {
          let parsedTokens = [];
          const serpFeatures = Array.isArray(kw.serpFeatures)
            ? kw.serpFeatures
            : Array.isArray(kw.serp_features)
              ? kw.serp_features
              : [];
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
            groupName: kw.group_name || null,
            status: normalizeKeywordStatus(kw.status, 'ungrouped'),
            childCount: kw.child_count || 0,
            original_volume: kw.original_volume || kw.volume || 0,
            serpFeatures,
            length: (kw.keyword || '').length,
          };
        });

        dispatch(
          setKeywordsForView({
            projectId: projectIdStr,
            view: 'ungrouped',
            keywords: keywords.map((kw) => ({
              ...kw,
              original_volume: kw.volume || 0,
              project_id: projectIdNum,
              status: 'ungrouped',
              groupName: kw.keyword || '',
              serpFeatures: kw.serpFeatures ?? [],
              length: (kw.keyword || '').length,
            })),
          })
        );
      }
    } catch (error) {
      console.error('Error checking processing status:', error);
      const message = 'Error checking status: ' + (isError(error) ? error.message : 'Unknown error');
      addSnackbarMessage(message, 'error');
      setIsUploading(false);
      stopProcessingCheck();
      setProcessingStatus('error');
      setProcessingProgress(0);
      setProcessingMessage(message);
    }
  }, [
    projectIdStr,
    projectIdNum,
    processingStatus,
    stopProcessingCheck,
    fetchKeywords,
    paginationLimit,
    activeView,
    sortParams,
    filters,
    includeMatchType,
    excludeMatchType,
    addSnackbarMessage,
    dispatch,
    fetchProjectStats,
    bumpLogsRefresh,
  ]);

  useEffect(() => {
    targetProgressRef.current = processingProgress;

    const animateProgress = () => {
      setDisplayProgress((prev) => {
        const target = targetProgressRef.current;
        if (Math.abs(prev - target) < 0.1) return target;
        return prev + (target - prev) * 0.1;
      });
      if (Math.abs(displayProgress - targetProgressRef.current) > 0.1) {
        animationFrameRef.current = requestAnimationFrame(animateProgress);
      }
    };

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(animateProgress);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [processingProgress, displayProgress]);

  useEffect(() => {
    if (
      processingStatus === 'uploading' ||
      processingStatus === 'combining' ||
      processingStatus === 'queued' ||
      processingStatus === 'processing'
    ) {
      if (!statusCheckIntervalRef.current) {
        checkProcessingStatus();
        statusCheckIntervalRef.current = setInterval(checkProcessingStatus, 1000);
      }
    } else {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
        statusCheckIntervalRef.current = null;
      }
    }

    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
        statusCheckIntervalRef.current = null;
      }
    };
  }, [processingStatus, checkProcessingStatus]);

  const startProcessingCheck = useCallback(() => {
    stopProcessingCheck();
    checkProcessingStatus();
    statusCheckIntervalRef.current = setInterval(checkProcessingStatus, 1000);
  }, [checkProcessingStatus, stopProcessingCheck]);

  const initializeProcessingStatus = useCallback(
    (processingStatusData?: {
      status?: ProcessingStatus;
      progress?: number;
      message?: string;
      currentFileName?: string | null;
      queuedFiles?: string[];
    }) => {
      if (!processingStatusData?.status) return;
      setProcessingStatus(processingStatusData.status ?? 'idle');
      setProcessingProgress(processingStatusData.progress || 0);
      setProcessingMessage(processingStatusData.message || '');
      setProcessingCurrentFile(processingStatusData.currentFileName ?? null);
      setProcessingQueue(processingStatusData.queuedFiles ?? []);
      if (
        processingStatusData.status === 'uploading' ||
        processingStatusData.status === 'combining' ||
        processingStatusData.status === 'queued' ||
        processingStatusData.status === 'processing'
      ) {
        startProcessingCheck();
      }
    },
    [startProcessingCheck]
  );

  const handleUploadStart = useCallback(() => {
    setIsUploading(true);
    setProcessingStatus('uploading');
    setProcessingProgress(0);
    setProcessingMessage('Uploading CSV...');
    startProcessingCheck();
    bumpLogsRefresh();
  }, [startProcessingCheck, bumpLogsRefresh]);

  const handleUploadSuccess = useCallback(
    (status: ProcessingStatus, message?: string) => {
      setProcessingStatus(status);
      setProcessingMessage(message || '');
      if (status === 'complete') {
        setIsUploading(false);
        setProcessingProgress(100);
        stopProcessingCheck();
        addSnackbarMessage(message || 'File uploaded and processed successfully', 'success');
        fetchProjectStats();
        fetchKeywords({
          page: 1,
          limit: paginationLimit,
          view: activeView,
          sort: sortParams,
          filters,
          includeMatchType,
          excludeMatchType,
          forceRefresh: true,
        });
        bumpLogsRefresh();

        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else if (status === 'queued' || status === 'processing') {
        startProcessingCheck();
        addSnackbarMessage('Upload complete', 'success', {
          stage: 'queued',
          description:
            message ||
            (status === 'processing'
              ? 'Processing has started.'
              : 'Processing is queued and will begin shortly.'),
        });
      } else {
        setIsUploading(false);
        if (message) addSnackbarMessage(message, 'success');
      }
    },
    [
      addSnackbarMessage,
      startProcessingCheck,
      stopProcessingCheck,
      bumpLogsRefresh,
      fetchKeywords,
      paginationLimit,
      activeView,
      sortParams,
      filters,
      includeMatchType,
      excludeMatchType,
      fetchProjectStats,
    ]
  );

  const handleUploadError = useCallback(
    (message: string) => {
      setIsUploading(false);
      setProcessingStatus('error');
      setProcessingProgress(0);
      setDisplayProgress(0);
      setProcessingMessage(message);
      addSnackbarMessage(message, 'error');
      stopProcessingCheck();
    },
    [addSnackbarMessage, stopProcessingCheck]
  );

  return {
    processingStatus,
    processingProgress,
    processingMessage,
    processingCurrentFile,
    processingQueue,
    displayProgress,
    isUploading,
    startProcessingCheck,
    stopProcessingCheck,
    checkProcessingStatus,
    initializeProcessingStatus,
    handleUploadStart,
    handleUploadSuccess,
    handleUploadError,
  };
}
