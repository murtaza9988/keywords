/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store/store';
import { setKeywordsForView, setChildrenForGroup, setProjectStats } from '@/store/projectSlice';
import {
  blockToken,
  checkProcessingStatus as checkProcessingStatusApi,
  confirmKeywords,
  exportGroupedKeywords,
  exportParentKeywords,
  fetchInitialData as fetchInitialDataApi,
  fetchKeywordChildren,
  fetchKeywords as fetchKeywordsApi,
  groupKeywords,
  importParentKeywords,
  regroupKeywords,
  unconfirmKeywords,
  unblockKeywords,
  ungroupKeywords,
} from '@/lib/api/keywords';
import { fetchProjectStats as fetchProjectStatsApi } from '@/lib/api/projects';
import { Header } from './Header';
import { FiltersSection } from './FiltersSection';
import { MainContent } from './MainContent';
import { Snackbar } from './Snackbar';
import { TokenManagement } from './token/TokenManagement';
import { TextAreaInputs } from './TextAreaInputs';
import { ProjectDetailTabs, ProjectDetailTab } from './ProjectDetailTabs';
import { ProjectDetailOverview } from './ProjectDetailOverview';
import { ProjectDetailProcess } from './ProjectDetailProcess';
import { ProjectDetailLogs } from './ProjectDetailLogs';
import { ProjectDetailToolbar } from './ProjectDetailToolbar';
import {
  initialProjectDetailState,
  projectDetailReducer,
} from './ProjectDetail.state';
import {
  ProcessingFileError,
  ProcessingStatus,
  ActiveKeywordView,
  SortParams,
  Keyword
} from './types';
import { 
  selectUngroupedKeywordsForProject, 
  selectGroupedKeywordsForProject, 
  selectBlockedKeywordsForProject,
  selectConfirmedKeywordsForProject,
  selectChildrenCacheForProject,
  selectProjectById
} from '@/store/projectSlice';
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
}

type SerpFeatureValue = string[] | string | null | undefined;
type SerpFeatureCarrier = { serpFeatures?: SerpFeatureValue };

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

function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
  options: { immediate?: boolean } = {}
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime: number | null = null;
  
  return function(this: unknown, ...args: Parameters<T>): void {
    const time = Date.now();
    lastArgs = args;
    lastCallTime = time;
    
    if (options.immediate && !timeout) {
      func.apply(this, args);
    }

    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => {
      if (lastCallTime === time && (!options.immediate || (options.immediate && timeout))) {
        func.apply(this, lastArgs as Parameters<T>);
      }
      timeout = null;
      lastArgs = null;
    }, wait);
  };
}

const SNACKBAR_AUTO_DISMISS_MS = 3000;
class ApiCache {
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


export default function ProjectDetail(): React.ReactElement {
  const params = useParams();
  const projectIdNum = Number(params?.id);
  const projectIdStr = params?.id ? String(params.id) : '';
  const dispatch: AppDispatch = useDispatch();
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusCheckIntervalMsRef = useRef<number | null>(null);
  const apiCache = useMemo(() => new ApiCache(), []);
  
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
  const prevActiveViewRef = useRef(activeView);
  const targetProgressRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const displayProgressRef = useRef(displayProgress);
  const filterParams = useMemo(() => ({
    tokens: selectedTokens,
    include: includeFilter,
    exclude: excludeFilter,
    minVolume: minVolume ? parseInt(minVolume) : "",
    maxVolume: maxVolume ? parseInt(maxVolume) : "",
    minLength: minLength ? parseInt(minLength) : "",
    maxLength: maxLength ? parseInt(maxLength) : "",
    minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
    maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
    minRating: minRating ? parseInt(minRating) : "",
    maxRating: maxRating ? parseInt(maxRating) : "",
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

  useEffect(() => {
    displayProgressRef.current = displayProgress;
  }, [displayProgress]);

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
  const fetchProjectStats = useCallback(async () => {
    if (!projectIdStr) return;
    try {
      const statsData = await fetchProjectStatsApi(projectIdStr);
      detailDispatch({
        type: 'setStats',
        payload: {
          ungroupedCount: statsData.ungroupedCount || 0,
          groupedKeywordsCount: statsData.groupedKeywordsCount || 0,
          groupedPages: statsData.groupedPages || 0,
          confirmedKeywordsCount: statsData.confirmedKeywordsCount || 0,
          confirmedPages: statsData.confirmedPages || 0,
          blockedCount: statsData.blockedCount || 0,
          totalParentKeywords: statsData.totalParentKeywords || 0,
          totalChildKeywords: statsData.totalChildKeywords || 0,
          groupCount: statsData.groupCount || 0,
          parentTokenCount: statsData.parentTokenCount || 0,
          childTokenCount: statsData.childTokenCount || 0,
          totalKeywords: statsData.totalKeywords ||
            (statsData.ungroupedCount + statsData.groupedKeywordsCount +
              (statsData.confirmedKeywordsCount ?? 0) + statsData.blockedCount),
        },
      });

      dispatch(setProjectStats({
        projectId: projectIdStr,
        stats: statsData,
      }));
    } catch (error) {
      console.error('Error fetching project stats:', error);
      addSnackbarMessage(
        'Error fetching stats: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    }
  }, [projectIdStr, addSnackbarMessage, dispatch]);
  const calculateMaintainedPage = useCallback((
    currentPage: number,
    currentLimit: number,
    selectedIds: Set<number>,
    totalItemsBefore: number
  ) => {
    const currentStartIndex = (currentPage - 1) * currentLimit;
    
    const estimatedRemovedCount = selectedIds.size;
    const newTotal = Math.max(0, totalItemsBefore - estimatedRemovedCount);
    if (currentPage === 1) return 1;
    const newPage = Math.max(1, Math.ceil((currentStartIndex + 1) / currentLimit));
    const maxPage = Math.max(1, Math.ceil(newTotal / currentLimit));
    return Math.min(newPage, maxPage);
  }, []);

  const fetchKeywords = useCallback(async (
    page = pagination.page,
    limit = pagination.limit,
    view = activeView,
    sort = sortParams,
    filters = filterParams,
    forceRefresh = false
  ) => {
    if (!projectIdStr) return;
    detailDispatch({
      type: 'updateProcessing',
      payload: { isTableLoading: true },
    });
    const requestedPage = page;
    
    try {
      const hasActiveFilters = 
        filters.tokens.length > 0 || 
        filters.include || 
        filters.exclude || 
        filters.minVolume !== "" || 
        filters.maxVolume !== "" || 
        filters.minLength !== "" || 
        filters.maxLength !== "" || 
        filters.minDifficulty !== "" || 
        filters.maxDifficulty !== "" || 
        filters.minRating !== "" || 
        filters.maxRating !== "" || 
        (filters.serpFeatures && filters.serpFeatures.length > 0);

      const cacheKey = [projectIdStr, view, page, limit, JSON.stringify(filters)].join('-');
      const totalCountKey = [projectIdStr, view, 'total', JSON.stringify(filters)].join('-');
      const cachedKeywords = !forceRefresh ? apiCache.get<Keyword[]>(cacheKey) : null;
      const cachedTotalCount = !forceRefresh ? apiCache.get<number>(totalCountKey) : null;
      
      if (cachedKeywords && cachedTotalCount !== null && !forceRefresh) {
        const totalPages = Math.max(1, Math.ceil(cachedTotalCount / limit));
        const validPage = Math.min(requestedPage, totalPages);
        
        dispatch(setKeywordsForView({
          projectId: projectIdStr,
          view,
          keywords: cachedKeywords.map(kw => ({
            ...kw,
            original_volume: kw.volume || 0,
            project_id: projectIdNum,
            status: view === 'confirmed' ? 'confirmed' : (view as 'ungrouped' | 'grouped' | 'blocked')
          })),
          totalCount: cachedTotalCount,
        }));
        
        detailDispatch({
          type: 'updatePagination',
          payload: {
            pagination: {
              total: cachedTotalCount,
              page: validPage,
              limit: limit,
              pages: totalPages,
            },
          },
        });
        
        detailDispatch({
          type: 'updateProcessing',
          payload: { isTableLoading: false },
        });
        return;
      }

      if ((view === 'grouped' || view === 'confirmed') && hasActiveFilters && (forceRefresh || !cachedKeywords)) {
        const largeLimit = 10000;
        const largeQueryParams = new URLSearchParams({
          page: "1",
          limit: largeLimit.toString(),
          status: view,
          sort: sort.column,
          direction: sort.direction,
          includeMatchType,
          excludeMatchType,
        });
        if (filters.tokens?.length > 0) {
          filters.tokens.forEach(token => largeQueryParams.append('tokens', token));
        }
        
        if (filters.include) largeQueryParams.set('include', filters.include);
        if (filters.exclude) largeQueryParams.set('exclude', filters.exclude);
        if (filters.minVolume !== "") largeQueryParams.set('minVolume', filters.minVolume.toString());
        if (filters.maxVolume !== "") largeQueryParams.set('maxVolume', filters.maxVolume.toString());
        if (filters.minLength !== "") largeQueryParams.set('minLength', filters.minLength.toString());
        if (filters.maxLength !== "") largeQueryParams.set('maxLength', filters.maxLength.toString());
        if (filters.minDifficulty !== "") largeQueryParams.set('minDifficulty', filters.minDifficulty.toString());
        if (filters.maxDifficulty !== "") largeQueryParams.set('maxDifficulty', filters.maxDifficulty.toString());
        if (filters.minRating !== "") largeQueryParams.set('minRating', filters.minRating.toString());
        if (filters.maxRating !== "") largeQueryParams.set('maxRating', filters.maxRating.toString());
        
        if (filters.serpFeatures?.length > 0) {
          filters.serpFeatures.forEach(feature => largeQueryParams.append('serpFeatures', feature));
        }
        const largeData = await fetchKeywordsApi(projectIdStr, largeQueryParams, true);
        let allKeywords: Keyword[] = [];
        if ((view as string) === 'ungrouped') allKeywords = largeData.ungroupedKeywords || [];
        else if (view === 'grouped') allKeywords = largeData.groupedKeywords || [];
        else if (view === 'confirmed') allKeywords = largeData.confirmedKeywords || [];
        else if (view === 'blocked') allKeywords = largeData.blockedKeywords || [];
        let filteredResults = [...allKeywords];
        if (filters.tokens.length > 0) {
          filteredResults = filteredResults.filter(keyword =>
            filters.tokens.every(token => (keyword.tokens || []).includes(token))
          );
        }
        
        if (filters.include) {
          const includeTerms = filters.include.split(',').map(t => t.trim().toLowerCase());
          filteredResults = filteredResults.filter(keyword => {
            const keywordLower = (keyword.keyword || '').toLowerCase();
            const searchText = (view === 'grouped' || view === 'confirmed') && keyword.groupName 
              ? keywordLower + ' ' + keyword.groupName.toLowerCase()
              : keywordLower;
  
            return includeMatchType === 'any'
              ? includeTerms.some(term => searchText.includes(term))
              : includeTerms.every(term => searchText.includes(term));
          });
        }
        
        if (filters.exclude) {
          const excludeTerms = filters.exclude.split(',').map(t => t.trim().toLowerCase());
          filteredResults = filteredResults.filter(keyword => {
            const keywordLower = (keyword.keyword || '').toLowerCase();
            const searchText = (view === 'grouped' || view === 'confirmed') && keyword.groupName 
              ? keywordLower + ' ' + keyword.groupName.toLowerCase()
              : keywordLower;

            return excludeMatchType === 'any'
              ? !excludeTerms.some(term => searchText.includes(term))
              : !excludeTerms.every(term => searchText.includes(term));
          });
        }
        
        if (filters.serpFeatures && filters.serpFeatures.length > 0) {
          filteredResults = filteredResults.filter(keyword => {
            const serpFeatures = getSerpFeatures(keyword);
            return filters.serpFeatures.every(feature => serpFeatures.includes(feature));
          });
        }
        
        if (filters.minVolume !== "") {
          filteredResults = filteredResults.filter(keyword => 
            (keyword.volume || 0) >= Number(filters.minVolume)
          );
        }
        
        if (filters.maxVolume !== "") {
          filteredResults = filteredResults.filter(keyword => 
            (keyword.volume || 0) <= Number(filters.maxVolume)
          );
        }
        
        if (filters.minLength !== "") {
          filteredResults = filteredResults.filter(keyword => 
            (keyword.length || 0) >= Number(filters.minLength)
          );
        }
        
        if (filters.maxLength !== "") {
          filteredResults = filteredResults.filter(keyword => 
            (keyword.length || 0) <= Number(filters.maxLength)
          );
        }
        
        if (filters.minDifficulty !== "") {
          filteredResults = filteredResults.filter(keyword => 
            (keyword.difficulty || 0) >= Number(filters.minDifficulty)
          );
        }
        
        if (filters.maxDifficulty !== "") {
          filteredResults = filteredResults.filter(keyword => 
            (keyword.difficulty || 0) <= Number(filters.maxDifficulty)
          );
        }

        if (filters.minRating !== "") {
          filteredResults = filteredResults.filter(keyword => 
            (keyword.rating || 0) >= Number(filters.minRating)
          );
        }
        
        if (filters.maxRating !== "") {
          filteredResults = filteredResults.filter(keyword => 
            (keyword.rating || 0) <= Number(filters.maxRating)
          );
        }

        const totalItems = filteredResults.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));
        const validPage = Math.min(Math.max(1, requestedPage), totalPages);

        apiCache.set(totalCountKey, totalItems);

        const startIndex = (validPage - 1) * limit;
        const endIndex = Math.min(startIndex + limit, totalItems);
        const pagedResults = filteredResults.slice(startIndex, endIndex);

        apiCache.set(cacheKey, pagedResults);

        dispatch(setKeywordsForView({
          projectId: projectIdStr,
          view,
          keywords: pagedResults.map(kw => ({
            ...kw,
            original_volume: kw.volume || 0,
            project_id: projectIdNum,
            status: view === 'confirmed' ? 'confirmed' : (view as 'ungrouped' | 'grouped' | 'blocked')
          })),
          totalCount: totalItems,
        }));

        detailDispatch({
          type: 'updatePagination',
          payload: {
            pagination: {
              total: totalItems,
              page: validPage,
              limit: limit,
              pages: totalPages,
            },
          },
        });
        
        detailDispatch({
          type: 'updateProcessing',
          payload: { isTableLoading: false },
        });
        return;
      }
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        status: view,
        sort: sort.column,
        direction: sort.direction,
        includeMatchType,
        excludeMatchType,
      });
      if (filters.tokens?.length > 0) {
        filters.tokens.forEach(token => queryParams.append('tokens', token));
      }
      if (filters.include) queryParams.set('include', filters.include);
      if (filters.exclude) queryParams.set('exclude', filters.exclude);
      if (filters.minVolume !== "") queryParams.set('minVolume', filters.minVolume.toString());
      if (filters.maxVolume !== "") queryParams.set('maxVolume', filters.maxVolume.toString());
      if (filters.minLength !== "") queryParams.set('minLength', filters.minLength.toString());
      if (filters.maxLength !== "") queryParams.set('maxLength', filters.maxLength.toString());
      if (filters.minDifficulty !== "") queryParams.set('minDifficulty', filters.minDifficulty.toString());
      if (filters.maxDifficulty !== "") queryParams.set('maxDifficulty', filters.maxDifficulty.toString());
      if (filters.minRating !== "") queryParams.set('minRating', filters.minRating.toString());
      if (filters.maxRating !== "") queryParams.set('maxRating', filters.maxRating.toString());
      
      if (filters.serpFeatures?.length > 0) {
        filters.serpFeatures.forEach(feature => queryParams.append('serpFeatures', feature));
      }
      const data = await fetchKeywordsApi(projectIdStr, queryParams, false);
      let keywords: Keyword[] = [];
      if (view === 'ungrouped') keywords = data.ungroupedKeywords || [];
      else if (view === 'grouped') keywords = data.groupedKeywords || [];
      else if (view === 'confirmed') keywords = data.confirmedKeywords || [];
      else if (view === 'blocked') keywords = data.blockedKeywords || [];

      apiCache.set(cacheKey, keywords);
      const totalItems = data.pagination?.total || keywords.length;
      apiCache.set(totalCountKey, totalItems);

      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const validPage = Math.min(Math.max(1, requestedPage), totalPages);

      dispatch(setKeywordsForView({
        projectId: projectIdStr,
        view,
        keywords: keywords.map(kw => ({
          ...kw,
          original_volume: kw.volume || 0,
          project_id: projectIdNum,
          status: view === 'confirmed' ? 'confirmed' : (view as 'ungrouped' | 'grouped' | 'blocked')
        })),
        totalCount: totalItems,
      }));
      detailDispatch({
        type: 'updatePagination',
        payload: {
          pagination: {
            total: totalItems,
            page: validPage,
            limit: limit,
            pages: totalPages,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching keywords:', error);
      addSnackbarMessage(
        'Error loading keywords: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      detailDispatch({
        type: 'updateProcessing',
        payload: { isTableLoading: false },
      });
    }
  }, [
    projectIdStr, 
    pagination.page, 
    pagination.limit, 
    activeView, 
    sortParams, 
    includeMatchType, 
    excludeMatchType, 
    filterParams,
    projectIdNum, 
    dispatch, 
    addSnackbarMessage, 
    apiCache
  ]);

  const getSerpFeatures = (
    keyword: Keyword | SerpFeatureCarrier | null | undefined
  ): string[] => {
    if (!keyword || !keyword.serpFeatures) return [];
    if (Array.isArray(keyword.serpFeatures)) return keyword.serpFeatures;
    if (typeof keyword.serpFeatures === 'string') {
      try {
        const parsed = JSON.parse(keyword.serpFeatures);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  };
  const fetchChildren = useCallback(async (groupId: string) => {
    if (!projectIdStr) return [];
    try {
      const timestamp = new Date().getTime();
      const data = await fetchKeywordChildren(projectIdStr, groupId);
      return data.children;
    } catch (error) {
      console.error('Error fetching children:', error);
      addSnackbarMessage(
        'Error loading children: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
      return [];
    }
  }, [projectIdStr, addSnackbarMessage]);

  const handleExportCSV = useCallback(async () => {
    if (activeView !== 'grouped' && activeView !== 'confirmed') return;

    detailDispatch({
      type: 'updateProcessing',
      payload: { isExporting: true },
    });
    addSnackbarMessage('Starting export, please wait...', 'success');

    try {
      const blobData = await exportGroupedKeywords(projectIdStr, activeView);
      const url = window.URL.createObjectURL(blobData);
      const link = document.createElement('a');
      link.href = url;
      const viewType = activeView === 'grouped' ? 'grouped' : 'confirmed';
      const filename = viewType + '_keywords_' + projectIdStr + '_' + new Date().toISOString().slice(0, 10) + '.csv';
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      addSnackbarMessage('CSV exported successfully', 'success');
      bumpLogsRefresh();
    } catch (error) {
      console.error('Error during export:', error);
      addSnackbarMessage(
        'Error exporting CSV: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      detailDispatch({
        type: 'updateProcessing',
        payload: { isExporting: false },
      });
    }
  }, [activeView, projectIdStr, addSnackbarMessage, bumpLogsRefresh]);

  const handleExportParentKeywords = useCallback(async () => {
    detailDispatch({
      type: 'updateProcessing',
      payload: { isExportingParent: true },
    });
    addSnackbarMessage('Starting parent keywords export, please wait...', 'success');

    try {
      const blobData = await exportParentKeywords(projectIdStr);
      const url = window.URL.createObjectURL(blobData);
      const link = document.createElement('a');
      link.href = url;
      const filename = 'parent_keywords_' + projectIdStr + '_' + new Date().toISOString().slice(0, 10) + '.csv';
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      addSnackbarMessage('Parent keywords CSV exported successfully', 'success');
      bumpLogsRefresh();
    } catch (error) {
      console.error('Error during parent export:', error);
      addSnackbarMessage(
        'Error exporting parent keywords: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      detailDispatch({
        type: 'updateProcessing',
        payload: { isExportingParent: false },
      });
    }
  }, [projectIdStr, addSnackbarMessage, bumpLogsRefresh]);

  const handleImportParentKeywords = useCallback(async (file: File) => {
    detailDispatch({
      type: 'updateProcessing',
      payload: { isImportingParent: true },
    });
    addSnackbarMessage('Starting parent keywords import, please wait...', 'success');

    try {
      const formData = new FormData();
      formData.append('file', file);

      await importParentKeywords(projectIdStr, formData);
      addSnackbarMessage('Parent keywords imported successfully', 'success');

      await fetchKeywords(
        pagination.page,
        pagination.limit,
        activeView,
        sortParams,
        filterParams,
        true
      );
      bumpLogsRefresh();
    } catch (error) {
      console.error('Error during parent import:', error);
      addSnackbarMessage(
        'Error importing parent keywords: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      detailDispatch({
        type: 'updateProcessing',
        payload: { isImportingParent: false },
      });
    }
  }, [projectIdStr, addSnackbarMessage, fetchKeywords, pagination, activeView, sortParams, filterParams, bumpLogsRefresh]);

  const handleViewChange = useCallback((newView: ActiveKeywordView) => {
  if (activeView !== newView) {
    detailDispatch({
      type: 'updateView',
      payload: { activeView: newView },
    });
    detailDispatch({
      type: 'updateSelection',
      payload: {
        selectedKeywordIds: new Set(),
        expandedGroups: new Set(),
      },
    });
    detailDispatch({
      type: 'updatePagination',
      payload: {
        pagination: { ...pagination, page: 1 },
      },
    });
    apiCache.invalidateByView(projectIdStr, newView);
    fetchKeywords(1, pagination.limit, newView, sortParams, {
      ...filterParams,
      minVolume: "",
      maxVolume: "",
      minLength: "",
      maxLength: "",
      minDifficulty: "",
      maxDifficulty: "",
      serpFeatures: [],
      minRating: '',
      maxRating: '',
    }, true);
  }
}, [
  activeView, pagination, sortParams, filterParams, fetchKeywords, projectIdStr, apiCache
]);

const handlePageChange = useCallback((newPage: number) => {
  if (newPage < 1 || newPage === pagination.page || newPage > pagination.pages || isLoadingData) return;
  detailDispatch({
    type: 'updatePagination',
    payload: {
      pagination: { ...pagination, page: newPage },
    },
  });
  fetchKeywords(newPage, pagination.limit, activeView, sortParams, filterParams, false);
}, [pagination, isLoadingData, fetchKeywords, activeView, sortParams, filterParams]);
const handleLimitChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
  const newLimit = parseInt(event.target.value, 10);
  if (!isNaN(newLimit) && newLimit !== pagination.limit) {
    detailDispatch({
      type: 'updatePagination',
      payload: {
        pagination: { ...pagination, limit: newLimit, page: 1 },
      },
    });
  fetchKeywords(1, newLimit, activeView, sortParams, filterParams, true);
  }
}, [pagination, fetchKeywords, activeView, sortParams, filterParams]);
const handleSort = useCallback((column: string) => {
  if (column === 'tokens' || column === 'serpFeatures') return;
  const newDirection: 'asc' | 'desc' = sortParams.column === column && sortParams.direction === 'asc' ? 'desc' : 'asc';
  const newSortParams: SortParams = { column, direction: newDirection };
  detailDispatch({
    type: 'updatePagination',
    payload: {
      sortParams: newSortParams,
      pagination: { ...pagination, page: 1 },
    },
  });
  fetchKeywords(1, pagination.limit, activeView, newSortParams, filterParams);
}, [sortParams.column, sortParams.direction, fetchKeywords, pagination, activeView, filterParams]);

const filteredAndSortedKeywords = useMemo(() => {
  return getCurrentViewData();
}, [getCurrentViewData]);

const formatDataForDisplay = useMemo(() => {
  const keywords = getCurrentViewData();
  
  return keywords.map(parent => {
    let children: Keyword[] = [];
    
    if (parent.groupId && expandedGroups.has(parent.groupId)) {
      children = childrenCache[parent.groupId] || [];
      if (activeView === 'grouped' && (includeFilter || excludeFilter)) {
        children = children.filter(child => {
          const childKeywordLower = child.keyword.toLowerCase();
          let includeMatch = true;
          if (includeFilter) {
            const includeTerms = includeFilter.split(',').map(t => t.trim().toLowerCase());
            if (includeMatchType === 'any') {
              includeMatch = includeTerms.some(term => childKeywordLower.includes(term));
            } else {
              includeMatch = includeTerms.every(term => childKeywordLower.includes(term));
            }
          }
          let excludeMatch = false;
          if (excludeFilter) {
            const excludeTerms = excludeFilter.split(',').map(t => t.trim().toLowerCase());
            if (excludeMatchType === 'any') {
              excludeMatch = excludeTerms.some(term => childKeywordLower.includes(term));
            } else {
              excludeMatch = excludeTerms.every(term => childKeywordLower.includes(term));
            }
          }
          
          return includeMatch && !excludeMatch;
        });
      }
    }
      
    return {
      parent,
      children,
      key: [activeView, parent.id, parent.groupId || 'nogroup'].join('-')
    };
  });
}, [
  getCurrentViewData,
  expandedGroups,
  childrenCache,
  activeView,
  includeFilter,
  excludeFilter,
  includeMatchType,
  excludeMatchType
]);
const toggleKeywordSelection = useCallback(async (keywordId: number) => {
  let nextSelected = new Set(selectedKeywordIds);
  let nextGroupName = groupName;
  const allFilteredIds = filteredAndSortedKeywords.map(k => k.id);

  try {
    if (keywordId === -1) {
      // SELECT ALL - this is the only case where we auto-select children
      for (const id of allFilteredIds) {
        nextSelected.add(id);
        const parent = filteredAndSortedKeywords.find(k => k.id === id);
        // Only auto-select children when using SELECT ALL and selecting PARENT keywords
        if (activeView === 'grouped' && parent?.groupId && parent.isParent) {
          let children = childrenCache[parent.groupId] || [];
          if (children.length === 0 && (parent.childCount ?? 0) > 0) {
            try {
              children = await fetchChildren(parent.groupId);
              dispatch(setChildrenForGroup({ projectId: projectIdStr, groupId: parent.groupId, children }));
            } catch (error) {
              console.error('Error fetching children for group:', parent.groupId, error);
              children = [];
            }
          }
          // Only add children if they were successfully fetched
          if (children && children.length > 0) {
            nextSelected = new Set(nextSelected);
            children.forEach(child => nextSelected.add(child.id));
          }
        }
      }
      const highestVolumeKeyword = filteredAndSortedKeywords.reduce((max, curr) => 
        (curr.volume || 0) > (max.volume || 0) ? curr : max,
        filteredAndSortedKeywords[0]
      );
      if (highestVolumeKeyword) {
        if (activeView === 'ungrouped') {
          nextGroupName = highestVolumeKeyword.keyword;
        } else if (activeView === 'grouped') {
          // For grouped view, use parent keyword name if available
          if (highestVolumeKeyword.isParent) {
            nextGroupName = highestVolumeKeyword.keyword;
          } else {
            const parentKeyword = filteredAndSortedKeywords.find(
              k => k.groupId === highestVolumeKeyword.groupId && k.isParent
            );
            nextGroupName = parentKeyword ? parentKeyword.keyword : highestVolumeKeyword.keyword;
          }
        }
      }
    } else if (keywordId === 0) {
      nextSelected = new Set();
      nextGroupName = '';
    } else {
      const selectedKeyword = filteredAndSortedKeywords.find(k => k.id === keywordId) ||
        Object.values(childrenCache).flat().find(k => k.id === keywordId);

      if (nextSelected.has(keywordId)) {
        nextSelected = new Set(nextSelected);
        nextSelected.delete(keywordId);
        // NO AUTO-DESELECTION - only deselect what the user explicitly clicks
        if (nextSelected.size === 0) {
          nextGroupName = '';
        }
      } else {
        if (selectedKeyword) {
          nextSelected = new Set(nextSelected);
          nextSelected.add(keywordId);
          // NO AUTO-SELECTION - only select what the user explicitly clicks
          
          const selectedKeywords = Array.from(nextSelected).map(id => 
            filteredAndSortedKeywords.find(k => k.id === id) || 
            Object.values(childrenCache).flat().find(k => k.id === id)
          ).filter(Boolean);
          
          const highestVolumeKeyword = selectedKeywords.reduce((max, curr) => 
            (curr && curr.volume && max && max.volume && curr.volume > max.volume) ? curr : max,
            selectedKeywords[0]
          );
          
          if (highestVolumeKeyword) {
            if (activeView === 'ungrouped') {
              nextGroupName = highestVolumeKeyword.keyword;
            } else if (activeView === 'grouped') {
              // For grouped view, always use the parent keyword name if it's a parent
              if (highestVolumeKeyword.isParent) {
                nextGroupName = highestVolumeKeyword.keyword;
              } else {
                // If it's a child, find its parent
                const parentKeyword = filteredAndSortedKeywords.find(
                  k => k.groupId === highestVolumeKeyword.groupId && k.isParent
                );
                nextGroupName = parentKeyword ? parentKeyword.keyword : highestVolumeKeyword.keyword;
              }
            }
          }
        }
      }
    }

    detailDispatch({
      type: 'updateSelection',
      payload: {
        selectedKeywordIds: nextSelected,
        groupName: nextGroupName,
      },
    });
  } catch (err) {
    console.error('Error in toggleKeywordSelection:', err);
    addSnackbarMessage(
      'Error selecting keywords: ' + (isError(err) ? err.message : 'Unknown error'),
      'error'
    );
  }
}, [
  selectedKeywordIds,
  groupName,
  filteredAndSortedKeywords,
  activeView,
  childrenCache,
  fetchChildren,
  dispatch,
  projectIdStr,
  addSnackbarMessage,
]);

  const handleSelectAllClick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    toggleKeywordSelection(isChecked ? -1 : 0).catch(err => {
      addSnackbarMessage(
        'Error selecting all: ' + (isError(err) ? err.message : 'Unknown error'),
        'error'
      );
    });
  }, [toggleKeywordSelection, addSnackbarMessage]);

  const toggleTokenSelection = useCallback((token: string) => {
    const isCurrentlySelected = selectedTokens.includes(token);
    const newTokens = isCurrentlySelected
      ? selectedTokens.filter(t => t !== token)
      : [...selectedTokens, token];
    detailDispatch({
      type: 'updateFilters',
      payload: { selectedTokens: newTokens },
    });
    const currentPage = pagination.page;
    apiCache.invalidate(projectIdStr + '-' + activeView);
    fetchKeywords(
      currentPage,
      pagination.limit,
      activeView,
      sortParams,
      { ...filterParams, tokens: newTokens },
      true
    );
  }, [selectedTokens, pagination, apiCache, projectIdStr, activeView, fetchKeywords, sortParams, filterParams]);
  

  const handleAdvancedTokenSelection = useCallback(async (token: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (!projectIdStr) return;
      detailDispatch({
        type: 'updateProcessing',
        payload: { isProcessingAction: true, isTableLoading: true },
      });
      try {
        const tokensBackup = [...selectedTokens].filter(t => t !== token);
        const includeFilterBackup = includeFilter;
        const excludeFilterBackup = excludeFilter;
        const minVolumeBackup = minVolume;
        const maxVolumeBackup = maxVolume;
        const minDifficultyBackup = minDifficulty;
        const maxDifficultyBackup = maxDifficulty;
        const serpFeaturesBackup = [...selectedSerpFeatures];
        const currentPage = pagination.page;
        const data = await blockToken(projectIdStr, token);
        addSnackbarMessage('Blockd ' + data.count + ' keywords with token "' + token + '"', 'success');
        apiCache.invalidate(projectIdStr + '-' + activeView + '-total-');
        await fetchProjectStats();
        await fetchKeywords(
          currentPage,
          pagination.limit,
          activeView,
          sortParams,
          {
            tokens: tokensBackup,
            include: includeFilterBackup,
            exclude: excludeFilterBackup,
            minVolume: minVolumeBackup ? parseInt(minVolumeBackup) : "",
            maxVolume: maxVolumeBackup ? parseInt(maxVolumeBackup) : "",
            minLength: minLength ? parseInt(minLength) : "",
            maxLength: maxLength ? parseInt(maxLength) : "",
            minDifficulty: minDifficultyBackup ? parseFloat(minDifficultyBackup) : "",
            maxDifficulty: maxDifficultyBackup ? parseFloat(maxDifficultyBackup) : "",
            serpFeatures: serpFeaturesBackup,
            minRating: minRating ? parseInt(minRating) : "",
            maxRating: maxRating ? parseInt(maxRating) : "",
          },
          false
        );
        bumpLogsRefresh();
        
      } catch (error) {
        addSnackbarMessage(
          'Error blocking keywords: ' + (isError(error) ? error.message : 'Unknown error'),
          'error'
        );
      } finally {
        detailDispatch({
          type: 'updateProcessing',
          payload: { isProcessingAction: false, isTableLoading: false },
        });
      }
    } else {
      toggleTokenSelection(token);
    }
  }, [projectIdStr, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, pagination, addSnackbarMessage, apiCache, activeView, fetchProjectStats, fetchKeywords, sortParams, minRating, maxRating, toggleTokenSelection, bumpLogsRefresh]);


  const removeToken = useCallback((token: string) => {
    detailDispatch({
      type: 'updateFilters',
      payload: { selectedTokens: selectedTokens.filter(t => t !== token) },
    });
    const currentPage = pagination.page;
    apiCache.invalidate(projectIdStr + '-' + activeView);
    fetchKeywords(
      currentPage,
      pagination.limit,
      activeView,
      sortParams,
      { ...filterParams, tokens: selectedTokens.filter(t => t !== token) },
      true
    );
  }, [pagination, apiCache, projectIdStr, activeView, fetchKeywords, sortParams, selectedTokens, filterParams]);
  const handleIncludeFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      detailDispatch({
        type: 'updateFilters',
        payload: { includeFilter: newValue },
      });
      const executeSearch = async () => {
        detailDispatch({
          type: 'updatePagination',
          payload: {
            pagination: { ...pagination, page: 1 },
          },
        });
        if (activeView === 'grouped' && newValue) {
          const existingChildrenGroups = Object.keys(childrenCache).filter(
            groupId => childrenCache[groupId] && childrenCache[groupId].length > 0
          );
          
          const groupsToExpand = new Set<string>();
          
          existingChildrenGroups.forEach(groupId => {
            const children = childrenCache[groupId];
            const includeTerms = newValue.split(',').map(t => t.trim().toLowerCase());
            const hasMatch = children.some(child => {
              const childKeywordLower = child.keyword.toLowerCase();
              return includeMatchType === 'any'
                ? includeTerms.some(term => childKeywordLower.includes(term))
                : includeTerms.every(term => childKeywordLower.includes(term));
            });
            
            if (hasMatch) {
              groupsToExpand.add(groupId);
            }
          });
          
          if (groupsToExpand.size > 0) {
            detailDispatch({
              type: 'updateSelection',
              payload: { expandedGroups: groupsToExpand },
            });
          }
        } else if (!newValue) {
          detailDispatch({
            type: 'updateSelection',
            payload: { expandedGroups: new Set() },
          });
        }
        
        await fetchKeywords(
          1,
          pagination.limit,
          activeView,
          sortParams,
          { ...filterParams, include: newValue },
          true
        );
      };
      
      executeSearch();
    },
    [activeView, fetchKeywords, pagination, sortParams, childrenCache, includeMatchType, filterParams]
  );
  const handleExcludeFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      detailDispatch({
        type: 'updateFilters',
        payload: { excludeFilter: newValue },
      });
      const executeSearch = async () => {
        detailDispatch({
          type: 'updatePagination',
          payload: {
            pagination: { ...pagination, page: 1 },
          },
        });
        await fetchKeywords(
          1,
          pagination.limit,
          activeView,
          sortParams,
          { ...filterParams, exclude: newValue },
          true
        );
      };
      
      executeSearch();
    },
    [fetchKeywords, pagination, activeView, sortParams, filterParams]
  );
  const clearAllFilters = useCallback(() => {
    detailDispatch({
      type: 'updateFilters',
      payload: {
        selectedTokens: [],
        includeFilter: '',
        excludeFilter: '',
        includeMatchType: 'any',
        excludeMatchType: 'any',
        minVolume: '',
        maxVolume: '',
        minDifficulty: '',
        maxDifficulty: '',
        selectedSerpFeatures: [],
      },
    });
    detailDispatch({
      type: 'updatePagination',
      payload: {
        pagination: { ...pagination, page: 1 },
      },
    });
    apiCache.invalidate(projectIdStr + '-' + activeView);
    fetchKeywords(1, pagination.limit, activeView, sortParams, {
      tokens: [],
      include: '',
      exclude: '',
      minVolume: "",
      maxVolume: "",
      minLength: "",
      maxLength: "",
      minDifficulty: "",
      maxDifficulty: "",
      serpFeatures: [],
      minRating: '',
      maxRating: ''
    }, true);
  }, [
    fetchKeywords, 
    pagination, 
    activeView, 
    sortParams,
    projectIdStr,
    apiCache
  ]);

   const toggleGroupExpansion = useCallback(async (groupId: string, hasChildren: boolean) => {
    if (!groupId || !hasChildren || !projectIdStr) return;
    const isCurrentlyExpanded = expandedGroups.has(groupId);
    if (isCurrentlyExpanded) {
      const newSet = new Set(expandedGroups);
      newSet.delete(groupId);
      detailDispatch({
        type: 'updateSelection',
        payload: { expandedGroups: newSet },
      });
    } else {
      const newSet = new Set(expandedGroups);
      newSet.add(groupId);
      detailDispatch({
        type: 'updateSelection',
        payload: { expandedGroups: newSet },
      });
      const groupData = childrenCache[groupId];

      const nextLoading = new Set(loadingChildren);
      nextLoading.add(groupId);
      detailDispatch({
        type: 'updateSelection',
        payload: { loadingChildren: nextLoading },
      });
      try {
        const children = await fetchChildren(groupId);
        dispatch(setChildrenForGroup({ projectId: projectIdStr, groupId, children }));
      } catch (err) {
        const nextExpanded = new Set(expandedGroups);
        nextExpanded.delete(groupId);
        detailDispatch({
          type: 'updateSelection',
          payload: { expandedGroups: nextExpanded },
        });
        addSnackbarMessage(
          'Error loading children: ' + (isError(err) ? err.message : 'Unknown error'),
          'error'
        );
      } finally {
        const nextLoadingSet = new Set(loadingChildren);
        nextLoadingSet.delete(groupId);
        detailDispatch({
          type: 'updateSelection',
          payload: { loadingChildren: nextLoadingSet },
        });
      }
    }
  }, [projectIdStr, childrenCache, dispatch, addSnackbarMessage, expandedGroups, loadingChildren, fetchChildren]);

  const handleConfirmKeywords = useCallback(async () => {
    if (!guardGroupingAction()) {
      return;
    }
    const keywordIds = Array.from(selectedKeywordIds);
    if (keywordIds.length === 0 || activeView !== 'grouped' || !projectIdStr) {
      addSnackbarMessage('Select grouped keywords to confirm', 'error');
      return;
    }

    const maintainedPage = calculateMaintainedPage(
      pagination.page,
      pagination.limit,
      selectedKeywordIds,
      pagination.total
    );

    detailDispatch({
      type: 'updateProcessing',
      payload: { isProcessingAction: true, isTableLoading: true },
    });

    try {
      const data = await confirmKeywords(projectIdStr, keywordIds);
      addSnackbarMessage('Confirmed ' + data.count + ' keywords', 'success');

      await Promise.all([
        fetchKeywords(
          maintainedPage,
          pagination.limit,
          activeView,
          sortParams,
          {
            ...filterParams,
            minVolume: "",
            maxVolume: "",
            minLength: "",
            maxLength: "",
            minDifficulty: "",
            maxDifficulty: "",
            serpFeatures: [],
            minRating: '',
            maxRating: '',
          },
          true
        ),
        fetchProjectStats(),
      ]);

      bumpLogsRefresh();
      detailDispatch({
        type: 'updateSelection',
        payload: {
          selectedKeywordIds: new Set(),
          groupName: '',
          expandedGroups: new Set(),
        },
      });
      
    } catch (error) {
      addSnackbarMessage(
        'Error confirming keywords: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      detailDispatch({
        type: 'updateProcessing',
        payload: { isProcessingAction: false, isTableLoading: false },
      });
    }
  }, [selectedKeywordIds, activeView, projectIdStr, addSnackbarMessage, fetchKeywords, pagination.limit, pagination.total, pagination.page, sortParams, filterParams, fetchProjectStats, calculateMaintainedPage, bumpLogsRefresh, guardGroupingAction]);

  const handleUnconfirmKeywords = useCallback(async () => {
    if (!guardGroupingAction()) {
      return;
    }
    const keywordIds = Array.from(selectedKeywordIds);
    if (keywordIds.length === 0 || activeView !== 'confirmed' || !projectIdStr) {
      addSnackbarMessage('Select confirmed keywords to unconfirm', 'error');
      return;
    }

    const maintainedPage = calculateMaintainedPage(
      pagination.page,
      pagination.limit,
      selectedKeywordIds,
      pagination.total
    );

    detailDispatch({
      type: 'updateProcessing',
      payload: { isProcessingAction: true, isTableLoading: true },
    });

    try {
      const data = await unconfirmKeywords(projectIdStr, keywordIds);
      addSnackbarMessage('Unconfirmed ' + data.count + ' keywords', 'success');

      await Promise.all([
        fetchKeywords(
          maintainedPage,
          pagination.limit,
          activeView,
          sortParams,
          {
            ...filterParams,
            minVolume: "",
            maxVolume: "",
            minLength: "",
            maxLength: "",
            minDifficulty: "",
            maxDifficulty: "",
            serpFeatures: [],
            minRating: '',
            maxRating: '',
          },
          true
        ),
        fetchProjectStats(),
      ]);

      bumpLogsRefresh();
      detailDispatch({
        type: 'updateSelection',
        payload: {
          selectedKeywordIds: new Set(),
          groupName: '',
          expandedGroups: new Set(),
        },
      });
      
    } catch (error) {
      addSnackbarMessage(
        'Error unconfirming keywords: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      detailDispatch({
        type: 'updateProcessing',
        payload: { isProcessingAction: false, isTableLoading: false },
      });
    }
  }, [selectedKeywordIds, activeView, projectIdStr, addSnackbarMessage, fetchKeywords, pagination.limit, pagination.total, pagination.page, sortParams, filterParams, fetchProjectStats, calculateMaintainedPage, bumpLogsRefresh, guardGroupingAction]);

  const handleGroupKeywords = useCallback(async (overrideGroupName?: string) => {
    if (!guardGroupingAction()) {
      return;
    }
    const keywordIds = Array.from(selectedKeywordIds);
    const trimmedGroupName = overrideGroupName && typeof overrideGroupName === 'string' 
      ? overrideGroupName.trim() 
      : groupName.trim();
    
    if (keywordIds.length === 0 || !trimmedGroupName || !projectIdStr) {
      addSnackbarMessage('Select keywords and provide a group name', 'error');
      return;
    }

    const maintainedPage = calculateMaintainedPage(
      pagination.page,
      pagination.limit,
      selectedKeywordIds,
      pagination.total
    );

    detailDispatch({
      type: 'updateProcessing',
      payload: { isProcessingAction: true, isTableLoading: true },
    });  
    
    try {
      let data;
      let targetEndpoint = 'group';
      let messagePrefix = 'grouped';
      
      if (activeView === 'grouped') {
        targetEndpoint = 'regroup';
        messagePrefix = 'regrouped';
        const selectedParents = keywordIds
          .map(id => filteredAndSortedKeywords.find(k => k.id === id))
          .filter(k => k && k.isParent);
        const selectedChildren = [];
        for (const id of keywordIds) {
          for (const groupId in childrenCache) {
            const children = childrenCache[groupId];
            const foundChild = children.find(child => child.id === id);
            if (foundChild) {
              selectedChildren.push(foundChild);
              break;
            }
          }
        }
        
        const totalSelected = selectedParents.length + selectedChildren.length;
          
        if (totalSelected > 0) {
          data = await regroupKeywords(projectIdStr, keywordIds, trimmedGroupName);
          
          if (selectedParents.length > 1) {
            messagePrefix = 'merged';
            addSnackbarMessage(
              'Successfully ' + messagePrefix + ' ' + selectedParents.length + ' groups into "' + trimmedGroupName + '"',
              'success'
            );
          } else if (selectedParents.length === 1 && selectedChildren.length > 0) {
            messagePrefix = 'added';
            addSnackbarMessage(
              'Successfully ' + messagePrefix + ' ' + selectedChildren.length + ' keywords to "' + trimmedGroupName + '"',
              'success'
            );
          } else {
            addSnackbarMessage(
              'Successfully ' + messagePrefix + ' ' + data.count + ' keywords as "' + trimmedGroupName + '"',
              'success'
            );
          }
        } else {
          addSnackbarMessage('Unable to identify selected keywords for regrouping', 'error');
          detailDispatch({
            type: 'updateProcessing',
            payload: { isProcessingAction: false, isTableLoading: false },
          });
          return;
        }
      } else {
        data = await groupKeywords(projectIdStr, keywordIds, trimmedGroupName);
        addSnackbarMessage(
          'Successfully ' + messagePrefix + ' ' + data.count + ' keywords as "' + trimmedGroupName + '"',
          'success'
        );
      }
      
      bumpLogsRefresh();
      apiCache.clear();
    
      Object.keys(childrenCache).forEach(groupId => {
        dispatch(setChildrenForGroup({ projectId: projectIdStr, groupId, children: [] }));
      });
      
      detailDispatch({
        type: 'updateSelection',
        payload: {
          selectedKeywordIds: new Set(),
          groupName: '',
        },
      });
      
      const refreshData = async () => {
        try {
          const statsData = await fetchProjectStatsApi(projectIdStr);
          if (statsData) {
            detailDispatch({
              type: 'setStats',
              payload: {
                ungroupedCount: statsData.ungroupedCount || 0,
                groupedKeywordsCount: statsData.groupedKeywordsCount || 0,
                confirmedKeywordsCount: statsData.confirmedKeywordsCount || 0,
                confirmedPages: statsData.confirmedPages || 0,
                groupedPages: statsData.groupedPages || 0,
                blockedCount: statsData.blockedCount || 0,
                totalParentKeywords: statsData.totalParentKeywords || 0,
                totalChildKeywords: statsData.totalChildKeywords || 0,
                groupCount: statsData.groupCount || 0,
                parentTokenCount: statsData.parentTokenCount || 0,
                childTokenCount: statsData.childTokenCount || 0,
                totalKeywords:
                  statsData.totalKeywords ||
                  (statsData.ungroupedCount +
                    statsData.groupedKeywordsCount +
                    (statsData.confirmedKeywordsCount || 0) +
                    statsData.blockedCount),
              },
            });
            
            dispatch(setProjectStats({
              projectId: projectIdStr,
              stats: statsData
            }));
          }
          
          await fetchKeywords(
            maintainedPage,
            pagination.limit,
            activeView,
            sortParams,
            { ...filterParams, serpFeatures: [] },
            true
          ); 
          
          if (data && data.groupId) {
            const newGroupId = data.groupId;
            dispatch(setChildrenForGroup({ 
              projectId: projectIdStr, 
              groupId: newGroupId, 
              children: [] 
            }));
          }
        } catch (err) {
          console.error("Error refreshing data:", err);
          addSnackbarMessage(
            'Error refreshing data: ' + (isError(err) ? err.message : 'Unknown error'),
            'error'
          );
        } finally {
          detailDispatch({
            type: 'updateProcessing',
            payload: { isProcessingAction: false, isTableLoading: false },
          });
        }
      };
      
      refreshData();
      
    } catch (error) {
      console.error("Grouping error:", error);
      addSnackbarMessage(
        'Error grouping keywords: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
      detailDispatch({
        type: 'updateProcessing',
        payload: { isProcessingAction: false, isTableLoading: false },
      });
    }
  }, [selectedKeywordIds, groupName, projectIdStr, calculateMaintainedPage, pagination.page, pagination.limit, pagination.total, addSnackbarMessage, activeView, apiCache, childrenCache, filteredAndSortedKeywords, dispatch, fetchKeywords, sortParams, filterParams, bumpLogsRefresh, guardGroupingAction]);

  useEffect(() => {
      const blurActiveCheckboxes = () => {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'INPUT' && (activeElement as HTMLInputElement).type === 'checkbox') {
          (activeElement as HTMLInputElement).blur();
        }
        const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
        allCheckboxes.forEach(checkbox => {
          (checkbox as HTMLInputElement).blur();
        });
      };

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key === 'Control') {
        blurActiveCheckboxes();
      }

      if (
        e.key === 'Shift' &&
        !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '') &&
        selectedKeywordIds.size > 0 &&
        (activeView === 'ungrouped' || activeView === 'grouped') &&
        !isProcessingAction
      ) {
        e.preventDefault();
        e.stopPropagation();

        const windowWithHandling = window as Window & { __handlingShiftPress?: boolean };
        if (windowWithHandling.__handlingShiftPress) return;
        windowWithHandling.__handlingShiftPress = true;
        if (window.__handlingShiftPress) return;
        window.__handlingShiftPress = true;

        try {
          blurActiveCheckboxes();

          let trimmedGroupName = groupName.trim();
          if (!trimmedGroupName) {
            const keywordIds = Array.from(selectedKeywordIds);
            const selectedKeywords = keywordIds
              .map(id => filteredAndSortedKeywords.find(k => k.id === id) || Object.values(childrenCache).flat().find(k => k.id === id))
              .filter(Boolean);

            if (selectedKeywords.length > 0) {
              const highestVolumeKeyword = selectedKeywords.reduce(
                (max, curr) => ((curr && curr.volume && max && max.volume && curr.volume > max.volume) ? curr : max),
                selectedKeywords[0]
              );

              if (highestVolumeKeyword) {
                trimmedGroupName =
                  activeView === 'ungrouped'
                    ? highestVolumeKeyword.keyword
                    : filteredAndSortedKeywords.find(k => k.groupId === highestVolumeKeyword.groupId && k.isParent)?.keyword ||
                      highestVolumeKeyword.keyword;
                setGroupName(trimmedGroupName);
              }
            }
          }

          if (trimmedGroupName) {
            await handleGroupKeywords(trimmedGroupName);
          } else {
            addSnackbarMessage('No valid group name determined', 'error');
          }
        } finally {
          setTimeout(() => {
            windowWithHandling.__handlingShiftPress = false;
            window.__handlingShiftPress = false;
          }, 300);
        }
      }

      if (
        e.key === 'Control' &&
        !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '') &&
        selectedKeywordIds.size > 0 &&
        (activeView === 'grouped' || activeView === 'confirmed') &&
        !isProcessingAction
      ) {
        e.preventDefault();
        e.stopPropagation();

        const windowWithHandling = window as Window & { __handlingCtrlPress?: boolean };
        if (windowWithHandling.__handlingCtrlPress) return;
        windowWithHandling.__handlingCtrlPress = true;
        if (window.__handlingCtrlPress) return;
        window.__handlingCtrlPress = true;

        try {
          blurActiveCheckboxes();

          if (activeView === 'grouped') {
            await handleConfirmKeywords();
          } else if (activeView === 'confirmed') {
            await handleUnconfirmKeywords();
          }
        } finally {
          setTimeout(() => {
            windowWithHandling.__handlingCtrlPress = false;
            window.__handlingCtrlPress = false;
          }, 300);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [
    selectedKeywordIds,
    activeView,
    groupName,
    handleGroupKeywords,
    handleConfirmKeywords,
    handleUnconfirmKeywords,
    filteredAndSortedKeywords,
    childrenCache,
    isProcessingAction,
    addSnackbarMessage,
    setGroupName,
  ]);
  const handleUngroupKeywords = useCallback(async () => {
    if (!guardGroupingAction()) {
      return;
    }
    const keywordIds = Array.from(selectedKeywordIds);
    if (keywordIds.length === 0 || activeView !== 'grouped' || !projectIdStr) {
      addSnackbarMessage('Select grouped keywords to ungroup', 'error');
      return;
    }

    const maintainedPage = calculateMaintainedPage(
      pagination.page,
      pagination.limit,
      selectedKeywordIds,
      pagination.total
    );

    detailDispatch({
      type: 'updateProcessing',
      payload: { isProcessingAction: true, isTableLoading: true },
    });
    
    try {
              const data = await ungroupKeywords(projectIdStr, keywordIds);
      addSnackbarMessage('Ungrouped ' + data.count + ' keywords', 'success');
      
      await Promise.all([
        fetchKeywords(
          maintainedPage,
          pagination.limit,
          activeView,
          sortParams,
          filterParams,
          true
        ),
        fetchProjectStats(),
      ]);
      
      bumpLogsRefresh();
      detailDispatch({
        type: 'updateSelection',
        payload: {
          selectedKeywordIds: new Set(),
          groupName: '',
          expandedGroups: new Set(),
        },
      });
      
    } catch (error) {
      addSnackbarMessage(
        'Error ungrouping keywords: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      detailDispatch({
        type: 'updateProcessing',
        payload: { isProcessingAction: false, isTableLoading: false },
      });
    }
  }, [selectedKeywordIds, activeView, projectIdStr, addSnackbarMessage, fetchKeywords, pagination.limit, pagination.total, pagination.page, sortParams, filterParams, fetchProjectStats, calculateMaintainedPage, bumpLogsRefresh, guardGroupingAction]);

  const handleUnblockKeywords = useCallback(async () => {
    const keywordIds = Array.from(selectedKeywordIds);
    if (keywordIds.length === 0 || activeView !== 'blocked' || !projectIdStr) {
      addSnackbarMessage('Select blocked keywords to unblock', 'error');
      return;
    }
    const maintainedPage = calculateMaintainedPage(
      pagination.page,
      pagination.limit,
      selectedKeywordIds,
      pagination.total
    );

    detailDispatch({
      type: 'updateProcessing',
      payload: { isProcessingAction: true, isTableLoading: true },
    });
    
    try {
              const data = await unblockKeywords(projectIdStr, keywordIds);
      addSnackbarMessage('Unblocked ' + data.count + ' keywords', 'success');
      
      await Promise.all([
        fetchKeywords(
          maintainedPage,
          pagination.limit,
          activeView,
          sortParams,
          filterParams,
          true
        ),
        fetchProjectStats(),
      ]);
      
      bumpLogsRefresh();
      detailDispatch({
        type: 'updateSelection',
        payload: { selectedKeywordIds: new Set() },
      });
    } catch (error) {
      addSnackbarMessage(
        'Error unblocking keywords: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      detailDispatch({
        type: 'updateProcessing',
        payload: { isProcessingAction: false, isTableLoading: false },
      });
    }
  }, [selectedKeywordIds, activeView, projectIdStr, addSnackbarMessage, fetchKeywords, pagination.limit, pagination.total, pagination.page, sortParams, filterParams, fetchProjectStats, calculateMaintainedPage, bumpLogsRefresh]);
    
    const handleMiddleClickGroup = useCallback(async (keywordIds: number[]) => {
    if (!guardGroupingAction()) {
      return;
    }
    if (activeView !== 'ungrouped') {
      addSnackbarMessage('Middle-click grouping only works in View 1 (Ungrouped)', 'error');
      return;
    }

    if (!keywordIds.length || !projectIdStr) {
      addSnackbarMessage('No keywords selected for grouping', 'error');
      return;
    }
  
    let trimmedGroupName = groupName.trim();
    if (!trimmedGroupName) {
      const selectedKeywords = keywordIds.map(id => 
        ungroupedKeywords.find(k => k.id === id)
      ).filter(Boolean);
      
      if (selectedKeywords.length > 0) {
        const highestVolumeKeyword = selectedKeywords.reduce((max, curr) => 
          (curr?.volume || 0) > (max?.volume || 0) ? curr : max, 
          selectedKeywords[0]
        );
        
        if (highestVolumeKeyword) {
          trimmedGroupName = highestVolumeKeyword.keyword;
          setGroupName(trimmedGroupName);
        }
      }
    }
    
    if (!trimmedGroupName) {
      addSnackbarMessage('Cannot determine a group name automatically', 'error');
      return;
    }
  
    const keywordInfo = keywordIds.length === 1 && ungroupedKeywords
      ? ungroupedKeywords.find(k => k.id === keywordIds[0])?.keyword
      : keywordIds.length + ' keywords';
  
    detailDispatch({
      type: 'updateProcessing',
      payload: { isProcessingAction: true },
    });
    try {
              const data = await groupKeywords(projectIdStr, keywordIds, trimmedGroupName);
      addSnackbarMessage('Grouped ' + keywordInfo + ' as "' + trimmedGroupName + '"', 'success');
  
      await fetchKeywords(
        pagination.page,
        pagination.limit,
        activeView,
        sortParams,
        filterParams,
        true
      );
      await fetchProjectStats();
      bumpLogsRefresh();
      detailDispatch({
        type: 'updateSelection',
        payload: { selectedKeywordIds: new Set() },
      });
    } catch (error) {
      addSnackbarMessage(
        'Error grouping keyword: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      detailDispatch({
        type: 'updateProcessing',
        payload: { isProcessingAction: false },
      });
    }
  }, [activeView, groupName, projectIdStr, ungroupedKeywords, addSnackbarMessage, setGroupName,
      fetchKeywords, pagination, sortParams, filterParams, fetchProjectStats, bumpLogsRefresh, guardGroupingAction]);
      
  const stopProcessingCheck = useCallback(() => {
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
      statusCheckIntervalRef.current = null;
    }
    statusCheckIntervalMsRef.current = null;
  }, []);
  const [csvUploadsRefreshKey, setCsvUploadsRefreshKey] = useState(0);

  const checkProcessingStatus = useCallback(async () => {
    if (!projectIdStr) return;

    try {
      const data = await checkProcessingStatusApi(projectIdStr);
      
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
        fetchKeywords(1, pagination.limit, activeView, sortParams, {
          ...filterParams,
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
            length: (kw.keyword || '').length
          };
        });

        dispatch(setKeywordsForView({
          projectId: projectIdStr,
          view: 'ungrouped',
          keywords: keywords.map((kw) => ({
            ...kw,
            original_volume: kw.volume || 0,
            project_id: projectIdNum,
            status: 'ungrouped',
            groupName: kw.keyword || '',
            serpFeatures: kw.serpFeatures ?? [],
            length: (kw.keyword || '').length
          })),
        }));
      }
    } catch (error) {
      console.error('Error checking processing status:', error);
      const message = 'Error checking status: ' + (isError(error) ? error.message : 'Unknown error');
      addSnackbarMessage(message, 'error');
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
    }
  }, [
    projectIdStr, processingStatus,
    fetchKeywords, pagination.limit, activeView, sortParams, 
    filterParams, addSnackbarMessage, 
    dispatch, projectIdNum, fetchProjectStats, bumpLogsRefresh
  ]);

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
  ]);

  useEffect(() => () => {
    stopProcessingCheck();
  }, [stopProcessingCheck]);
  
  
  const startProcessingCheck = useCallback(() => {
    stopProcessingCheck();
    checkProcessingStatus();
    statusCheckIntervalRef.current = setInterval(checkProcessingStatus, 1000);
    statusCheckIntervalMsRef.current = 1000;
  }, [checkProcessingStatus, stopProcessingCheck]);
  
  const fetchInitialData = useCallback(async () => {
    if (!projectIdStr) return;
  
    detailDispatch({
      type: 'updateProcessing',
      payload: { isLoadingData: true },
    });
    try {
      const queryParams = new URLSearchParams({
        page: '1',
        limit: pagination.limit.toString(),
        status: activeView
      });
      
              const initialData = await fetchInitialDataApi(projectIdStr + '?' + queryParams.toString());
      
      if (initialData) {
        if (initialData.stats) {
          detailDispatch({
            type: 'setStats',
            payload: {
              ungroupedCount: initialData.stats.ungroupedCount || 0,
              groupedKeywordsCount: initialData.stats.groupedKeywordsCount || 0,
              confirmedKeywordsCount: initialData.stats.confirmedKeywordsCount || 0,
              confirmedPages: initialData.stats.confirmedPages || 0,
              groupedPages: initialData.stats.groupedPages || 0,
              blockedCount: initialData.stats.blockedCount || 0,
              totalParentKeywords: initialData.stats.totalParentKeywords || 0,
              totalChildKeywords: initialData.stats.totalChildKeywords || 0,
              groupCount: initialData.stats.groupCount || 0,
              parentTokenCount: initialData.stats.parentTokenCount || 0,
              childTokenCount: initialData.stats.childTokenCount || 0,
              totalKeywords:
                initialData.stats.totalKeywords ||
                (initialData.stats.ungroupedCount +
                  initialData.stats.groupedKeywordsCount +
                  (initialData.stats.confirmedKeywordsCount || 0) +
                  initialData.stats.blockedCount),
            },
          });
          dispatch(setProjectStats({
            projectId: projectIdStr,
            stats: initialData.stats
          }));
        }
        
        if (initialData.currentView?.keywords) {
          const transformedKeywords = (initialData.currentView.keywords as Keyword[]).map((kw) => ({
            ...kw,
            project_id: projectIdNum,
            keyword: kw.keyword ?? '',
            tokens: Array.isArray(kw.tokens) ? kw.tokens : [],
            volume: typeof kw.volume === 'number' ? kw.volume : 0,
            length: typeof kw.length === 'number' ? kw.length : (kw.keyword ?? '').length,
            difficulty: typeof kw.difficulty === 'number' ? kw.difficulty : 0,
            rating: typeof kw.rating === 'number' ? kw.rating : undefined,
            isParent: !!kw.isParent,
            groupId: typeof kw.groupId === 'string' ? kw.groupId : null,
            groupName: typeof kw.groupName === 'string' ? kw.groupName : null,
            status: normalizeKeywordStatus(kw.status, activeView),
            childCount: typeof kw.childCount === 'number' ? kw.childCount : 0,
            serpFeatures: Array.isArray(kw.serpFeatures) ? kw.serpFeatures : [],
          }));
          
          dispatch(setKeywordsForView({
            projectId: projectIdStr,
            view: activeView,
            keywords: transformedKeywords,
            totalCount: initialData.pagination?.total
          }));
        }
        if (initialData.pagination) {
          detailDispatch({
            type: 'updatePagination',
            payload: { pagination: initialData.pagination },
          });
        }
        if (initialData.processingStatus?.status) {
          const processingStatus = initialData.processingStatus as {
            status?: ProcessingStatus;
            locked?: boolean;
            progress?: number;
            message?: string;
            currentFileName?: string | null;
            queuedFiles?: string[];
            uploadedFileCount?: number;
            processedFileCount?: number;
            uploadedFiles?: string[];
            processedFiles?: string[];
            fileErrors?: ProcessingFileError[];
            queuedJobs?: number;
            runningJobs?: number;
          };
          detailDispatch({
            type: 'updateProcessing',
            payload: {
              processingStatus: processingStatus.status ?? 'idle',
              processingProgress: processingStatus.progress || 0,
              processingMessage: processingStatus.message || '',
              processingCurrentFile: processingStatus.currentFileName ?? null,
              processingQueue: processingStatus.queuedFiles ?? [],
              processingQueuedJobs: processingStatus.queuedJobs ?? 0,
              processingRunningJobs: processingStatus.runningJobs ?? 0,
              processingFileErrors: processingStatus.fileErrors ?? [],
              uploadedFileCount: processingStatus.uploadedFileCount ?? 0,
              processedFileCount: processingStatus.processedFileCount ?? 0,
              uploadedFiles: processingStatus.uploadedFiles ?? [],
              processedFiles: processingStatus.processedFiles ?? [],
              processingLocked: Boolean(processingStatus.locked),
            },
          });
          if (
            initialData.processingStatus.status === 'uploading' ||
            initialData.processingStatus.status === 'combining' ||
            initialData.processingStatus.status === 'queued' ||
            initialData.processingStatus.status === 'processing'
          ) {
            startProcessingCheck();
          }
        }
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
      const errorMessage = isError(error) ? error.message : String(error);
      addSnackbarMessage('Error loading initial data: ' + errorMessage, 'error');
      fetchKeywords(1, pagination.limit, activeView, sortParams, filterParams);
    } finally {
      detailDispatch({
        type: 'updateProcessing',
        payload: { isLoadingData: false },
      });
    }
  }, [projectIdStr, pagination.limit, activeView, dispatch, projectIdNum, startProcessingCheck, addSnackbarMessage, fetchKeywords, sortParams, filterParams]);
  
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
    setCsvUploadsRefreshKey((prev) => prev + 1);
    startProcessingCheck();
    bumpLogsRefresh();
  }, [startProcessingCheck, bumpLogsRefresh]);  
  const handleUploadBatchStart = useCallback((files: File[]) => {
    detailDispatch({
      type: 'updateProcessing',
      payload: { processingQueue: files.map((file) => file.name) },
    });
    setCsvUploadsRefreshKey((prev) => prev + 1);
  }, [detailDispatch]);
  const handleUploadSuccess = useCallback(
    (status: ProcessingStatus, message?: string) => {
      detailDispatch({
        type: 'updateProcessing',
        payload: {
          processingStatus: status,
          processingMessage: message || '',
          processingFileErrors: [],
        },
      });
      setCsvUploadsRefreshKey((prev) => prev + 1);
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
        fetchKeywords(1, pagination.limit, activeView, sortParams, filterParams, true);
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
      fetchKeywords, pagination.limit, activeView, sortParams,
      filterParams, fetchProjectStats
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
      setCsvUploadsRefreshKey((prev) => prev + 1);
      addSnackbarMessage(message, 'error');
      stopProcessingCheck();
    },
    [addSnackbarMessage, stopProcessingCheck]
  );

  useEffect(() => {
    if (projectIdStr) {
      fetchInitialData();
      const initialPage = activeView !== prevActiveViewRef.current ? 1 : pagination.page;
      prevActiveViewRef.current = activeView;
      
      fetchKeywords(
        initialPage,
        pagination.limit,
        activeView,
        sortParams,
        filterParams,
        true
      );
      
      fetchProjectStats();
    }
    return () => {
      stopProcessingCheck();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [projectIdStr, activeView, fetchProjectStats, fetchInitialData, fetchKeywords, stopProcessingCheck, pagination.limit, sortParams, filterParams, pagination.page]);
  const { isAllSelected, isAnySelected } = useMemo(() => {
    const keywords = filteredAndSortedKeywords;
    const allFilteredIds = keywords.map(k => k.id);
    if (allFilteredIds.length === 0) return { isAllSelected: false, isAnySelected: false };
    const allSelected = allFilteredIds.every(id => selectedKeywordIds.has(id));
    const anySelected = allFilteredIds.some(id => selectedKeywordIds.has(id));
    return { isAllSelected: allSelected, isAnySelected: anySelected };
  }, [filteredAndSortedKeywords, selectedKeywordIds]);
  const selectedParentKeywordCount = useMemo(() => {
    if (activeView !== 'grouped' || selectedKeywordIds.size === 0) return 0;
    const parentIds = new Set(
      filteredAndSortedKeywords.filter(keyword => keyword.isParent).map(keyword => keyword.id)
    );
    return Array.from(selectedKeywordIds).filter(id => parentIds.has(id)).length;
  }, [activeView, filteredAndSortedKeywords, selectedKeywordIds]);

  const getTokensFromKeywords = useCallback(() => {
    const keywords = getCurrentViewData();
    const tokenMap = new Map<string, { volume: number; difficulty: number; count: number }>();
  
    keywords.forEach(kw => {
      if (kw.tokens && Array.isArray(kw.tokens)) {
        kw.tokens.forEach((token: string) => {
          const existing = tokenMap.get(token) || { volume: 0, difficulty: 0, count: 0 };
          tokenMap.set(token, {
            volume: existing.volume + (kw.volume || 0),
            difficulty: existing.difficulty + (kw.difficulty || 0),
            count: existing.count + 1,
          });
        });
      }
    });
  
    return Array.from(tokenMap.entries()).map(([tokenName, data]) => ({
      tokenName,
      tokens: [tokenName],
      volume: data.volume,
      difficulty: data.count > 0 ? Math.round(data.difficulty / data.count) : 0,
      count: data.count.toString(),
    }));
  }, [getCurrentViewData]);
  const handleMinVolumeChange = useCallback(
    (value: string) => {
      detailDispatch({
        type: 'updateFilters',
        payload: { minVolume: value },
      });
      const debouncedFetch = debounce(() => {
        detailDispatch({
          type: 'updatePagination',
          payload: { pagination: { ...pagination, page: 1 } },
        });
        fetchKeywords(
          pagination.page,
          pagination.limit,
          activeView,
          sortParams,
          { ...filterParams, minVolume: value ? parseInt(value) : "" }
        );
      }, 500);
  
      debouncedFetch();
    },
    [fetchKeywords, pagination, activeView, sortParams, filterParams]
  );
  
  const handleMaxVolumeChange = useCallback(
    (value: string) => {
      detailDispatch({
        type: 'updateFilters',
        payload: { maxVolume: value },
      });
      if (value && !minVolume) {
        detailDispatch({
          type: 'updateFilters',
          payload: { minVolume: '0' },
        });
      }
      const debouncedFetch = debounce(() => {
        detailDispatch({
          type: 'updatePagination',
          payload: { pagination: { ...pagination, page: 1 } },
        });
        fetchKeywords(
          pagination.page,
          pagination.limit,
          activeView,
          sortParams,
          {
            ...filterParams,
            minVolume: minVolume ? parseInt(minVolume) : (value ? 0 : ""),
            maxVolume: value ? parseInt(value) : "",
          }
        );
      }, 500);
  
      debouncedFetch();
    },
    [minVolume, fetchKeywords, pagination, activeView, sortParams, filterParams]
  );


  
  const handleMinDifficultyChange = useCallback(
    (value: string) => {
      detailDispatch({
        type: 'updateFilters',
        payload: { minDifficulty: value },
      });
      if (value && !minDifficulty) {
        detailDispatch({
          type: 'updateFilters',
          payload: { minDifficulty: '0' },
        });
      }
      const debouncedFetch = debounce(() => {
        detailDispatch({
          type: 'updatePagination',
          payload: { pagination: { ...pagination, page: 1 } },
        });
        fetchKeywords(
          pagination.page,
          pagination.limit,
          activeView,
          sortParams,
          {
            ...filterParams,
            minDifficulty: minDifficulty ? parseFloat(minDifficulty) : (value ? 0 : ""),
          }
        );
      }, 500);
  
      debouncedFetch();
    },
    [minDifficulty, fetchKeywords, pagination, activeView, sortParams, filterParams]
  );
  
  const handleMaxDifficultyChange = useCallback(
    (value: string) => {
      detailDispatch({
        type: 'updateFilters',
        payload: { maxDifficulty: value },
      });
      const debouncedFetch = debounce(() => {
        detailDispatch({
          type: 'updatePagination',
          payload: { pagination: { ...pagination, page: 1 } },
        });
        fetchKeywords(
          pagination.page,
          pagination.limit,
          activeView,
          sortParams,
          {
            ...filterParams,
            maxDifficulty: value ? parseFloat(value) : "",
          }
        );
      }, 500);
  
      debouncedFetch();
    },
    [fetchKeywords, pagination, activeView, sortParams, filterParams]
  );
    const handleMinRatingChange = useCallback(
    (value: string) => {
      detailDispatch({
        type: 'updateFilters',
        payload: { minRating: value },
      });
      const debouncedFetch = debounce(() => {
        detailDispatch({
          type: 'updatePagination',
          payload: { pagination: { ...pagination, page: 1 } },
        });
        fetchKeywords(
          pagination.page,
          pagination.limit,
          activeView,
          sortParams,
          {
            ...filterParams,
            minRating: value ? parseInt(value) : "",
          }
        );
      }, 500);
  
      debouncedFetch();
    },
    [fetchKeywords, pagination, activeView, sortParams, filterParams]
  );
  
  const handleMaxRatingChange = useCallback(
    (value: string) => {
      detailDispatch({
        type: 'updateFilters',
        payload: { maxRating: value },
      });
      if (value && !minRating) {
        detailDispatch({
          type: 'updateFilters',
          payload: { minRating: '0' },
        });
      }
      const debouncedFetch = debounce(() => {
        detailDispatch({
          type: 'updatePagination',
          payload: { pagination: { ...pagination, page: 1 } },
        });
        fetchKeywords(
          pagination.page,
          pagination.limit,
          activeView,
          sortParams,
          {
            ...filterParams,
            minRating: minRating ? parseInt(minRating) : (value ? 0 : ""),
            maxRating: value ? parseInt(value) : "",
          }
        );
      }, 500);
  
      debouncedFetch();
    },
    [minRating, fetchKeywords, pagination, activeView, sortParams, filterParams]
  );

  const handleMinLengthChange = useCallback(
    (value: string) => {
      detailDispatch({
        type: 'updateFilters',
        payload: { minLength: value },
      });
      const debouncedFetch = debounce(() => {
        detailDispatch({
          type: 'updatePagination',
          payload: { pagination: { ...pagination, page: 1 } },
        });
        fetchKeywords(
          pagination.page,
          pagination.limit,
          activeView,
          sortParams,
          {
            ...filterParams,
            minLength: value ? parseInt(value) : "",
          }
        );
      }, 500);
  
      debouncedFetch();
    },
    [fetchKeywords, pagination, activeView, sortParams, filterParams]
  );
  
  const handleMaxLengthChange = useCallback(
    (value: string) => {
      detailDispatch({
        type: 'updateFilters',
        payload: { maxLength: value },
      });
      const debouncedFetch = debounce(() => {
        detailDispatch({
          type: 'updatePagination',
          payload: { pagination: { ...pagination, page: 1 } },
        });
        fetchKeywords(
          pagination.page,
          pagination.limit,
          activeView,
          sortParams,
          {
            ...filterParams,
            maxLength: value ? parseInt(value) : "",
          }
        );
      }, 500);
  
      debouncedFetch();
    },
    [fetchKeywords, pagination, activeView, sortParams, filterParams]
  );

  const handleSerpFilterChange = useCallback((features: string[]) => {
    if (
      features.length !== selectedSerpFeatures.length || 
      features.some(f => !selectedSerpFeatures.includes(f))
    ) {
      detailDispatch({
        type: 'updateFilters',
        payload: { selectedSerpFeatures: features },
      });
      detailDispatch({
        type: 'updatePagination',
        payload: { pagination: { ...pagination, page: 1 } },
      });
      fetchKeywords(
        1,
        pagination.limit,
        activeView,
        sortParams,
        { ...filterParams, serpFeatures: features },
        true
      );
    }
  }, [
    fetchKeywords, 
    pagination, 
    activeView, 
    sortParams, 
    selectedSerpFeatures,
    filterParams
  ]);

  const handleTokenDataChange = useCallback(async () => {
    apiCache.invalidate(projectIdStr + '-stats');
    await Promise.all([
      fetchKeywords(
        pagination.page,
        pagination.limit,
        activeView,
        sortParams,
        filterParams,
        true
      ),
      fetchProjectStats(),
    ]);
  }, [fetchKeywords, pagination, activeView, sortParams, filterParams, fetchProjectStats, apiCache, projectIdStr]);
  if (!projectIdStr) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <p className="text-red-300">Invalid Project ID.</p>
      </div>
    );
  }

  const totalChildKeywords =
    stats.totalChildKeywords > 0
      ? stats.totalChildKeywords
      : Math.max(0, stats.totalKeywords - stats.totalParentKeywords);

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-x-hidden">
      <Header projectName={project?.name} />
      <ProjectDetailToolbar
        activeView={activeView}
        onExportParentKeywords={handleExportParentKeywords}
        onImportParentKeywords={handleImportParentKeywords}
        onExportCSV={handleExportCSV}
      />
      <div className="flex-1 w-full">
        <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col xl:flex-row gap-4">
            <main className="w-full xl:basis-4/5 xl:flex-[4] min-w-0 flex flex-col">
              <div className="bg-white shadow border border-border rounded-lg p-4 sm:p-6 flex flex-col flex-grow h-full">
                <ProjectDetailTabs
                  activeTab={activeTab}
                  processingLocked={processingLocked}
                  onTabChange={setActiveTab}
                />
                {activeTab === 'overview' && (
                  <ProjectDetailOverview
                    projectId={projectIdStr}
                    stats={stats}
                    totalChildKeywords={totalChildKeywords}
                    isUploading={isUploading}
                    processingStatus={processingStatus}
                    processingMessage={processingMessage}
                    processingStage={processingStage}
                    processingStageDetail={processingStageDetail}
                    displayProgress={displayProgress}
                    processingCurrentFile={processingCurrentFile}
                    processingQueue={processingQueue}
                    processingSucceededJobs={processingSucceededJobs}
                    processingFailedJobs={processingFailedJobs}
                    processingFileErrors={processingFileErrors}
                    csvUploadsRefreshKey={csvUploadsRefreshKey}
                    uploadedFiles={uploadedFiles}
                    processedFiles={processedFiles}
                    onUploadStart={handleUploadStart}
                    onUploadBatchStart={handleUploadBatchStart}
                    onUploadSuccess={handleUploadSuccess}
                    onUploadError={handleUploadError}
                  />
                )}
                {activeTab === 'group' && (
                  <>
                    <FiltersSection
                      projectIdStr={projectIdStr}
                      includeFilter={includeFilter}
                      excludeFilter={excludeFilter}
                      groupName={groupName}
                      activeView={activeView}
                      selectedKeywordIds={selectedKeywordIds}
                      isProcessingAction={isProcessingAction}
                      isUploading={isUploading}
                      processingLocked={processingLocked}
                      processingStatus={processingStatus}
                      processingMessage={processingMessage}
                      selectedTokens={selectedTokens}
                      handleIncludeFilterChange={handleIncludeFilterChange}
                      handleExcludeFilterChange={handleExcludeFilterChange}
                      setGroupName={setGroupName}
                      handleGroupKeywords={handleGroupKeywords}
                      handleUngroupKeywords={handleUngroupKeywords}
                      handleUnblockKeywords={handleUnblockKeywords}
                      removeToken={removeToken}
                      handleClearAllFilters={clearAllFilters}
                      setIncludeMatchType={setIncludeMatchType}
                      setExcludeMatchType={setExcludeMatchType}
                      includeMatchType={includeMatchType}
                      excludeMatchType={excludeMatchType}
                      handleConfirmKeywords={handleConfirmKeywords}
                      handleUnconfirmKeywords={handleUnconfirmKeywords}
                    />
                    <MainContent
                      viewState={{
                        activeView,
                        stats,
                        selectedParentKeywordCount,
                      }}
                      tableState={{
                        keywordsToDisplay: formatDataForDisplay,
                        pagination,
                        isLoadingData,
                        isTableLoading,
                        loadingChildren,
                        expandedGroups,
                        selectedKeywordIds,
                        selectedTokens,
                        sortParams,
                        isAllSelected,
                        isAnySelected,
                        projectIdStr,
                      }}
                      filterValues={{
                        minVolume,
                        maxVolume,
                        minLength,
                        maxLength,
                        minRating,
                        maxRating,
                        minDifficulty,
                        maxDifficulty,
                      }}
                      filterHandlers={{
                        onMinVolumeChange: handleMinVolumeChange,
                        onMaxVolumeChange: handleMaxVolumeChange,
                        onMinLengthChange: handleMinLengthChange,
                        onMaxLengthChange: handleMaxLengthChange,
                        onMinDifficultyChange: handleMinDifficultyChange,
                        onMaxDifficultyChange: handleMaxDifficultyChange,
                        onMinRatingChange: handleMinRatingChange,
                        onMaxRatingChange: handleMaxRatingChange,
                      }}
                      tableHandlers={{
                        onViewChange: handleViewChange,
                        onPageChange: handlePageChange,
                        onLimitChange: handleLimitChange,
                        onSort: handleSort,
                        onSelectAllClick: handleSelectAllClick,
                        onMiddleClickGroup: handleMiddleClickGroup,
                        toggleGroupExpansion,
                        toggleKeywordSelection,
                        toggleTokenSelection: handleAdvancedTokenSelection,
                        removeToken,
                      }}
                      serpFilters={{
                        onSerpFilterChange: handleSerpFilterChange,
                      }}
                    />
                  </>
                )}
                {activeTab === 'process' && (
                  <ProjectDetailProcess />
                )}
                {activeTab === 'notes' && (
                  <div className="w-full">
                    <div className="bg-white border border-border rounded-lg p-4">
                      <TextAreaInputs projectId={projectIdStr} />
                    </div>
                  </div>
                )}
                {activeTab === 'logs' && (
                  <ProjectDetailLogs
                    projectId={projectIdStr}
                    isActive={activeTab === 'logs'}
                    refreshKey={logsRefreshKey}
                  />
                )}
              </div>
            </main>
            <aside className="w-full xl:basis-1/5 xl:flex-[1] xl:min-w-[320px] xl:max-w-[420px] flex flex-col">
              <div className="bg-white shadow border border-border rounded-lg p-4 flex flex-col flex-grow h-full overflow-hidden">
                <TokenManagement
                  projectId={projectIdStr}
                  onBlockTokenSuccess={async () => {
                    await Promise.all([
                      fetchKeywords(
                        pagination.page,
                        pagination.limit,
                        activeView,
                        sortParams,
                        filterParams,
                        true
                      ),
                      fetchProjectStats()
                    ]);
                    bumpLogsRefresh();
                  }}
                  onUnblockTokenSuccess={async () => {
                    await Promise.all([
                      fetchKeywords(
                        pagination.page,
                        pagination.limit,
                        activeView,
                        sortParams,
                        filterParams,
                        true
                      ),
                      fetchProjectStats()
                    ]);
                    bumpLogsRefresh();
                  }}
                  addSnackbarMessage={addSnackbarMessage}
                  onTokenDataChange={handleTokenDataChange}
                  activeViewKeywords={getTokensFromKeywords()}
                  toggleTokenSelection={toggleTokenSelection}
                  activeView={activeView as "ungrouped" | "grouped" | "blocked"}
                />
              </div>
            </aside>
          </div>
        </div>
      </div>
      <Snackbar messages={snackbarMessages} onClose={removeSnackbarMessage} />      
    </div>
  );
}
