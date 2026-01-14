/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store/store';
import { setChildrenForGroup } from '@/store/projectSlice';
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
  ProcessingStatus, ActiveKeywordView, SnackbarMessage, SortParams,
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
import { useProjectKeywords } from '../hooks/useProjectKeywords';
import type { KeywordFilters } from '../hooks/useProjectKeywords';
import { useProcessingStatus } from '../hooks/useProcessingStatus';
import { useKeywordActions } from '../hooks/useKeywordActions';

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

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

function toNumberOrEmpty(value: string): number | '' {
  return value ? parseInt(value, 10) : '';
}

function toFloatOrEmpty(value: string): number | '' {
  return value ? parseFloat(value) : '';
}

export default function ProjectDetail(): React.ReactElement {
  const params = useParams();
  const projectIdNum = Number(params?.id);
  const projectIdStr = params?.id ? String(params.id) : '';
  const dispatch: AppDispatch = useDispatch();
  
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
  const [activeTab, setActiveTab] = useState<ProjectDetailTab>('group');
  const [logsRefreshKey, setLogsRefreshKey] = useState(0);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [includeFilter, setIncludeFilter] = useState('');
  const [excludeFilter, setExcludeFilter] = useState('');
  const [includeMatchType, setIncludeMatchType] = useState<'any' | 'all'>('any');
  const [excludeMatchType, setExcludeMatchType] = useState<'any' | 'all'>('any');
  const [sortParams, setSortParams] = useState<SortParams>({
    column: 'volume',
    direction: 'desc'
  });
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loadingChildren, setLoadingChildren] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState<string>('');
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [snackbarMessages, setSnackbarMessages] = useState<SnackbarMessage[]>([]);
  const prevActiveViewRef = useRef(activeView);
  const [minVolume, setMinVolume] = useState<string>('');
  const [maxVolume, setMaxVolume] = useState<string>('');
  const [minLength, setMinLength] = useState<string>('');
  const [maxLength, setMaxLength] = useState<string>('');
  const [minDifficulty, setMinDifficulty] = useState<string>('');
  const [maxDifficulty, setMaxDifficulty] = useState<string>('');
  const [minRating, setMinRating] = useState<string>('');
  const [maxRating, setMaxRating] = useState<string>('');
  const [selectedSerpFeatures, setSelectedSerpFeatures] = useState<string[]>([]);

  const bumpLogsRefresh = useCallback(() => {
    setLogsRefreshKey((prev) => prev + 1);
  }, []);

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

  const {
    stats,
    pagination,
    setPagination,
    isTableLoading,
    setIsTableLoading,
    isLoadingData,
    fetchProjectStats,
    fetchKeywords,
    fetchChildren,
    fetchInitialData,
    invalidateCache,
    invalidateCacheByView,
    clearCache,
  } = useProjectKeywords({
    projectIdNum,
    projectIdStr,
    addSnackbarMessage,
  });

  const keywordFilters = useMemo<KeywordFilters>(
    () => ({
      tokens: selectedTokens,
      include: includeFilter,
      exclude: excludeFilter,
      minVolume: toNumberOrEmpty(minVolume),
      maxVolume: toNumberOrEmpty(maxVolume),
      minLength: toNumberOrEmpty(minLength),
      maxLength: toNumberOrEmpty(maxLength),
      minDifficulty: toFloatOrEmpty(minDifficulty),
      maxDifficulty: toFloatOrEmpty(maxDifficulty),
      minRating: toNumberOrEmpty(minRating),
      maxRating: toNumberOrEmpty(maxRating),
      serpFeatures: selectedSerpFeatures,
    }),
    [
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
    ]
  );

  const {
    processingStatus,
    processingMessage,
    processingCurrentFile,
    processingQueue,
    displayProgress,
    isUploading,
    startProcessingCheck,
    stopProcessingCheck,
    initializeProcessingStatus,
    handleUploadStart,
    handleUploadSuccess,
    handleUploadError,
  } = useProcessingStatus({
    projectIdStr,
    projectIdNum,
    activeView,
    paginationLimit: pagination.limit,
    sortParams,
    filters: keywordFilters,
    includeMatchType,
    excludeMatchType,
    fetchKeywords,
    fetchProjectStats,
    addSnackbarMessage,
    bumpLogsRefresh,
  });

  const runFetchKeywords = useCallback(
    (options: {
      page?: number;
      limit?: number;
      view?: ActiveKeywordView;
      sort?: SortParams;
      filters: {
        tokens: string[];
        include: string;
        exclude: string;
        minVolume: number | '';
        maxVolume: number | '';
        minLength: number | '';
        maxLength: number | '';
        minDifficulty: number | '';
        maxDifficulty: number | '';
        minRating: number | '';
        maxRating: number | '';
        serpFeatures: string[];
      };
      forceRefresh?: boolean;
    }) =>
      fetchKeywords({
        ...options,
        sort: options.sort ?? sortParams,
        includeMatchType,
        excludeMatchType,
      }),
    [fetchKeywords, sortParams, includeMatchType, excludeMatchType]
  );

  // useKeywordActions hook is initialized after filteredAndSortedKeywords is available.

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


const handleViewChange = useCallback((newView: ActiveKeywordView) => {
  if (activeView !== newView) {
    setActiveView(newView);
    setSelectedKeywordIds(new Set());
    setExpandedGroups(new Set());
    setPagination(prev => ({ ...prev, page: 1 }));
    invalidateCacheByView(newView);
    runFetchKeywords({
      page: 1,
      limit: pagination.limit,
      view: newView,
      sort: sortParams,
      filters: {
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
      },
      forceRefresh: true,
    });
  }
}, [
  activeView, pagination.limit, sortParams, selectedTokens, 
  includeFilter, excludeFilter, runFetchKeywords, invalidateCacheByView
]);

const handlePageChange = useCallback((newPage: number) => {
  if (newPage < 1 || newPage === pagination.page || newPage > pagination.pages || isLoadingData) return;
  setPagination(prev => ({ ...prev, page: newPage }));
  runFetchKeywords({
    page: newPage,
    limit: pagination.limit,
    view: activeView,
    filters: {
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
    forceRefresh: false,
  });
}, [pagination.page, pagination.pages, pagination.limit, isLoadingData, runFetchKeywords, activeView, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating]);
const handleLimitChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
  const newLimit = parseInt(event.target.value, 10);
  if (!isNaN(newLimit) && newLimit !== pagination.limit) {
    setPagination(prev => ({
      ...prev,
      limit: newLimit,
      page: 1
    }));
  runFetchKeywords({
    page: 1,
    limit: newLimit,
    view: activeView,
    filters: {
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
    forceRefresh: true,
  });
  }
}, [pagination.limit, runFetchKeywords, activeView, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating]);
const handleSort = useCallback((column: string) => {
  if (column === 'tokens' || column === 'serpFeatures') return;
  const newDirection: 'asc' | 'desc' = sortParams.column === column && sortParams.direction === 'asc' ? 'desc' : 'asc';
  const newSortParams: SortParams = { column, direction: newDirection };
  setSortParams(newSortParams);
  setPagination(prev => ({ ...prev, page: 1 }));
  runFetchKeywords({
    page: pagination.page,
    limit: pagination.limit,
    view: activeView,
    sort: newSortParams,
    filters: {
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
  });
}, [sortParams.column, sortParams.direction, runFetchKeywords, pagination.page, pagination.limit, activeView, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating]);

const filteredAndSortedKeywords = useMemo(() => {
  return getCurrentViewData();
}, [getCurrentViewData]);

  const toggleTokenSelection = useCallback((token: string) => {
    setSelectedTokens(prev => {
      const isCurrentlySelected = prev.includes(token);
      const newTokens = isCurrentlySelected
        ? prev.filter(t => t !== token)
        : [...prev, token];
      const currentPage = pagination.page;
      invalidateCache(projectIdStr + '-' + activeView);
      runFetchKeywords({
        page: currentPage,
        limit: pagination.limit,
        view: activeView,
        filters: {
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
        },
        forceRefresh: true,
      });
      
      return newTokens;
    });
  }, [pagination.page, pagination.limit, invalidateCache, projectIdStr, activeView, runFetchKeywords, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating]);


  const removeToken = useCallback((token: string) => {
    setSelectedTokens(prev => prev.filter(t => t !== token));
    const currentPage = pagination.page;
    invalidateCache(projectIdStr + '-' + activeView);
    runFetchKeywords({
      page: currentPage,
      limit: pagination.limit,
      view: activeView,
      filters: {
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
      },
      forceRefresh: true,
    });
  }, [pagination.page, pagination.limit, invalidateCache, projectIdStr, activeView, runFetchKeywords, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating]);
  const {
    isExportingParent,
    isImportingParent,
    isExporting,
    handleExportParentKeywords,
    handleImportParentKeywords,
    handleExportCSV,
    handleConfirmKeywords,
    handleUnconfirmKeywords,
    handleGroupKeywords,
    handleUngroupKeywords,
    handleUnblockKeywords,
    handleMiddleClickGroup,
    handleTokenDataChange,
    handleAdvancedTokenSelection,
  } = useKeywordActions({
    projectIdStr,
    activeView,
    pagination,
    sortParams,
    selectedTokens,
    includeFilter,
    excludeFilter,
    includeMatchType,
    excludeMatchType,
    minVolume,
    maxVolume,
    minLength,
    maxLength,
    minDifficulty,
    maxDifficulty,
    minRating,
    maxRating,
    selectedSerpFeatures,
    groupName,
    selectedKeywordIds,
    filteredAndSortedKeywords,
    ungroupedKeywords,
    childrenCache,
    calculateMaintainedPage,
    fetchKeywords,
    fetchProjectStats,
    clearCache,
    invalidateCache,
    addSnackbarMessage,
    bumpLogsRefresh,
    setSelectedKeywordIds,
    setGroupName,
    setExpandedGroups,
    setIsTableLoading,
    setIsProcessingAction,
    toggleTokenSelection,
  });

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
      addSnackbarMessage(
        'Error selecting keywords: ' + (isError(err) ? err.message : 'Unknown error'),
        'error'
      );
    });
    return newSelected;
  });
}, [filteredAndSortedKeywords, activeView, childrenCache, fetchChildren, dispatch, projectIdStr, addSnackbarMessage]);

  const handleSelectAllClick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    toggleKeywordSelection(isChecked ? -1 : 0).catch(err => {
      addSnackbarMessage(
        'Error selecting all: ' + (isError(err) ? err.message : 'Unknown error'),
        'error'
      );
    });
  }, [toggleKeywordSelection, addSnackbarMessage]);

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
        
        await runFetchKeywords({
          page: 1,
          limit: pagination.limit,
          view: activeView,
          filters: {
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
          },
          forceRefresh: true,
        });
      };
      
      executeSearch();
    },
    [activeView, runFetchKeywords, pagination.limit, selectedTokens, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating, childrenCache, includeMatchType]
  );
  const handleExcludeFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setExcludeFilter(newValue);
      const executeSearch = async () => {
        setPagination(prev => ({ ...prev, page: 1 }));
        await runFetchKeywords({
          page: 1,
          limit: pagination.limit,
          view: activeView,
          filters: {
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
          },
          forceRefresh: true,
        });
      };
      
      executeSearch();
    },
    [runFetchKeywords, pagination.limit, activeView, selectedTokens, includeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating]
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
    invalidateCache(projectIdStr + '-' + activeView);
    runFetchKeywords({
      page: 1,
      limit: pagination.limit,
      view: activeView,
      filters: {
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
      },
      forceRefresh: true,
    });
  }, [
    runFetchKeywords, 
    pagination.limit, 
    activeView, 
    projectIdStr,
    invalidateCache
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
        addSnackbarMessage(
          'Error loading children: ' + (isError(err) ? err.message : 'Unknown error'),
          'error'
        );
      } finally {
        setLoadingChildren(prevLoading => {
          const newSet = new Set(prevLoading);
          newSet.delete(groupId);
          return newSet;
        });
      }
    }
  }, [projectIdStr, childrenCache, dispatch, addSnackbarMessage, expandedGroups, fetchChildren]);

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
  useEffect(() => {
    if (projectIdStr) {
      const loadInitial = async () => {
        const processingData = await fetchInitialData({
          activeView,
          paginationLimit: pagination.limit,
        });
        if (processingData) {
          initializeProcessingStatus(processingData);
        }
      };
      loadInitial();
      const initialPage = activeView !== prevActiveViewRef.current ? 1 : pagination.page;
      prevActiveViewRef.current = activeView;
      
      runFetchKeywords({
        page: initialPage,
        limit: pagination.limit,
        view: activeView,
        filters: {
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
        forceRefresh: true,
      });
      
      fetchProjectStats();
    }
    return () => {
      stopProcessingCheck();
    };
  }, [projectIdStr, activeView, fetchProjectStats, fetchInitialData, runFetchKeywords, stopProcessingCheck, pagination.limit, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, pagination.page, minRating, maxRating, initializeProcessingStatus]);
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
        runFetchKeywords({
          page: pagination.page,
          limit: pagination.limit,
          view: activeView,
          filters: {
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
          },
        });
      }, 500);
  
      debouncedFetch();
    },
    [runFetchKeywords, pagination.page, pagination.limit, activeView, selectedTokens, includeFilter, excludeFilter, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating]
  );
  
  const handleMaxVolumeChange = useCallback(
    (value: string) => {
      setMaxVolume(value);
      if (value && !minVolume) {
        setMinVolume('0');
      }
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        runFetchKeywords({
          page: pagination.page,
          limit: pagination.limit,
          view: activeView,
          filters: {
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
          },
        });
      }, 500);
  
      debouncedFetch();
    },
    [minVolume, runFetchKeywords, pagination.page, pagination.limit, activeView, selectedTokens, includeFilter, excludeFilter, minDifficulty, maxDifficulty, selectedSerpFeatures, minRating, maxRating, minLength, maxLength]
  );


  
  const handleMinDifficultyChange = useCallback(
    (value: string) => {
      setMinDifficulty(value);
      if (value && !minDifficulty) {
        setMinDifficulty('0');
      }
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        runFetchKeywords({
          page: pagination.page,
          limit: pagination.limit,
          view: activeView,
          filters: {
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
          },
        });
      }, 500);
  
      debouncedFetch();
    },
    [minDifficulty, runFetchKeywords, pagination.page, pagination.limit, activeView, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, maxDifficulty, selectedSerpFeatures, minRating, maxRating]
  );
  
  const handleMaxDifficultyChange = useCallback(
    (value: string) => {
      setMaxDifficulty(value);
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        runFetchKeywords({
          page: pagination.page,
          limit: pagination.limit,
          view: activeView,
          filters: {
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
          },
        });
      }, 500);
  
      debouncedFetch();
    },
    [runFetchKeywords, pagination.page, pagination.limit, activeView, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, selectedSerpFeatures, minRating, maxRating]
  );
    const handleMinRatingChange = useCallback(
    (value: string) => {
      setMinRating(value);
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        runFetchKeywords({
          page: pagination.page,
          limit: pagination.limit,
          view: activeView,
          filters: {
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
          },
        });
      }, 500);
  
      debouncedFetch();
    },
    [runFetchKeywords, pagination.page, pagination.limit, activeView, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, maxRating, selectedSerpFeatures]
  );
  
  const handleMaxRatingChange = useCallback(
    (value: string) => {
      setMaxRating(value);
      if (value && !minRating) {
        setMinRating('0');
      }
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        runFetchKeywords({
          page: pagination.page,
          limit: pagination.limit,
          view: activeView,
          filters: {
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
          },
        });
      }, 500);
  
      debouncedFetch();
    },
    [minRating, runFetchKeywords, pagination.page, pagination.limit, activeView, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, maxLength, minDifficulty, maxDifficulty, selectedSerpFeatures]
  );

  const handleMinLengthChange = useCallback(
    (value: string) => {
      setMinLength(value);
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        runFetchKeywords({
          page: pagination.page,
          limit: pagination.limit,
          view: activeView,
          filters: {
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
          },
        });
      }, 500);
  
      debouncedFetch();
    },
    [runFetchKeywords, pagination.page, pagination.limit, activeView, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, maxLength, minDifficulty, maxDifficulty, minRating, maxRating, selectedSerpFeatures]
  );
  
  const handleMaxLengthChange = useCallback(
    (value: string) => {
      setMaxLength(value);
      const debouncedFetch = debounce(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        runFetchKeywords({
          page: pagination.page,
          limit: pagination.limit,
          view: activeView,
          filters: {
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
          },
        });
      }, 500);
  
      debouncedFetch();
    },
    [runFetchKeywords, pagination.page, pagination.limit, activeView, selectedTokens, includeFilter, excludeFilter, minVolume, maxVolume, minLength, minDifficulty, maxDifficulty, minRating, maxRating, selectedSerpFeatures]
  );

  const handleSerpFilterChange = useCallback((features: string[]) => {
    if (
      features.length !== selectedSerpFeatures.length || 
      features.some(f => !selectedSerpFeatures.includes(f))
    ) {
      setSelectedSerpFeatures(features);
      setPagination(prev => ({ ...prev, page: 1 }));
      runFetchKeywords({
        page: 1,
        limit: pagination.limit,
        view: activeView,
        filters: {
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
        },
        forceRefresh: true,
      });
    }
  }, [
    runFetchKeywords, 
    pagination.limit, 
    activeView, 
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
      <ProjectDetailToolbar
        activeView={activeView}
        isExportingParent={isExportingParent}
        isImportingParent={isImportingParent}
        isExporting={isExporting}
        onExportParentKeywords={handleExportParentKeywords}
        onImportParentKeywords={handleImportParentKeywords}
        onExportCSV={handleExportCSV}
      />
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
                <ProjectDetailTabs activeTab={activeTab} onTabChange={setActiveTab} />
                {activeTab === 'overview' && (
                  <ProjectDetailOverview
                    projectId={projectIdStr}
                    stats={stats}
                    totalChildKeywords={totalChildKeywords}
                    showUploadLoader={showUploadLoader}
                    isUploading={isUploading}
                    processingStatus={processingStatus}
                    processingMessage={processingMessage}
                    displayProgress={displayProgress}
                    processingCurrentFile={processingCurrentFile}
                    processingQueue={processingQueue}
                    onUploadStart={handleUploadStart}
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
                {activeTab === 'process' && (
                  <ProjectDetailProcess />
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
            <aside className="w-full xl:w-[280px] xl:flex-shrink-0 flex flex-col">
              <div className="bg-white shadow border border-border rounded-lg p-4 flex flex-col flex-grow h-full overflow-hidden">
                <TokenManagement
                  projectId={projectIdStr}
                  onBlockTokenSuccess={async () => {
                    await Promise.all([
                      runFetchKeywords({
                        page: pagination.page,
                        limit: pagination.limit,
                        view: activeView,
                        filters: {
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
                        forceRefresh: true,
                      }),
                      fetchProjectStats()
                    ]);
                    bumpLogsRefresh();
                  }}
                  onUnblockTokenSuccess={async () => {
                    await Promise.all([
                      runFetchKeywords({
                        page: pagination.page,
                        limit: pagination.limit,
                        view: activeView,
                        filters: {
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
                        forceRefresh: true,
                      }),
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
