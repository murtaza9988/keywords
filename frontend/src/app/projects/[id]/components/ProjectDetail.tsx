/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store/store';
import { setKeywordsForView, setChildrenForGroup, setProjectStats } from '@/store/projectSlice';
import apiClient from '@/lib/apiClient';
import { Header } from './Header';
import { FiltersSection } from './FiltersSection';
import { MainContent } from './MainContent';
import { Snackbar } from './Snackbar';
import { TokenManagement } from './token/TokenManagement';
import {TextAreaInputs} from './TextAreaInputs'; 
import FileUploader from './FileUploader';
import CSVUploadDropdown from './CSVUploadDropdown';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Loader2 } from 'lucide-react';
import {
  ProcessingStatus, ActiveKeywordView, SnackbarMessage, SortParams,
  Keyword, PaginationInfo
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

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: { immediate?: boolean } = {}
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime: number | null = null;
  
  return function(this: any, ...args: Parameters<T>): void {
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
class ApiCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
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

    return entry.data;
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
   const pattern = `${projectId}-${view}`;
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


export default function ProjectDetail() {
  const params = useParams();
  const projectIdNum = Number(params?.id);
  const projectIdStr = params?.id ? String(params.id) : '';
  const dispatch: AppDispatch = useDispatch();
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
  const [activeView, setActiveView] = useState<ActiveKeywordView>('ungrouped');
  const [activeTab, setActiveTab] = useState<'overview' | 'group' | 'logs'>('group');
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [includeFilter, setIncludeFilter] = useState('');
  const [excludeFilter, setExcludeFilter] = useState('');
  const [includeMatchType, setIncludeMatchType] = useState<'any' | 'all'>('any');
  const [excludeMatchType, setExcludeMatchType] = useState<'any' | 'all'>('any');
  const [stats, setStats] = useState({
    ungroupedCount: 0,
    groupedKeywordsCount: 0,
    confirmedKeywordsCount: 0,
    confirmedPages: 0,
    groupedPages: 0,
    blockedCount: 0,
    totalKeywords: 0,
    totalParentKeywords: 0,
  });
  const [sortParams, setSortParams] = useState<SortParams>({
    column: 'volume',
    direction: 'desc'
  });
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 250,
    pages: 0
  });
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loadingChildren, setLoadingChildren] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState<string>('');
  const [isTableLoading, setIsTableLoading] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [, setUploadSuccess] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [snackbarMessages, setSnackbarMessages] = useState<SnackbarMessage[]>([]);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const prevActiveViewRef = useRef(activeView);
  const [displayProgress, setDisplayProgress] = useState<number>(0);
  const targetProgressRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const [minVolume, setMinVolume] = useState<string>('');
  const [maxVolume, setMaxVolume] = useState<string>('');
  const [minLength, setMinLength] = useState<string>('');
  const [maxLength, setMaxLength] = useState<string>('');
  const [minDifficulty, setMinDifficulty] = useState<string>('');
  const [maxDifficulty, setMaxDifficulty] = useState<string>('');
  const [minRating, setMinRating] = useState<string>('');
  const [maxRating, setMaxRating] = useState<string>('');
  const [isExportingParent, setIsExportingParent] = useState<boolean>(false);
  const [isImportingParent, setIsImportingParent] = useState<boolean>(false);

  const [selectedSerpFeatures, setSelectedSerpFeatures] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const addSnackbarMessage = useCallback((
    text: string,
    type: 'success' | 'error' | 'info',
    options?: { description?: string; stage?: ProcessingStatus }
  ) => {
    const id = Date.now();
    setSnackbarMessages(prev => [
      ...prev,
      {
        id,
        text,
        type,
        description: options?.description,
        stage: options?.stage
      }
    ]);
    setTimeout(() => {
      setSnackbarMessages(prev => prev.filter(msg => msg.id !== id));
    }, 3000);
  }, []);

  const removeSnackbarMessage = useCallback((id: number) => {
    setSnackbarMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  useEffect(() => {
    targetProgressRef.current = processingProgress;
    
    const animateProgress = () => {
      setDisplayProgress(prev => {
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

  const getCurrentViewData = useCallback(() => {
    let data: any[] = [];
    
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
      const groupsMap = new Map();
      
      data.forEach(keyword => {
        if (keyword.isParent && keyword.groupId) {
          groupsMap.set(keyword.groupId, keyword);
        }
      });
      
      data.forEach(keyword => {
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
    const statsData = await apiClient.fetchSingleProjectStats(projectIdStr);
    setStats({
      ungroupedCount: statsData.ungroupedCount || 0,
      groupedKeywordsCount: statsData.groupedKeywordsCount || 0,
      groupedPages: statsData.groupedPages || 0,
      confirmedKeywordsCount: statsData.confirmedKeywordsCount || 0,
      confirmedPages: statsData.confirmedPages || 0,               
      blockedCount: statsData.blockedCount || 0,
      totalParentKeywords: statsData.totalParentKeywords || 0,
      totalKeywords: statsData.totalKeywords || 
        (statsData.ungroupedCount + statsData.groupedKeywordsCount + 
         statsData.confirmedKeywordsCount + statsData.blockedCount),
    });
  } catch (error) {
    console.error('Error fetching project stats:', error);
    addSnackbarMessage(`Error fetching stats: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
  }
}, [projectIdStr, addSnackbarMessage]);
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
    filters = { 
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
    },
    forceRefresh = false
  ) => {
    if (!projectIdStr) return;
    setIsTableLoading(true);
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

      const cacheKey = `${projectIdStr}-${view}-${page}-${limit}-${JSON.stringify(filters)}`;
      const totalCountKey = `${projectIdStr}-${view}-total-${JSON.stringify(filters)}`;
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
        
        setPagination(prev => ({
          total: cachedTotalCount,
          page: validPage,
          limit: limit,
          pages: totalPages
        }));
        
        setIsTableLoading(false);
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
        const largeData = await apiClient.fetchKeywords(projectIdStr, largeQueryParams, true);
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

        setPagination(prev => ({
          total: totalItems,
          page: validPage,
          limit: limit,
          pages: totalPages
        }));
        
        setIsTableLoading(false);
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
      const data = await apiClient.fetchKeywords(projectIdStr, queryParams, false);
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
      setPagination(prev => ({
        total: totalItems,
        page: validPage,
        limit: limit,
        pages: totalPages
      }));
    } catch (error) {
      console.error('Error fetching keywords:', error);
      addSnackbarMessage(`Error loading keywords: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsTableLoading(false);
    }
  }, [
    projectIdStr, 
    minVolume, 
    maxVolume, 
    minLength,
    maxLength,
    minDifficulty, 
    maxDifficulty, 
    minRating,
    maxRating,
    pagination.page, 
    pagination.limit, 
    activeView, 
    sortParams, 
    selectedTokens, 
    includeFilter, 
    excludeFilter, 
    includeMatchType, 
    excludeMatchType, 
    selectedSerpFeatures,
    projectIdNum, 
    dispatch, 
    addSnackbarMessage, 
    apiCache
  ]);

const getSerpFeatures = (keyword: any): string[] => {
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
              const data = await apiClient.fetchChildren(projectIdStr, groupId);
      return data.children;
    } catch (error) {
      console.error('Error fetching children:', error);
      addSnackbarMessage(`Error loading children: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
      return [];
    }
  }, [projectIdStr, addSnackbarMessage]);

  const handleExportCSV = useCallback(async () => {
    if (activeView !== 'grouped' && activeView !== 'confirmed') return;

    setIsExporting(true);
    addSnackbarMessage('Starting export, please wait...', 'success');

    try {
              const blobData = await apiClient.exportGroupedKeywords(projectIdStr, activeView);
      const url = window.URL.createObjectURL(blobData);
      const link = document.createElement('a');
      link.href = url;
      const viewType = activeView === 'grouped' ? 'grouped' : 'confirmed';
      const filename = `${viewType}_keywords_${projectIdStr}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      addSnackbarMessage('CSV exported successfully', 'success');
    } catch (error) {
      console.error('Error during export:', error);
      addSnackbarMessage(`Error exporting CSV: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsExporting(false);
    }
  }, [activeView, projectIdStr, addSnackbarMessage]);

  const handleExportParentKeywords = useCallback(async () => {

    setIsExportingParent(true);
    addSnackbarMessage('Starting parent keywords export, please wait...', 'success');

    try {
      const blobData = await apiClient.exportParentKeywords(projectIdStr);
      const url = window.URL.createObjectURL(blobData);
      const link = document.createElement('a');
      link.href = url;
      const filename = `parent_keywords_${projectIdStr}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      addSnackbarMessage('Parent keywords CSV exported successfully', 'success');
    } catch (error) {
      console.error('Error during parent export:', error);
      addSnackbarMessage(`Error exporting parent keywords: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsExportingParent(false);
    }
  }, [projectIdStr, addSnackbarMessage]);
  const handleImportParentKeywords = useCallback(async (file: File) => {

    setIsImportingParent(true);
    addSnackbarMessage('Starting parent keywords import, please wait...', 'success');

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      await apiClient.importParentKeywords(projectIdStr, formData);
      addSnackbarMessage('Parent keywords imported successfully', 'success');
      
      await fetchKeywords(pagination.page, pagination.limit, activeView, sortParams, {
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
        serpFeatures: selectedSerpFeatures
      }, true);
    } catch (error) {
      console.error('Error during parent import:', error);
      addSnackbarMessage(`Error importing parent keywords: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsImportingParent(false);
    }
  }, [projectIdStr, addSnackbarMessage, fetchKeywords, pagination, activeView, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, minRating, maxRating, selectedSerpFeatures]);

const handleViewChange = useCallback((newView: ActiveKeywordView) => {
  if (activeView !== newView) {
    setActiveView(newView);
    setSelectedKeywordIds(new Set());
    setExpandedGroups(new Set());
    setPagination(prev => ({ ...prev, page: 1 }));
    apiCache.invalidateByView(projectIdStr, newView);
    fetchKeywords(1, pagination.limit, newView, sortParams, {
      tokens: selectedTokens,
      include: includeFilter,
      exclude: excludeFilter,
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
  }
}, [
  activeView, pagination.limit, sortParams, selectedTokens, 
  includeFilter, excludeFilter, fetchKeywords, projectIdStr, apiCache
]);

const handlePageChange = useCallback((newPage: number) => {
  if (newPage < 1 || newPage === pagination.page || newPage > pagination.pages || isLoadingData) return;
  setPagination(prev => ({ ...prev, page: newPage }));
  fetchKeywords(newPage, pagination.limit, activeView, sortParams, {
    tokens: selectedTokens,
    include: includeFilter,
    exclude: excludeFilter,
    minVolume: minVolume ? parseInt(minVolume) : "",
    maxVolume: maxVolume ? parseInt(maxVolume) : "",
    minLength: minLength ? parseInt(minLength) : "",
    maxLength: maxLength ? parseInt(maxLength) : "",
    minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
    maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
    serpFeatures: selectedSerpFeatures,
    minRating: minRating ? parseInt(minRating) : "",
    maxRating: maxRating ? parseInt(maxRating) : "",
  }, false);
}, [pagination.page, pagination.pages, pagination.limit, isLoadingData, fetchKeywords, activeView, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating]);
const handleLimitChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
  const newLimit = parseInt(event.target.value, 10);
  if (!isNaN(newLimit) && newLimit !== pagination.limit) {
    setPagination(prev => ({
      ...prev,
      limit: newLimit,
      page: 1
    }));
    fetchKeywords(1, newLimit, activeView, sortParams, {
      tokens: selectedTokens,
      include: includeFilter,
      exclude: excludeFilter,
      minVolume: minVolume ? parseInt(minVolume) : "",
      maxVolume: maxVolume ? parseInt(maxVolume) : "",
      minLength: minLength ? parseInt(minLength) : "",
      maxLength: maxLength ? parseInt(maxLength) : "",
      minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
      maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
      serpFeatures: selectedSerpFeatures,
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : "",
    }, true);
  }
}, [pagination.limit, fetchKeywords, activeView, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating]);
const handleSort = useCallback((column: string) => {
  if (column === 'tokens' || column === 'serpFeatures') return;
  const newDirection: 'asc' | 'desc' = sortParams.column === column && sortParams.direction === 'asc' ? 'desc' : 'asc';
  const newSortParams: SortParams = { column, direction: newDirection };
  setSortParams(newSortParams);
  setPagination(prev => ({ ...prev, page: 1 }));
  fetchKeywords(pagination.page, pagination.limit, activeView, newSortParams, {
    tokens: selectedTokens,
    include: includeFilter,
    exclude: excludeFilter,
    minVolume: minVolume ? parseInt(minVolume) : "",
    maxVolume: maxVolume ? parseInt(maxVolume) : "",
    minLength: minLength ? parseInt(minLength) : "",
    maxLength: maxLength ? parseInt(maxLength) : "",
    minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
    maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
    serpFeatures: selectedSerpFeatures,
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : "",
  });
}, [sortParams.column, sortParams.direction, fetchKeywords, pagination.page, pagination.limit, activeView, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating]);

const filteredAndSortedKeywords = useMemo(() => {
  return getCurrentViewData();
}, [getCurrentViewData]);

const formatDataForDisplay = useMemo(() => {
  const keywords = getCurrentViewData();
  
  return keywords.map(parent => {
    let children: any[] = [];
    
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
      key: `${activeView}-${parent.id}-${parent.groupId || 'nogroup'}`
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
  setSelectedKeywordIds(prevSelected => {
    const newSelected = new Set(prevSelected);
    const allFilteredIds = filteredAndSortedKeywords.map(k => k.id);

    const toggleAsync = async () => {
      if (keywordId === -1) {
        // SELECT ALL - this is the only case where we auto-select children
        for (const id of allFilteredIds) {
          newSelected.add(id);
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
                    children.forEach(child => newSelected.add(child.id));
                  }
          }
        }
        const highestVolumeKeyword = filteredAndSortedKeywords.reduce((max, curr) => 
          (curr.volume || 0) > (max.volume || 0) ? curr : max,
          filteredAndSortedKeywords[0]
        );
        if (highestVolumeKeyword) {
          if (activeView === 'ungrouped') {
            setGroupName(highestVolumeKeyword.keyword);
          } else if (activeView === 'grouped') {
            // For grouped view, use parent keyword name if available
            if (highestVolumeKeyword.isParent) {
              setGroupName(highestVolumeKeyword.keyword);
            } else {
              const parentKeyword = filteredAndSortedKeywords.find(
                k => k.groupId === highestVolumeKeyword.groupId && k.isParent
              );
              setGroupName(parentKeyword ? parentKeyword.keyword : highestVolumeKeyword.keyword);
            }
          }
        }
      } else if (keywordId === 0) {
        newSelected.clear();
        setGroupName('');
      } else {
        const selectedKeyword = filteredAndSortedKeywords.find(k => k.id === keywordId) || 
          Object.values(childrenCache).flat().find(k => k.id === keywordId);

        if (newSelected.has(keywordId)) {
          newSelected.delete(keywordId);
          // NO AUTO-DESELECTION - only deselect what the user explicitly clicks
          if (newSelected.size === 0) {
            setGroupName('');
          }
        } else {
          newSelected.add(keywordId);
          // NO AUTO-SELECTION - only select what the user explicitly clicks
          
          const selectedKeywords = Array.from(newSelected).map(id => 
            filteredAndSortedKeywords.find(k => k.id === id) || 
            Object.values(childrenCache).flat().find(k => k.id === id)
          ).filter(Boolean);
          
          const highestVolumeKeyword = selectedKeywords.reduce((max, curr) => 
            (curr && curr.volume && max && max.volume && curr.volume > max.volume) ? curr : max,
            selectedKeywords[0]
          );
          
          if (highestVolumeKeyword) {
            if (activeView === 'ungrouped') {
              setGroupName(highestVolumeKeyword.keyword);
            } else if (activeView === 'grouped') {
              // For grouped view, always use the parent keyword name if it's a parent
              if (highestVolumeKeyword.isParent) {
                setGroupName(highestVolumeKeyword.keyword);
              } else {
                // If it's a child, find its parent
                const parentKeyword = filteredAndSortedKeywords.find(
                  k => k.groupId === highestVolumeKeyword.groupId && k.isParent
                );
                setGroupName(parentKeyword ? parentKeyword.keyword : highestVolumeKeyword.keyword);
              }
            }
          }
        }
      }
    };

    toggleAsync().catch(err => {
      console.error('Error in toggleKeywordSelection:', err);
      addSnackbarMessage(`Error selecting keywords: ${isError(err) ? err.message : 'Unknown error'}`, 'error');
    });
    return newSelected;
  });
}, [filteredAndSortedKeywords, activeView, childrenCache, fetchChildren, dispatch, projectIdStr, addSnackbarMessage]);

  const handleSelectAllClick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    toggleKeywordSelection(isChecked ? -1 : 0).catch(err => {
      addSnackbarMessage(`Error selecting all: ${isError(err) ? err.message : 'Unknown error'}`, 'error');
    });
  }, [toggleKeywordSelection, addSnackbarMessage]);

  const toggleTokenSelection = useCallback((token: string) => {
    setSelectedTokens(prev => {
      const isCurrentlySelected = prev.includes(token);
      const newTokens = isCurrentlySelected
        ? prev.filter(t => t !== token)
        : [...prev, token];
      const currentPage = pagination.page;
      apiCache.invalidate(`${projectIdStr}-${activeView}`);
      fetchKeywords(currentPage, pagination.limit, activeView, sortParams, {
        tokens: newTokens,
        include: includeFilter,
        exclude: excludeFilter,
        minVolume: minVolume ? parseInt(minVolume) : "",
        maxVolume: maxVolume ? parseInt(maxVolume) : "",
        minLength: minLength ? parseInt(minLength) : "",
        maxLength: maxLength ? parseInt(maxLength) : "",
        minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
        maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
        serpFeatures: selectedSerpFeatures,
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : "",
      }, true);
      
      return newTokens;
    });
  }, [pagination.page, pagination.limit, apiCache, projectIdStr, activeView, fetchKeywords, sortParams, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating]);
  

  const handleAdvancedTokenSelection = useCallback(async (token: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (!projectIdStr) return;
      setIsProcessingAction(true);
      setIsTableLoading(true);
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
        const data = await apiClient.blockToken(projectIdStr, token);
        addSnackbarMessage(`Blockd ${data.count} keywords with token "${token}"`, 'success');
        apiCache.invalidate(`${projectIdStr}-${activeView}-total-`);
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
        
      } catch (error) {
        addSnackbarMessage(`Error blocking keywords: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
      } finally {
        setIsProcessingAction(false);
        setIsTableLoading(false);
      }
    } else {
      toggleTokenSelection(token);
    }
  }, [projectIdStr, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, pagination.page, pagination.limit, addSnackbarMessage, apiCache, activeView, fetchProjectStats, fetchKeywords, sortParams, minRating, maxRating, toggleTokenSelection]);


  const removeToken = useCallback((token: string) => {
    setSelectedTokens(prev => prev.filter(t => t !== token));
    const currentPage = pagination.page;
    apiCache.invalidate(`${projectIdStr}-${activeView}`);
    fetchKeywords(currentPage, pagination.limit, activeView, sortParams, {
      tokens: selectedTokens.filter(t => t !== token),
      include: includeFilter,
      exclude: excludeFilter,
      minVolume: minVolume ? parseInt(minVolume) : "",
      maxVolume: maxVolume ? parseInt(maxVolume) : "",
      minLength: minLength ? parseInt(minLength) : "",
      maxLength: maxLength ? parseInt(maxLength) : "",
      minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
      maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
      serpFeatures: selectedSerpFeatures,
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : "",
    }, true);
  }, [pagination.page, pagination.limit, apiCache, projectIdStr, activeView, fetchKeywords, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating]);
  const handleIncludeFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setIncludeFilter(newValue);
      const executeSearch = async () => {
        setPagination(prev => ({ ...prev, page: 1 }));
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
            setExpandedGroups(groupsToExpand);
          }
        } else if (!newValue) {
          setExpandedGroups(new Set());
        }
        
        await fetchKeywords(1, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: newValue,
          exclude: excludeFilter,
          minVolume: minVolume ? parseInt(minVolume) : "",
          maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
          serpFeatures: selectedSerpFeatures,
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : "",
        }, true);
      };
      
      executeSearch();
    },
    [activeView, fetchKeywords, pagination.limit, sortParams, selectedTokens, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating, childrenCache, includeMatchType]
  );
  const handleExcludeFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setExcludeFilter(newValue);
      const executeSearch = async () => {
        setPagination(prev => ({ ...prev, page: 1 }));
        await fetchKeywords(1, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: newValue,
          minVolume: minVolume ? parseInt(minVolume) : "",
          maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
          serpFeatures: selectedSerpFeatures,
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : "",
        }, true);
      };
      
      executeSearch();
    },
    [fetchKeywords, pagination.limit, activeView, sortParams, selectedTokens, includeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating]
  );
  const clearAllFilters = useCallback(() => {
    setSelectedTokens([]);
    setIncludeFilter('');
    setExcludeFilter('');
    setIncludeMatchType('any');
    setExcludeMatchType('any');
    setMinVolume('');
    setMaxVolume('');
    setMinDifficulty('');
    setMaxDifficulty('');
    setSelectedSerpFeatures([]);
    setPagination(prev => ({ ...prev, page: 1 }));
    apiCache.invalidate(`${projectIdStr}-${activeView}`);
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
    pagination.limit, 
    activeView, 
    sortParams,
    projectIdStr,
    apiCache
  ]);

   const toggleGroupExpansion = useCallback(async (groupId: string, hasChildren: boolean) => {
    if (!groupId || !hasChildren || !projectIdStr) return;
    const isCurrentlyExpanded = expandedGroups.has(groupId);
    if (isCurrentlyExpanded) {
      setExpandedGroups(prev => {
        const newSet = new Set(prev);
        newSet.delete(groupId);
        return newSet;
      });
    } else {
      setExpandedGroups(prev => new Set(prev).add(groupId));
      const groupData = childrenCache[groupId];
      
      setLoadingChildren(prevLoading => new Set(prevLoading).add(groupId));
      try {
        const children = await fetchChildren(groupId);
        dispatch(setChildrenForGroup({ projectId: projectIdStr, groupId, children }));
      } catch (err) {
        setExpandedGroups(expanded => { 
          const newSet = new Set(expanded); 
          newSet.delete(groupId); 
          return newSet; 
        });
        addSnackbarMessage(`Error loading children: ${isError(err) ? err.message : 'Unknown error'}`, 'error');
      } finally {
        setLoadingChildren(prevLoading => {
          const newSet = new Set(prevLoading);
          newSet.delete(groupId);
          return newSet;
        });
      }
    }
  }, [projectIdStr, childrenCache, dispatch, addSnackbarMessage, expandedGroups, fetchChildren]);

  const handleConfirmKeywords = useCallback(async () => {
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

    setIsProcessingAction(true);
    setIsTableLoading(true);

    try {
      dispatch(setKeywordsForView({
        projectId: projectIdStr,
        view: 'grouped',
        keywords: [],
      }));

      Object.keys(childrenCache).forEach(groupId => {
        dispatch(setChildrenForGroup({ projectId: projectIdStr, groupId, children: [] }));
      });

              const data = await apiClient.confirmKeywords(projectIdStr, keywordIds);
      addSnackbarMessage(`Confirmed ${data.count} keywords`, 'success');

      await Promise.all([
        fetchKeywords(maintainedPage, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: "",
          maxVolume: "",
          minLength: "",
          maxLength: "",
          minDifficulty: "",
          maxDifficulty: "",
          serpFeatures: [],
          minRating: '',
          maxRating: ''
        }, true),
        fetchProjectStats(),
      ]);

      setSelectedKeywordIds(new Set());
      setGroupName('');
      setExpandedGroups(new Set());
      
    } catch (error) {
      addSnackbarMessage(`Error confirming keywords: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsProcessingAction(false);
      setIsTableLoading(false);
    }
  }, [selectedKeywordIds, activeView, projectIdStr, addSnackbarMessage, dispatch, childrenCache, fetchKeywords, pagination.limit, pagination.total, pagination.page, sortParams, selectedTokens, includeFilter, excludeFilter, fetchProjectStats, calculateMaintainedPage]);

  const handleUnconfirmKeywords = useCallback(async () => {
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

    setIsProcessingAction(true);
    setIsTableLoading(true);

    try {
      dispatch(setKeywordsForView({
        projectId: projectIdStr,
        view: 'confirmed',
        keywords: [],
      }));

      Object.keys(childrenCache).forEach(groupId => {
        dispatch(setChildrenForGroup({ projectId: projectIdStr, groupId, children: [] }));
      });

              const data = await apiClient.unconfirmKeywords(projectIdStr, keywordIds);
      addSnackbarMessage(`Unconfirmed ${data.count} keywords`, 'success');

      await Promise.all([
        fetchKeywords(maintainedPage, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: "",
          maxVolume: "",
          minLength: "",
          maxLength: "",
          minDifficulty: "",
          maxDifficulty: "",
          serpFeatures: [],
          minRating: '',
          maxRating: ''
        }, true),
        fetchProjectStats(),
      ]);

      setSelectedKeywordIds(new Set());
      setGroupName('');
      setExpandedGroups(new Set());
      
    } catch (error) {
      addSnackbarMessage(`Error unconfirming keywords: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsProcessingAction(false);
      setIsTableLoading(false);
    }
  }, [selectedKeywordIds, activeView, projectIdStr, addSnackbarMessage, dispatch, childrenCache, fetchKeywords, pagination.limit, pagination.total, pagination.page, sortParams, selectedTokens, includeFilter, excludeFilter, fetchProjectStats, calculateMaintainedPage]);

  const handleGroupKeywords = useCallback(async (overrideGroupName?: string) => {
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

    setIsProcessingAction(true);
    setIsTableLoading(true);  
    
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
          data = await apiClient.regroupKeywords(projectIdStr, keywordIds, trimmedGroupName);
          
          if (selectedParents.length > 1) {
            messagePrefix = 'merged';
            addSnackbarMessage(`Successfully ${messagePrefix} ${selectedParents.length} groups into "${trimmedGroupName}"`, 'success');
          } else if (selectedParents.length === 1 && selectedChildren.length > 0) {
            messagePrefix = 'added';
            addSnackbarMessage(`Successfully ${messagePrefix} ${selectedChildren.length} keywords to "${trimmedGroupName}"`, 'success');
          } else {
            addSnackbarMessage(`Successfully ${messagePrefix} ${data.count} keywords as "${trimmedGroupName}"`, 'success');
          }
        } else {
          addSnackbarMessage('Unable to identify selected keywords for regrouping', 'error');
          setIsProcessingAction(false);
          setIsTableLoading(false);
          return;
        }
      } else {
        data = await apiClient.groupKeywords(projectIdStr, keywordIds, trimmedGroupName);
        addSnackbarMessage(`Successfully ${messagePrefix} ${data.count} keywords as "${trimmedGroupName}"`, 'success');
      }
      
      apiCache.clear();
    
      Object.keys(childrenCache).forEach(groupId => {
        dispatch(setChildrenForGroup({ projectId: projectIdStr, groupId, children: [] }));
      });
      
      setSelectedKeywordIds(new Set());
      setGroupName('');
      
      const refreshData = async () => {
        try {
          const statsData = await apiClient.fetchSingleProjectStats(projectIdStr);
          if (statsData) {
            setStats({
              ungroupedCount: statsData.ungroupedCount || 0,
              groupedKeywordsCount: statsData.groupedKeywordsCount || 0,
              confirmedKeywordsCount: statsData.confirmedKeywordsCount || 0,
              confirmedPages: statsData.confirmedPages || 0,
              groupedPages: statsData.groupedPages || 0,
              blockedCount: statsData.blockedCount || 0,
              totalParentKeywords: statsData.totalParentKeywords || 0,
              totalKeywords: statsData.totalKeywords ||
                (statsData.ungroupedCount + statsData.groupedKeywordsCount + (statsData.confirmedKeywordsCount || 0) + statsData.blockedCount),
            });
            
            dispatch(setProjectStats({
              projectId: projectIdStr,
              stats: statsData
            }));
          }
          
          await fetchKeywords(maintainedPage, pagination.limit, activeView, sortParams, {
            tokens: selectedTokens,
            include: includeFilter,
            exclude: excludeFilter,
            minVolume: minVolume ? parseInt(minVolume) : "",
            maxVolume: maxVolume ? parseInt(maxVolume) : "",
            minLength: minLength ? parseInt(minLength) : "",
            maxLength: maxLength ? parseInt(maxLength) : "",
            minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
            maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
            serpFeatures: [],
            minRating: minRating ? parseInt(minRating) : "",
            maxRating: maxRating ? parseInt(maxRating) : "",
          }, true); 
          
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
          addSnackbarMessage(`Error refreshing data: ${isError(err) ? err.message : 'Unknown error'}`, 'error');
        } finally {
          setIsProcessingAction(false);
          setIsTableLoading(false);
        }
      };
      
      refreshData();
      
    } catch (error) {
      console.error("Grouping error:", error);
      addSnackbarMessage(`Error grouping keywords: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
      setIsProcessingAction(false);
      setIsTableLoading(false);
    }
  }, [selectedKeywordIds, groupName, projectIdStr, calculateMaintainedPage, pagination.page, pagination.limit, pagination.total, addSnackbarMessage, activeView, apiCache, childrenCache, filteredAndSortedKeywords, dispatch, fetchKeywords, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, minRating, maxRating]);

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

        if ((window as any).__handlingShiftPress) return;
        (window as any).__handlingShiftPress = true;

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
            (window as any).__handlingShiftPress = false;
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

        if ((window as any).__handlingCtrlPress) return;
        (window as any).__handlingCtrlPress = true;

        try {
          blurActiveCheckboxes();

          if (activeView === 'grouped') {
            await handleConfirmKeywords();
          } else if (activeView === 'confirmed') {
            await handleUnconfirmKeywords();
          }
        } finally {
          setTimeout(() => {
            (window as any).__handlingCtrlPress = false;
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

    setIsProcessingAction(true);
    setIsTableLoading(true);
    
    try {
      dispatch(setKeywordsForView({
        projectId: projectIdStr,
        view: 'grouped',
        keywords: [],
      }));
      
      Object.keys(childrenCache).forEach(groupId => {
        dispatch(setChildrenForGroup({ projectId: projectIdStr, groupId, children: [] }));
      });
      
              const data = await apiClient.ungroupKeywords(projectIdStr, keywordIds);
      addSnackbarMessage(`Ungrouped ${data.count} keywords`, 'success');
      
      await Promise.all([
        fetchKeywords(maintainedPage, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: minVolume ? parseInt(minVolume) : "",
          maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
          serpFeatures: selectedSerpFeatures,
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : ""
        }, true),
        fetchProjectStats(),
      ]);
      
      setSelectedKeywordIds(new Set());
      setGroupName('');
      setExpandedGroups(new Set());
      
    } catch (error) {
      addSnackbarMessage(`Error ungrouping keywords: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsProcessingAction(false);
      setIsTableLoading(false);
    }
  }, [selectedKeywordIds, activeView, projectIdStr, addSnackbarMessage, dispatch, childrenCache, fetchKeywords, pagination.limit, pagination.total, pagination.page, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating, fetchProjectStats, calculateMaintainedPage]);

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

    setIsProcessingAction(true);
    setIsTableLoading(true);
    
    try {
              const data = await apiClient.unblockKeywords(projectIdStr, keywordIds);
      addSnackbarMessage(`Unblocked ${data.count} keywords`, 'success');
      
      await Promise.all([
        fetchKeywords(maintainedPage, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: minVolume ? parseInt(minVolume) : "",
          maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
          serpFeatures: selectedSerpFeatures,
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : ""
        }, true),
        fetchProjectStats(),
      ]);
      
      setSelectedKeywordIds(new Set());
    } catch (error) {
      addSnackbarMessage(`Error unblocking keywords: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsProcessingAction(false);
      setIsTableLoading(false);
    }
  }, [selectedKeywordIds, activeView, projectIdStr, addSnackbarMessage, fetchKeywords, pagination.limit, pagination.total, pagination.page, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating, fetchProjectStats, calculateMaintainedPage]);
    
    const handleMiddleClickGroup = useCallback(async (keywordIds: number[]) => {
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
      : `${keywordIds.length} keywords`;
  
    setIsProcessingAction(true);
    try {
              const data = await apiClient.groupKeywords(projectIdStr, keywordIds, trimmedGroupName);
      addSnackbarMessage(`Grouped ${keywordInfo} as "${trimmedGroupName}"`, 'success');
  
      await fetchKeywords(pagination.page, pagination.limit, activeView, sortParams, {
        tokens: selectedTokens,
        include: includeFilter,
        exclude: excludeFilter,
        minVolume: minVolume ? parseInt(minVolume) : "",
        maxVolume: maxVolume ? parseInt(maxVolume) : "",
        minLength: minLength ? parseInt(minLength) : "",
        maxLength: maxLength ? parseInt(maxLength) : "",
        minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
        maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
        serpFeatures: selectedSerpFeatures,
        minRating: minRating ? parseInt(minRating) : "",
        maxRating: maxRating ? parseInt(maxRating) : ""
      }, true);
      await fetchProjectStats();
      setSelectedKeywordIds(new Set());
    } catch (error) {
      addSnackbarMessage(`Error grouping keyword: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsProcessingAction(false);
    }
  }, [activeView, groupName, projectIdStr, ungroupedKeywords, addSnackbarMessage, setGroupName,
      fetchKeywords, pagination, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating, fetchProjectStats, 
      setSelectedKeywordIds, setIsProcessingAction]);
      
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

      if (data.status === 'complete') {
        setProcessingStatus('complete');
        setIsUploading(false);
        setUploadSuccess(true);
        stopProcessingCheck();
        addSnackbarMessage('Processing complete', 'success', {
          stage: 'complete',
          description: 'Your keywords are ready to review.'
        });
        fetchKeywords(1, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: minVolume ? parseInt(minVolume) : "",
          maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
          serpFeatures: selectedSerpFeatures,
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : ""
        }, true);
        
        fetchProjectStats();
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

      if ((data.status === 'queued' || data.status === 'processing') && 
          data.keywords && data.keywords.length > 0) {
        const keywords = data.keywords.map(kw => {
          let parsedTokens = [];
          try {
            if (typeof kw.tokens === 'string') {
              parsedTokens = JSON.parse(kw.tokens);
            } else if (Array.isArray(kw.tokens)) {
              parsedTokens = kw.tokens;
            }
          } catch (err) {
            console.warn(`Failed to parse tokens for keyword: ${kw.keyword}`, err);
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
            status: kw.status || 'ungrouped',
            childCount: kw.child_count || 0,
            original_volume: kw.original_volume || kw.volume || 0,
            serpFeatures: kw.serpFeatures || {},
            length: (kw.keyword || '').length
          };
        });
        
        dispatch(setKeywordsForView({
          projectId: projectIdStr,
          view: 'ungrouped',
          keywords: keywords.map(kw => ({
            ...kw,
            original_volume: kw.volume || 0,
            project_id: projectIdNum,
            status: 'ungrouped',
            groupName: kw.keyword || '',
            serpFeatures: kw.serpFeatures || {},
            length: (kw.keyword || '').length
          })),
        }));
      }
    } catch (error) {
      console.error('Error checking processing status:', error);
      addSnackbarMessage(`Error checking status: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
      setIsUploading(false);
      stopProcessingCheck();
      setProcessingStatus('error');
      setProcessingProgress(0);
    }
  }, [
    projectIdStr, processingStatus, stopProcessingCheck, 
    fetchKeywords, pagination.limit, activeView, sortParams, 
    selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating, addSnackbarMessage, 
    dispatch, projectIdNum, fetchProjectStats
  ]);

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
  
  const fetchInitialData = useCallback(async () => {
    if (!projectIdStr) return;
  
    setIsLoadingData(true);
    try {
      const queryParams = new URLSearchParams({
        page: '1',
        limit: pagination.limit.toString(),
        status: activeView
      });
      
              const initialData = await apiClient.fetchInitialData(`${projectIdStr}?${queryParams.toString()}`);
      
      if (initialData) {
        if (initialData.stats) {
          dispatch(setProjectStats({
            projectId: projectIdStr,
            stats: initialData.stats
          }));
        }
        
        if (initialData.currentView?.keywords) {
          const transformedKeywords = initialData.currentView.keywords.map((kw: { original_volume: any; volume: any; status: any; keyword: any; }) => ({
            ...kw,
            original_volume: kw.original_volume || kw.volume || 0,
            project_id: projectIdNum,
            status: kw.status || activeView,
            length: (kw.keyword || '').length
          }));
          
          dispatch(setKeywordsForView({
            projectId: projectIdStr,
            view: activeView,
            keywords: transformedKeywords,
            totalCount: initialData.pagination?.total
          }));
        }
        if (initialData.pagination) {
          setPagination(initialData.pagination);
        }
        if (initialData.processingStatus?.status) {
          setProcessingStatus(initialData.processingStatus.status);
          setProcessingProgress(initialData.processingStatus.progress || 0);
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
      addSnackbarMessage(`Error loading initial data: ${errorMessage}`, 'error');
      fetchKeywords(1, pagination.limit, activeView, sortParams, {
        tokens: selectedTokens,
        include: includeFilter,
        exclude: excludeFilter,
        minVolume: "",
        maxVolume: "",
        minLength: "",
        maxLength: "",
        minDifficulty: "",
        maxDifficulty: "",
        serpFeatures: [],
        minRating: '',
        maxRating: ''
      });
    } finally {
      setIsLoadingData(false);
    }
  }, [projectIdStr, pagination.limit, activeView, dispatch, projectIdNum, startProcessingCheck, addSnackbarMessage, fetchKeywords, sortParams, selectedTokens, includeFilter, excludeFilter]);
  
  const handleUploadStart = useCallback(() => {
    setIsUploading(true);
    setProcessingStatus('uploading');
    setProcessingProgress(0);
    startProcessingCheck();
  }, [startProcessingCheck]);  
  const handleUploadSuccess = useCallback(
    (status: ProcessingStatus, message?: string) => {
      setProcessingStatus(status);
      if (status === 'complete') {
        setIsUploading(false);
        setUploadSuccess(true);
        setProcessingProgress(100);
        stopProcessingCheck();
        addSnackbarMessage(message || 'File uploaded and processed successfully', 'success');
        fetchProjectStats();
        fetchKeywords(1, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: minVolume ? parseInt(minVolume) : "",
          maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
          serpFeatures: selectedSerpFeatures,
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : ""
        }, true);
        
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else if (status === 'queued' || status === 'processing') {
        startProcessingCheck();
        addSnackbarMessage('Upload complete', 'success', {
          stage: 'queued',
          description: message || (status === 'processing'
            ? 'Processing has started.'
            : 'Processing is queued and will begin shortly.')
        });
      } else {
        setIsUploading(false);
        if (message) addSnackbarMessage(message, 'success');
      }
    },
    [
      addSnackbarMessage, startProcessingCheck, stopProcessingCheck,
      fetchKeywords, pagination.limit, activeView, sortParams,
      selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating, fetchProjectStats
    ]
  );

  const handleUploadError = useCallback(
    (message: string) => {
      setIsUploading(false);
      setProcessingStatus('error');
      setProcessingProgress(0);
      setDisplayProgress(0);
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
      
      fetchKeywords(initialPage, pagination.limit, activeView, sortParams, {
        tokens: selectedTokens,
        include: includeFilter,
        exclude: excludeFilter,
        minVolume: minVolume ? parseInt(minVolume) : "",
        maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
        minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
        maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
        serpFeatures: selectedSerpFeatures,        
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : "",
      }, true);
      
      fetchProjectStats();
    }
    return () => {
      stopProcessingCheck();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [projectIdStr, activeView, fetchProjectStats, fetchInitialData, fetchKeywords, stopProcessingCheck, pagination.limit, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, pagination.page, minRating, maxRating]);
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
      setMinVolume(value);
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchKeywords(pagination.page, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: value ? parseInt(value) : "",
          maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
          serpFeatures: selectedSerpFeatures,          
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : "",
        });
      }, 500);
  
      debouncedFetch();
    },
    [fetchKeywords, pagination.page, pagination.limit, activeView, sortParams, selectedTokens, includeFilter, excludeFilter, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating]
  );
  
  const handleMaxVolumeChange = useCallback(
    (value: string) => {
      setMaxVolume(value);
      if (value && !minVolume) {
        setMinVolume('0');
      }
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchKeywords(pagination.page, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: minVolume ? parseInt(minVolume) : (value ? 0 : ""),
          maxVolume: value ? parseInt(value) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
          serpFeatures: selectedSerpFeatures,          
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : "",
        });
      }, 500);
  
      debouncedFetch();
    },
    [minVolume, fetchKeywords, pagination.page, pagination.limit, activeView, sortParams, selectedTokens, includeFilter, excludeFilter, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating, minLength, maxLength]
  );


  
  const handleMinDifficultyChange = useCallback(
    (value: string) => {
      setMinDifficulty(value);
      if (value && !minDifficulty) {
        setMinDifficulty('0');
      }
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchKeywords(pagination.page, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: minVolume ? parseInt(minVolume) : "",
          maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : (value ? 0 : ""),
          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
          serpFeatures: selectedSerpFeatures,          
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : "",
        });
      }, 500);
  
      debouncedFetch();
    },
    [minDifficulty, fetchKeywords, pagination.page, pagination.limit, activeView, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, maxDifficulty, selectedSerpFeatures, minRating, maxRating]
  );
  
  const handleMaxDifficultyChange = useCallback(
    (value: string) => {
      setMaxDifficulty(value);
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchKeywords(pagination.page, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: minVolume ? parseInt(minVolume) : "",
          maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
          maxDifficulty: value ? parseFloat(value) : "",
          serpFeatures: selectedSerpFeatures,
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : "",
        });
      }, 500);
  
      debouncedFetch();
    },
    [fetchKeywords, pagination.page, pagination.limit, activeView, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, selectedSerpFeatures, minRating, maxRating]
  );
    const handleMinRatingChange = useCallback(
    (value: string) => {
      setMinRating(value);
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchKeywords(pagination.page, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: minVolume ? parseInt(minVolume) : "",
          maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
          minRating: value ? parseInt(value) : "",
          maxRating: maxRating ? parseInt(maxRating) : "",
          serpFeatures: selectedSerpFeatures,
        });
      }, 500);
  
      debouncedFetch();
    },
    [fetchKeywords, pagination.page, pagination.limit, activeView, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, maxRating, selectedSerpFeatures]
  );
  
  const handleMaxRatingChange = useCallback(
    (value: string) => {
      setMaxRating(value);
      if (value && !minRating) {
        setMinRating('0');
      }
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchKeywords(pagination.page, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: minVolume ? parseInt(minVolume) : "",
          maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
          minRating: minRating ? parseInt(minRating) : (value ? 0 : ""),
          maxRating: value ? parseInt(value) : "",
          serpFeatures: selectedSerpFeatures,
        });
      }, 500);
  
      debouncedFetch();
    },
    [minRating, fetchKeywords, pagination.page, pagination.limit, activeView, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures]
  );

  const handleMinLengthChange = useCallback(
    (value: string) => {
      setMinLength(value);
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchKeywords(pagination.page, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: minVolume ? parseInt(minVolume) : "",
          maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: value ? parseInt(value) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : "",
          serpFeatures: selectedSerpFeatures,
        });
      }, 500);
  
      debouncedFetch();
    },
    [fetchKeywords, pagination.page, pagination.limit, activeView, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, maxLength, minDifficulty, maxDifficulty, minRating, maxRating, selectedSerpFeatures]
  );
  
  const handleMaxLengthChange = useCallback(
    (value: string) => {
      setMaxLength(value);
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchKeywords(pagination.page, pagination.limit, activeView, sortParams, {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: minVolume ? parseInt(minVolume) : "",
          maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: value ? parseInt(value) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
          minRating: minRating ? parseInt(minRating) : "",
          maxRating: maxRating ? parseInt(maxRating) : "",
          serpFeatures: selectedSerpFeatures,
        });
      }, 500);
  
      debouncedFetch();
    },
    [fetchKeywords, pagination.page, pagination.limit, activeView, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, minDifficulty, maxDifficulty, minRating, maxRating, selectedSerpFeatures]
  );

  const handleSerpFilterChange = useCallback((features: string[]) => {
    if (
      features.length !== selectedSerpFeatures.length || 
      features.some(f => !selectedSerpFeatures.includes(f))
    ) {
      setSelectedSerpFeatures(features);
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchKeywords(1, pagination.limit, activeView, sortParams, {
        tokens: selectedTokens,
        include: includeFilter,
        exclude: excludeFilter,
        minVolume: minVolume ? parseInt(minVolume) : "",
        maxVolume: maxVolume ? parseInt(maxVolume) : "",
        minLength: minLength ? parseInt(minLength) : "",
        maxLength: maxLength ? parseInt(maxLength) : "",
        minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
        maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
        serpFeatures: features,
        minRating: '',
        maxRating: ''
      }, true);
    }
  }, [
    fetchKeywords, 
    pagination.limit, 
    activeView, 
    sortParams, 
    selectedTokens, 
    includeFilter, 
    excludeFilter, 
    minVolume, 
    maxVolume, 
    minLength,
    maxLength,
    minDifficulty, 
    maxDifficulty, 
    selectedSerpFeatures
  ]);
     const handleTokenDataChange = useCallback(async () => {
    apiCache.invalidate(`${projectIdStr}-stats`);
    await Promise.all([
      fetchKeywords(
        pagination.page,
        pagination.limit,
        activeView,
        sortParams,
        {
          tokens: selectedTokens,
          include: includeFilter,
          exclude: excludeFilter,
          minVolume: minVolume ? parseInt(minVolume) : "",
          maxVolume: maxVolume ? parseInt(maxVolume) : "",
          minLength: minLength ? parseInt(minLength) : "",
          maxLength: maxLength ? parseInt(maxLength) : "",
          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
          serpFeatures: selectedSerpFeatures,
          minRating: '',
          maxRating: ''
        },
        true
      ),
      fetchProjectStats(),
    ]);
  }, [fetchKeywords, pagination.page, pagination.limit, activeView, sortParams, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, fetchProjectStats,apiCache, projectIdStr]);
  if (!projectIdStr) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <p className="text-red-300">Invalid Project ID.</p>
      </div>
    );
  }

  const isProcessing = processingStatus === 'queued' || processingStatus === 'processing';
  const showUploadLoader = isUploading || isProcessing;
  const totalChildKeywords = Math.max(0, stats.totalKeywords - stats.totalParentKeywords);

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-x-hidden">
      <Header projectName={project?.name} />
      <div className="bg-surface border-b border-border">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-end gap-3">
          <Button
            onClick={handleExportParentKeywords}
            disabled={isExportingParent}
          >
            {isExportingParent ? (
              <>
                <Spinner size="sm" className="border-muted border-t-foreground" />
                Exporting...
              </>
            ) : (
              'Export Parent KWs'
            )}
          </Button>
          <label className="inline-flex items-center">
            <span className="sr-only">Import Parent KWs</span>
            <Button disabled={isImportingParent}>
              {isImportingParent ? (
                <>
                  <Spinner size="sm" className="border-white/40 border-t-white" />
                  Importing...
                </>
              ) : (
                'Import Parent KWs'
              )}
            </Button>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImportParentKeywords(file);
                  e.target.value = '';
                }
              }}
              className="hidden"
              disabled={isImportingParent}
            />
          </label>

          <Button
            onClick={handleExportCSV}
            disabled={(activeView !== 'grouped' && activeView !== 'confirmed') || isExporting}
            variant="secondary"
          >
            {isExporting ? (
              <>
                <Spinner size="sm" className="border-white/40 border-t-white" />
                Exporting...
              </>
            ) : (
              'Export'
            )}
          </Button>
        </div>
      </div>
      <div className="flex-1 w-full">
        <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col xl:flex-row gap-4">
            <aside className="w-full xl:w-[280px] xl:flex-shrink-0 flex flex-col">
              <div className="bg-white shadow border border-border rounded-lg p-4 flex flex-col flex-grow h-full overflow-auto">
                <TextAreaInputs projectId={projectIdStr} />
              </div>
            </aside>
            <main className="flex-1 min-w-0 flex flex-col">
              <div className="bg-white shadow border border-border rounded-lg p-4 sm:p-6 flex flex-col flex-grow h-full">
                <div className="flex flex-wrap gap-2 border border-border rounded-lg bg-surface-muted/40 p-1 mb-4">
                  {(['overview', 'group', 'logs'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                        activeTab === tab
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-muted hover:text-foreground hover:bg-surface-muted'
                      }`}
                    >
                      {tab === 'overview' ? 'Overview' : tab === 'group' ? 'Group' : 'Logs'}
                    </button>
                  ))}
                </div>
                {activeTab === 'overview' && (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-lg border border-border bg-surface-muted/60 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="min-w-[220px] flex flex-col gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Upload CSVs</span>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="min-w-[180px] max-w-[220px]">
                              <FileUploader
                                projectId={projectIdStr}
                                onUploadStart={handleUploadStart}
                                onUploadSuccess={handleUploadSuccess}
                                onUploadError={handleUploadError}
                              />
                            </div>
                            <CSVUploadDropdown projectId={projectIdStr} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center h-6">
                      {showUploadLoader ? (
                        <div className="flex items-center text-blue-600">
                          <Loader2 size={16} className="animate-spin mr-2" />
                          <span className="text-xs">
                            {isUploading ? "Uploading..." : "Processing..."}
                          </span>
                        </div>
                      ) : processingStatus === 'error' && !isUploading && !isProcessing ? (
                        <div className="text-red-600 text-xs">
                          Processing failed. Try uploading again.
                        </div>
                      ) : (
                        <span className="text-xs text-transparent">Status</span>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total keywords uploaded</p>
                        <p className="text-lg font-semibold text-foreground">{stats.totalKeywords.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total parent keywords</p>
                        <p className="text-lg font-semibold text-foreground">{stats.totalParentKeywords.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total child keywords</p>
                        <p className="text-lg font-semibold text-foreground">{totalChildKeywords.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Grouped pages</p>
                        <p className="text-lg font-semibold text-foreground">{stats.groupedPages.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Confirmed pages</p>
                        <p className="text-lg font-semibold text-foreground">{stats.confirmedPages.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Blocked parent keywords</p>
                        <p className="text-lg font-semibold text-foreground">{stats.blockedCount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
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
                      selectedTokens={selectedTokens}
                      isUploading={isUploading}
                      processingStatus={processingStatus}
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
                      activeView={activeView}
                      isTableLoading={isTableLoading}
                      keywordsToDisplay={formatDataForDisplay}
                      pagination={pagination}
                      isLoadingData={isLoadingData}
                      loadingChildren={loadingChildren}
                      expandedGroups={expandedGroups}
                      selectedKeywordIds={selectedKeywordIds}
                      selectedTokens={selectedTokens}
                      sortParams={sortParams}
                      isAllSelected={isAllSelected}
                      isAnySelected={isAnySelected}
                      projectIdStr={projectIdStr}
                      selectedParentKeywordCount={selectedParentKeywordCount}
                      minVolume={minVolume}
                      maxVolume={maxVolume}
                      minLength={minLength}
                      maxLength={maxLength}
                      minRating={minRating}
                      maxRating={maxRating}
                      minDifficulty={minDifficulty}
                      maxDifficulty={maxDifficulty}
                      handleViewChange={handleViewChange}
                      handlePageChange={handlePageChange}
                      handleLimitChange={handleLimitChange}
                      handleMinVolumeChange={handleMinVolumeChange}
                      handleMaxVolumeChange={handleMaxVolumeChange}
                      handleMinLengthChange={handleMinLengthChange}
                      handleMaxLengthChange={handleMaxLengthChange}
                      handleMinDifficultyChange={handleMinDifficultyChange}
                      handleMaxDifficultyChange={handleMaxDifficultyChange}
                      handleMinRatingChange={handleMinRatingChange}
                      handleMaxRatingChange={handleMaxRatingChange}
                      toggleGroupExpansion={toggleGroupExpansion}
                      toggleKeywordSelection={toggleKeywordSelection}
                      toggleTokenSelection={handleAdvancedTokenSelection}
                      removeToken={removeToken}
                      handleSort={handleSort}
                      handleSelectAllClick={handleSelectAllClick}
                      handleMiddleClickGroup={handleMiddleClickGroup}
                      stats={stats}
                      selectedSerpFeatures={selectedSerpFeatures}
                      handleSerpFilterChange={handleSerpFilterChange}
                    />
                  </>
                )}
                {activeTab === 'logs' && (
                  <div className="rounded-lg border border-border bg-surface-muted/60 px-4 py-6 text-sm text-muted">
                    Logs will appear here as processing and action history becomes available.
                  </div>
                )}
              </div>
            </main>
            <aside className="w-full xl:w-[280px] xl:flex-shrink-0 flex flex-col">
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
                        {
                          tokens: selectedTokens,
                          include: includeFilter,
                          exclude: excludeFilter,
                          minVolume: minVolume ? parseInt(minVolume) : "",
                          maxVolume: maxVolume ? parseInt(maxVolume) : "",
                          minLength: minLength ? parseInt(minLength) : "",
                          maxLength: maxLength ? parseInt(maxLength) : "",
                          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
                          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
                          serpFeatures: selectedSerpFeatures,
                          minRating: minRating ? parseInt(minRating) : "",
                          maxRating: maxRating ? parseInt(maxRating) : "",
                        },
                        true
                      ),
                      fetchProjectStats()
                    ]);
                  }}
                  onUnblockTokenSuccess={async () => {
                    await Promise.all([
                      fetchKeywords(
                        pagination.page,
                        pagination.limit,
                        activeView,
                        sortParams,
                        {
                          tokens: selectedTokens,
                          include: includeFilter,
                          exclude: excludeFilter,
                          minVolume: minVolume ? parseInt(minVolume) : "",
                          maxVolume: maxVolume ? parseInt(maxVolume) : "",
                          minLength: minLength ? parseInt(minLength) : "",
                          maxLength: maxLength ? parseInt(maxLength) : "",
                          minDifficulty: minDifficulty ? parseFloat(minDifficulty) : "",
                          maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : "",
                          serpFeatures: selectedSerpFeatures,
                          minRating: minRating ? parseInt(minRating) : "",
                          maxRating: maxRating ? parseInt(maxRating) : "",
                        },
                        true
                      ),
                      fetchProjectStats()
                    ]);
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
