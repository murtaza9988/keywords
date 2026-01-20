"use client";
import React, { useCallback } from 'react';
import { blockToken } from '@/lib/api/keywords';
import { ProjectDetailAction } from '../ProjectDetail.state';
import {
  ProcessingStatus,
  ActiveKeywordView,
  Keyword,
  SortParams
} from '../types';
import { ApiCache } from './useProjectDetailState';
import { FilterParams } from './useKeywordFetching';

function isError(error: unknown): error is Error {
  return error instanceof Error;
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

interface UseKeywordFiltersProps {
  projectIdStr: string;
  detailDispatch: React.Dispatch<ProjectDetailAction>;
  apiCache: ApiCache;
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
  childrenCache: Record<string, Keyword[]>;
}

export interface UseKeywordFiltersReturn {
  handleIncludeFilterChange: (
    e: React.ChangeEvent<HTMLInputElement>,
    activeView: ActiveKeywordView,
    pagination: { page: number; limit: number },
    sortParams: SortParams,
    filterParams: FilterParams,
    includeMatchType: 'any' | 'all'
  ) => void;
  handleExcludeFilterChange: (
    e: React.ChangeEvent<HTMLInputElement>,
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => void;
  clearAllFilters: (
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams
  ) => void;
  toggleTokenSelection: (
    token: string,
    selectedTokens: string[],
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => void;
  handleAdvancedTokenSelection: (
    token: string,
    event: React.MouseEvent,
    selectedTokens: string[],
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    minVolume: string,
    maxVolume: string,
    minLength: string,
    maxLength: string,
    minDifficulty: string,
    maxDifficulty: string,
    minRating: string,
    maxRating: string,
    selectedSerpFeatures: string[],
    includeFilter: string,
    excludeFilter: string
  ) => Promise<void>;
  removeToken: (
    token: string,
    selectedTokens: string[],
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => void;
  handleMinVolumeChange: (
    value: string,
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => void;
  handleMaxVolumeChange: (
    value: string,
    minVolume: string,
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => void;
  handleMinLengthChange: (
    value: string,
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => void;
  handleMaxLengthChange: (
    value: string,
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => void;
  handleMinDifficultyChange: (
    value: string,
    minDifficulty: string,
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => void;
  handleMaxDifficultyChange: (
    value: string,
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => void;
  handleMinRatingChange: (
    value: string,
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => void;
  handleMaxRatingChange: (
    value: string,
    minRating: string,
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => void;
  handleSerpFilterChange: (
    features: string[],
    selectedSerpFeatures: string[],
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => void;
}

export function useKeywordFilters({
  projectIdStr,
  detailDispatch,
  apiCache,
  addSnackbarMessage,
  bumpLogsRefresh,
  fetchKeywords,
  fetchProjectStats,
  childrenCache,
}: UseKeywordFiltersProps): UseKeywordFiltersReturn {
  const handleIncludeFilterChange = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement>,
      activeView: ActiveKeywordView,
      pagination: { page: number; limit: number },
      sortParams: SortParams,
      filterParams: FilterParams,
      includeMatchType: 'any' | 'all'
    ) => {
      const newValue = e.target.value;
      detailDispatch({
        type: 'updateFilters',
        payload: { includeFilter: newValue },
      });
      const executeSearch = async () => {
        detailDispatch({
          type: 'updatePagination',
          payload: {
            pagination: { ...pagination, page: 1, total: pagination.page === 1 ? 0 : 0, pages: 1 },
          },
        });
        if (activeView === 'grouped' && newValue) {
          const existingChildrenGroups = Object.keys(childrenCache).filter(
            groupId => childrenCache[groupId] && childrenCache[groupId].length > 0
          );

          const groupsToExpand = new Set<string>();

          existingChildrenGroups.forEach(groupId => {
            const children = childrenCache[groupId];
            const includeTerms = newValue.split(',').map((t: string) => t.trim().toLowerCase());
            const hasMatch = children.some(child => {
              const childKeywordLower = child.keyword.toLowerCase();
              return includeMatchType === 'any'
                ? includeTerms.some((term: string) => childKeywordLower.includes(term))
                : includeTerms.every((term: string) => childKeywordLower.includes(term));
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
    [fetchKeywords, childrenCache, detailDispatch]
  );

  const handleExcludeFilterChange = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement>,
      pagination: { page: number; limit: number },
      activeView: ActiveKeywordView,
      sortParams: SortParams,
      filterParams: FilterParams
    ) => {
      const newValue = e.target.value;
      detailDispatch({
        type: 'updateFilters',
        payload: { excludeFilter: newValue },
      });
      const executeSearch = async () => {
        detailDispatch({
          type: 'updatePagination',
          payload: {
            pagination: { ...pagination, page: 1, total: pagination.page === 1 ? 0 : 0, pages: 1 },
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
    [fetchKeywords, detailDispatch]
  );

  const clearAllFilters = useCallback((
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams
  ) => {
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
        pagination: { ...pagination, page: 1, total: 0, pages: 1 },
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
    projectIdStr,
    apiCache,
    detailDispatch
  ]);

  const toggleTokenSelection = useCallback((
    token: string,
    selectedTokens: string[],
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => {
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
  }, [apiCache, projectIdStr, fetchKeywords, detailDispatch]);

  const handleAdvancedTokenSelection = useCallback(async (
    token: string,
    event: React.MouseEvent,
    selectedTokens: string[],
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    minVolume: string,
    maxVolume: string,
    minLength: string,
    maxLength: string,
    minDifficulty: string,
    maxDifficulty: string,
    minRating: string,
    maxRating: string,
    selectedSerpFeatures: string[],
    includeFilter: string,
    excludeFilter: string
  ) => {
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
        addSnackbarMessage('Blocked ' + data.count + ' keywords with token "' + token + '"', 'success');
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
      toggleTokenSelection(token, selectedTokens, pagination, activeView, sortParams, {
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
      });
    }
  }, [projectIdStr, addSnackbarMessage, apiCache, fetchProjectStats, fetchKeywords, toggleTokenSelection, bumpLogsRefresh, detailDispatch]);

  const removeToken = useCallback((
    token: string,
    selectedTokens: string[],
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => {
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
  }, [apiCache, projectIdStr, fetchKeywords, detailDispatch]);

  const handleMinVolumeChange = useCallback(
    (
      value: string,
      pagination: { page: number; limit: number },
      activeView: ActiveKeywordView,
      sortParams: SortParams,
      filterParams: FilterParams
    ) => {
      detailDispatch({
        type: 'updateFilters',
        payload: { minVolume: value },
      });
      const debouncedFetch = debounce(() => {
        detailDispatch({
          type: 'updatePagination',
          payload: { pagination: { ...pagination, page: 1, total: 0, pages: 1 } },
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
    [fetchKeywords, detailDispatch]
  );

  const handleMaxVolumeChange = useCallback(
    (
      value: string,
      minVolume: string,
      pagination: { page: number; limit: number },
      activeView: ActiveKeywordView,
      sortParams: SortParams,
      filterParams: FilterParams
    ) => {
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
          payload: { pagination: { ...pagination, page: 1, total: 0, pages: 1 } },
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
    [fetchKeywords, detailDispatch]
  );

  const handleMinLengthChange = useCallback(
    (
      value: string,
      pagination: { page: number; limit: number },
      activeView: ActiveKeywordView,
      sortParams: SortParams,
      filterParams: FilterParams
    ) => {
      detailDispatch({
        type: 'updateFilters',
        payload: { minLength: value },
      });
      const debouncedFetch = debounce(() => {
        detailDispatch({
          type: 'updatePagination',
          payload: { pagination: { ...pagination, page: 1, total: 0, pages: 1 } },
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
    [fetchKeywords, detailDispatch]
  );

  const handleMaxLengthChange = useCallback(
    (
      value: string,
      pagination: { page: number; limit: number },
      activeView: ActiveKeywordView,
      sortParams: SortParams,
      filterParams: FilterParams
    ) => {
      detailDispatch({
        type: 'updateFilters',
        payload: { maxLength: value },
      });
      const debouncedFetch = debounce(() => {
        detailDispatch({
          type: 'updatePagination',
          payload: { pagination: { ...pagination, page: 1, total: 0, pages: 1 } },
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
    [fetchKeywords, detailDispatch]
  );

  const handleMinDifficultyChange = useCallback(
    (
      value: string,
      minDifficulty: string,
      pagination: { page: number; limit: number },
      activeView: ActiveKeywordView,
      sortParams: SortParams,
      filterParams: FilterParams
    ) => {
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
          payload: { pagination: { ...pagination, page: 1, total: 0, pages: 1 } },
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
    [fetchKeywords, detailDispatch]
  );

  const handleMaxDifficultyChange = useCallback(
    (
      value: string,
      pagination: { page: number; limit: number },
      activeView: ActiveKeywordView,
      sortParams: SortParams,
      filterParams: FilterParams
    ) => {
      detailDispatch({
        type: 'updateFilters',
        payload: { maxDifficulty: value },
      });
      const debouncedFetch = debounce(() => {
        detailDispatch({
          type: 'updatePagination',
          payload: { pagination: { ...pagination, page: 1, total: 0, pages: 1 } },
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
    [fetchKeywords, detailDispatch]
  );

  const handleMinRatingChange = useCallback(
    (
      value: string,
      pagination: { page: number; limit: number },
      activeView: ActiveKeywordView,
      sortParams: SortParams,
      filterParams: FilterParams
    ) => {
      detailDispatch({
        type: 'updateFilters',
        payload: { minRating: value },
      });
      const debouncedFetch = debounce(() => {
        detailDispatch({
          type: 'updatePagination',
          payload: { pagination: { ...pagination, page: 1, total: 0, pages: 1 } },
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
    [fetchKeywords, detailDispatch]
  );

  const handleMaxRatingChange = useCallback(
    (
      value: string,
      minRating: string,
      pagination: { page: number; limit: number },
      activeView: ActiveKeywordView,
      sortParams: SortParams,
      filterParams: FilterParams
    ) => {
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
          payload: { pagination: { ...pagination, page: 1, total: 0, pages: 1 } },
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
    [fetchKeywords, detailDispatch]
  );

  const handleSerpFilterChange = useCallback((
    features: string[],
    selectedSerpFeatures: string[],
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => {
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
        payload: { pagination: { ...pagination, page: 1, total: 0, pages: 1 } },
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
  }, [fetchKeywords, detailDispatch]);

  return {
    handleIncludeFilterChange,
    handleExcludeFilterChange,
    clearAllFilters,
    toggleTokenSelection,
    handleAdvancedTokenSelection,
    removeToken,
    handleMinVolumeChange,
    handleMaxVolumeChange,
    handleMinLengthChange,
    handleMaxLengthChange,
    handleMinDifficultyChange,
    handleMaxDifficultyChange,
    handleMinRatingChange,
    handleMaxRatingChange,
    handleSerpFilterChange,
  };
}
