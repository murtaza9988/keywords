"use client";
import { useReducer, useCallback, useMemo, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store/store';
import {
  selectUngroupedKeywordsForProject,
  selectGroupedKeywordsForProject,
  selectBlockedKeywordsForProject,
  selectConfirmedKeywordsForProject,
  selectChildrenCacheForProject,
  selectProjectById
} from '@/store/projectSlice';
import { ProjectDetailTab } from '../ProjectDetailTabs';
import {
  initialProjectDetailState,
  projectDetailReducer,
  ProjectDetailAction,
  ProjectDetailState,
} from '../ProjectDetail.state';
import {
  ProcessingStatus,
  ActiveKeywordView,
  Keyword
} from '../types';

const SNACKBAR_AUTO_DISMISS_MS = 3000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
}

export class ApiCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTLMs: number;

  constructor(defaultTTLMs = 30000) {
    this.defaultTTLMs = defaultTTLMs;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    const timestamp = Date.now();
    const expires = timestamp + (ttlMs || this.defaultTTLMs);
    this.cache.set(key, { data, timestamp, expires });
  }

  invalidate(keyPattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(keyPattern)) {
        this.cache.delete(key);
      }
    }
  }

  invalidateByView(projectId: string, view: string): void {
    const pattern = projectId + '-' + view;
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export interface UseProjectDetailStateReturn {
  // Project identifiers
  projectIdStr: string;
  projectIdNum: number;
  project: ReturnType<typeof selectProjectById>;

  // Redux data
  ungroupedKeywords: Keyword[];
  groupedKeywords: Keyword[];
  blockedKeywords: Keyword[];
  confirmedKeywords: Keyword[];
  childrenCache: Record<string, Keyword[]>;

  // State
  state: ProjectDetailState;
  detailDispatch: React.Dispatch<ProjectDetailAction>;

  // Destructured state for convenience
  activeView: ActiveKeywordView;
  activeTab: ProjectDetailTab;
  logsRefreshKey: number;
  selectedTokens: string[];
  includeFilter: string;
  excludeFilter: string;
  includeMatchType: 'any' | 'all';
  excludeMatchType: 'any' | 'all';
  sortParams: { column: string; direction: 'asc' | 'desc' };
  pagination: { total: number; page: number; limit: number; pages: number };
  selectedKeywordIds: Set<number>;
  expandedGroups: Set<string>;
  loadingChildren: Set<string>;
  groupName: string;
  isTableLoading: boolean;
  isLoadingData: boolean;
  isUploading: boolean;
  processingStatus: ProcessingStatus;
  processingLocked: boolean;
  isProcessingAction: boolean;
  snackbarMessages: Array<{ id: number; text: string; type: 'success' | 'error' | 'info'; description?: string; stage?: ProcessingStatus }>;
  processingProgress: number;
  processingMessage: string;
  processingStage: string | null;
  processingStageDetail: string | null;
  processingCurrentFile: string | null;
  processingQueue: string[];
  processingQueuedJobs: number | undefined;
  processingRunningJobs: number | undefined;
  processingSucceededJobs: number | undefined;
  processingFailedJobs: number | undefined;
  processingFileErrors: Array<{ filename: string; error: string }>;
  uploadedFileCount: number;
  processedFileCount: number;
  uploadedFiles: string[];
  processedFiles: string[];
  displayProgress: number;
  minVolume: string;
  maxVolume: string;
  minLength: string;
  maxLength: string;
  minDifficulty: string;
  maxDifficulty: string;
  minRating: string;
  maxRating: string;
  isExportingParent: boolean;
  isImportingParent: boolean;
  selectedSerpFeatures: string[];
  isExporting: boolean;
  stats: ProjectDetailState['stats'];
  filterParams: {
    tokens: string[];
    include: string;
    exclude: string;
    minVolume: number | "";
    maxVolume: number | "";
    minLength: number | "";
    maxLength: number | "";
    minDifficulty: number | "";
    maxDifficulty: number | "";
    minRating: number | "";
    maxRating: number | "";
    serpFeatures: string[];
  };

  // API cache
  apiCache: ApiCache;

  // Redux dispatch
  dispatch: AppDispatch;

  // Refs
  statusCheckIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
  statusCheckIntervalMsRef: React.MutableRefObject<number | null>;
  lastStatusErrorRef: React.MutableRefObject<string | null>;
  statusErrorCountRef: React.MutableRefObject<number>;
  lastStatusErrorToastTimeRef: React.MutableRefObject<number>;
  prevActiveViewRef: React.MutableRefObject<ActiveKeywordView>;
  targetProgressRef: React.MutableRefObject<number>;
  animationFrameRef: React.MutableRefObject<number | null>;
  displayProgressRef: React.MutableRefObject<number>;

  // Callbacks
  bumpLogsRefresh: () => void;
  addSnackbarMessage: (text: string, type: 'success' | 'error' | 'info', options?: { description?: string; stage?: ProcessingStatus }) => void;
  removeSnackbarMessage: (id: number) => void;
  setActiveTab: (tab: ProjectDetailTab) => void;
  setGroupName: (value: string) => void;
  setIncludeMatchType: (value: 'any' | 'all') => void;
  setExcludeMatchType: (value: 'any' | 'all') => void;
  guardGroupingAction: () => boolean;
  getCurrentViewData: () => Keyword[];
}

export function useProjectDetailState(): UseProjectDetailStateReturn {
  const params = useParams();
  const projectIdNum = Number(params?.id);
  const projectIdStr = params?.id ? String(params.id) : '';
  const reduxDispatch: AppDispatch = useDispatch();

  // Refs
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusCheckIntervalMsRef = useRef<number | null>(null);
  const lastStatusErrorRef = useRef<string | null>(null);
  const statusErrorCountRef = useRef<number>(0);
  const lastStatusErrorToastTimeRef = useRef<number>(0);
  const apiCache = useMemo(() => new ApiCache(), []);

  // Redux selectors
  const project = useSelector((state: RootState) =>
    selectProjectById(state, projectIdNum)
  );
  const ungroupedKeywords = useSelector((state: RootState) =>
    selectUngroupedKeywordsForProject(state, projectIdStr)
  );
  const groupedKeywords = useSelector((state: RootState) =>
    selectGroupedKeywordsForProject(state, projectIdStr)
  );
  const blockedKeywords = useSelector((state: RootState) =>
    selectBlockedKeywordsForProject(state, projectIdStr)
  );
  const confirmedKeywords = useSelector((state: RootState) =>
    selectConfirmedKeywordsForProject(state, projectIdStr)
  );
  const childrenCache = useSelector((state: RootState) =>
    selectChildrenCacheForProject(state, projectIdStr)
  );

  // Component state
  const [state, detailDispatch] = useReducer(
    projectDetailReducer,
    initialProjectDetailState
  );

  const {
    view,
    filters,
    pagination: paginationState,
    selection,
    processing,
    stats,
  } = state;

  // Destructure for convenience
  const activeView = view.activeView;
  const activeTab = view.activeTab;
  const logsRefreshKey = view.logsRefreshKey;
  const selectedTokens = filters.selectedTokens;
  const includeFilter = filters.includeFilter;
  const excludeFilter = filters.excludeFilter;
  const includeMatchType = filters.includeMatchType;
  const excludeMatchType = filters.excludeMatchType;
  const sortParams = paginationState.sortParams;
  const pagination = paginationState.pagination;
  const selectedKeywordIds = selection.selectedKeywordIds;
  const expandedGroups = selection.expandedGroups;
  const loadingChildren = selection.loadingChildren;
  const groupName = selection.groupName;
  const isTableLoading = processing.isTableLoading;
  const isLoadingData = processing.isLoadingData;
  const isUploading = processing.isUploading;
  const processingStatus = processing.processingStatus;
  const processingLocked = processing.processingLocked;
  const isProcessingAction = processing.isProcessingAction;
  const snackbarMessages = processing.snackbarMessages;
  const processingProgress = processing.processingProgress;
  const processingMessage = processing.processingMessage;
  const processingStage = processing.processingStage ?? null;
  const processingStageDetail = processing.processingStageDetail ?? null;
  const processingCurrentFile = processing.processingCurrentFile;
  const processingQueue = processing.processingQueue;
  const processingQueuedJobs = processing.processingQueuedJobs;
  const processingRunningJobs = processing.processingRunningJobs;
  const processingSucceededJobs = processing.processingSucceededJobs;
  const processingFailedJobs = processing.processingFailedJobs;
  const processingFileErrors = processing.processingFileErrors;
  const uploadedFileCount = processing.uploadedFileCount;
  const processedFileCount = processing.processedFileCount;
  const uploadedFiles = processing.uploadedFiles;
  const processedFiles = processing.processedFiles;
  const displayProgress = processing.displayProgress;
  const minVolume = filters.minVolume;
  const maxVolume = filters.maxVolume;
  const minLength = filters.minLength;
  const maxLength = filters.maxLength;
  const minDifficulty = filters.minDifficulty;
  const maxDifficulty = filters.maxDifficulty;
  const minRating = filters.minRating;
  const maxRating = filters.maxRating;
  const isExportingParent = processing.isExportingParent;
  const isImportingParent = processing.isImportingParent;
  const selectedSerpFeatures = filters.selectedSerpFeatures;
  const isExporting = processing.isExporting;

  // Refs for animation and tracking
  const prevActiveViewRef = useRef(activeView);
  const targetProgressRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const displayProgressRef = useRef(displayProgress);

  // Filter params memoized
  const filterParams = useMemo(() => ({
    tokens: selectedTokens,
    include: includeFilter,
    exclude: excludeFilter,
    minVolume: minVolume ? parseInt(minVolume) : "" as const,
    maxVolume: maxVolume ? parseInt(maxVolume) : "" as const,
    minLength: minLength ? parseInt(minLength) : "" as const,
    maxLength: maxLength ? parseInt(maxLength) : "" as const,
    minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "" as const,
    maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "" as const,
    minRating: minRating ? parseInt(minRating) : "" as const,
    maxRating: maxRating ? parseInt(maxRating) : "" as const,
    serpFeatures: selectedSerpFeatures,
  }), [
    selectedTokens,
    includeFilter,
    excludeFilter,
    minVolume,
    maxVolume,
    minLength,
    maxLength,
    minDifficulty,
    maxDifficulty,
    minRating,
    maxRating,
    selectedSerpFeatures,
  ]);

  // Update displayProgressRef when displayProgress changes
  useEffect(() => {
    displayProgressRef.current = displayProgress;
  }, [displayProgress]);

  // Animate progress bar
  useEffect(() => {
    targetProgressRef.current = processingProgress;

    const animateProgress = () => {
      const target = targetProgressRef.current;
      const current = displayProgressRef.current;
      const next = Math.abs(current - target) < 0.1
        ? target
        : current + (target - current) * 0.1;
      detailDispatch({
        type: 'updateProcessing',
        payload: { displayProgress: next },
      });
      if (Math.abs(next - targetProgressRef.current) > 0.1) {
        animationFrameRef.current = requestAnimationFrame(animateProgress);
      }
    };

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(animateProgress);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [processingProgress]);

  // Callbacks
  const bumpLogsRefresh = useCallback(() => {
    detailDispatch({ type: 'bumpLogsRefresh' });
  }, []);

  const addSnackbarMessage = useCallback((
    text: string,
    type: 'success' | 'error' | 'info',
    options?: { description?: string; stage?: ProcessingStatus }
  ) => {
    const id = Date.now();
    detailDispatch({
      type: 'addSnackbarMessage',
      payload: {
        id,
        text,
        type,
        description: options?.description,
        stage: options?.stage,
      },
    });
    setTimeout(() => {
      detailDispatch({ type: 'removeSnackbarMessage', payload: id });
    }, SNACKBAR_AUTO_DISMISS_MS);
  }, []);

  const guardGroupingAction = useCallback(() => {
    if (!processingLocked) {
      return true;
    }
    addSnackbarMessage(
      'CSV processing in progress. Grouping is temporarily locked until import completes.',
      'error'
    );
    return false;
  }, [addSnackbarMessage, processingLocked]);

  const removeSnackbarMessage = useCallback((id: number) => {
    detailDispatch({ type: 'removeSnackbarMessage', payload: id });
  }, []);

  const setActiveTab = useCallback((tab: ProjectDetailTab) => {
    detailDispatch({
      type: 'updateView',
      payload: { activeTab: tab },
    });
  }, []);

  const setGroupName = useCallback((value: string) => {
    detailDispatch({
      type: 'updateSelection',
      payload: { groupName: value },
    });
  }, []);

  const setIncludeMatchType = useCallback((value: 'any' | 'all') => {
    detailDispatch({
      type: 'updateFilters',
      payload: { includeMatchType: value },
    });
  }, []);

  const setExcludeMatchType = useCallback((value: 'any' | 'all') => {
    detailDispatch({
      type: 'updateFilters',
      payload: { excludeMatchType: value },
    });
  }, []);

  const getCurrentViewData = useCallback(() => {
    let data: Keyword[] = [];

    switch (activeView) {
      case 'ungrouped':
        data = ungroupedKeywords || [];
        break;
      case 'grouped':
        data = groupedKeywords || [];
        break;
      case 'confirmed':
        data = confirmedKeywords || [];
        break;
      case 'blocked':
        data = blockedKeywords || [];
        break;
      default:
        data = [];
    }

    if ((activeView === 'grouped' || activeView === 'confirmed') && (includeFilter || excludeFilter)) {
      const groupsMap = new Map<string, Keyword>();

      data.forEach((keyword) => {
        if (keyword.isParent && keyword.groupId) {
          groupsMap.set(keyword.groupId, keyword);
        }
      });

      data.forEach((keyword) => {
        if (keyword.groupId && !groupsMap.has(keyword.groupId)) {
          groupsMap.set(keyword.groupId, {...keyword, isParent: true});
        }
      });

      return Array.from(groupsMap.values());
    }

    return data;
  }, [activeView, ungroupedKeywords, groupedKeywords, confirmedKeywords, blockedKeywords, includeFilter, excludeFilter]);

  return {
    // Project identifiers
    projectIdStr,
    projectIdNum,
    project,

    // Redux data
    ungroupedKeywords,
    groupedKeywords,
    blockedKeywords,
    confirmedKeywords,
    childrenCache,

    // State
    state,
    detailDispatch,

    // Destructured state
    activeView,
    activeTab,
    logsRefreshKey,
    selectedTokens,
    includeFilter,
    excludeFilter,
    includeMatchType,
    excludeMatchType,
    sortParams,
    pagination,
    selectedKeywordIds,
    expandedGroups,
    loadingChildren,
    groupName,
    isTableLoading,
    isLoadingData,
    isUploading,
    processingStatus,
    processingLocked,
    isProcessingAction,
    snackbarMessages,
    processingProgress,
    processingMessage,
    processingStage,
    processingStageDetail,
    processingCurrentFile,
    processingQueue,
    processingQueuedJobs,
    processingRunningJobs,
    processingSucceededJobs,
    processingFailedJobs,
    processingFileErrors,
    uploadedFileCount,
    processedFileCount,
    uploadedFiles,
    processedFiles,
    displayProgress,
    minVolume,
    maxVolume,
    minLength,
    maxLength,
    minDifficulty,
    maxDifficulty,
    minRating,
    maxRating,
    isExportingParent,
    isImportingParent,
    selectedSerpFeatures,
    isExporting,
    stats,
    filterParams,

    // API cache
    apiCache,

    // Redux dispatch
    dispatch: reduxDispatch,

    // Refs
    statusCheckIntervalRef,
    statusCheckIntervalMsRef,
    lastStatusErrorRef,
    statusErrorCountRef,
    lastStatusErrorToastTimeRef,
    prevActiveViewRef,
    targetProgressRef,
    animationFrameRef,
    displayProgressRef,

    // Callbacks
    bumpLogsRefresh,
    addSnackbarMessage,
    removeSnackbarMessage,
    setActiveTab,
    setGroupName,
    setIncludeMatchType,
    setExcludeMatchType,
    guardGroupingAction,
    getCurrentViewData,
  };
}
