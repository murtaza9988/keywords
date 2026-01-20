"use client";
import { useCallback } from 'react';
import { AppDispatch } from '@/store/store';
import { setKeywordsForView, setProjectStats } from '@/store/projectSlice';
import {
  fetchInitialData as fetchInitialDataApi,
  fetchKeywords as fetchKeywordsApi,
  fetchKeywordChildren,
} from '@/lib/api/keywords';
import { fetchProjectStats as fetchProjectStatsApi } from '@/lib/api/projects';
import { ProjectDetailAction } from '../ProjectDetail.state';
import {
  ProcessingStatus,
  ProcessingFileError,
  ActiveKeywordView,
  Keyword,
  SortParams
} from '../types';
import { ApiCache } from './useProjectDetailState';

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

type SerpFeatureValue = string[] | string | null | undefined;
type SerpFeatureCarrier = { serpFeatures?: SerpFeatureValue };

export interface FilterParams {
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
}

interface UseKeywordFetchingProps {
  projectIdStr: string;
  projectIdNum: number;
  dispatch: AppDispatch;
  detailDispatch: React.Dispatch<ProjectDetailAction>;
  apiCache: ApiCache;
  addSnackbarMessage: (text: string, type: 'success' | 'error' | 'info', options?: { description?: string; stage?: ProcessingStatus }) => void;
  includeMatchType: 'any' | 'all';
  excludeMatchType: 'any' | 'all';
}

export interface UseKeywordFetchingReturn {
  fetchProjectStats: () => Promise<void>;
  fetchKeywords: (
    page?: number,
    limit?: number,
    view?: ActiveKeywordView,
    sort?: SortParams,
    filters?: FilterParams,
    forceRefresh?: boolean
  ) => Promise<void>;
  fetchChildren: (groupId: string) => Promise<Keyword[]>;
  fetchInitialData: (
    paginationLimit: number,
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams,
    startProcessingCheck: () => void
  ) => Promise<void>;
  getSerpFeatures: (keyword: Keyword | SerpFeatureCarrier | null | undefined) => string[];
}

export function useKeywordFetching({
  projectIdStr,
  projectIdNum,
  dispatch,
  detailDispatch,
  apiCache,
  addSnackbarMessage,
  includeMatchType,
  excludeMatchType,
}: UseKeywordFetchingProps): UseKeywordFetchingReturn {
  const getSerpFeatures = useCallback((
    keyword: Keyword | SerpFeatureCarrier | null | undefined
  ): string[] => {
    if (!keyword || !keyword.serpFeatures) return [];
    if (Array.isArray(keyword.serpFeatures)) return keyword.serpFeatures;
    if (typeof keyword.serpFeatures === 'string') {
      try {
        const parsed = JSON.parse(keyword.serpFeatures);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, []);

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
  }, [projectIdStr, addSnackbarMessage, dispatch, detailDispatch]);

  const fetchKeywords = useCallback(async (
    page = 1,
    limit = 250,
    view: ActiveKeywordView = 'ungrouped',
    sort: SortParams = { column: 'volume', direction: 'desc' },
    filters: FilterParams = {
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
    },
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
    projectIdNum,
    includeMatchType,
    excludeMatchType,
    dispatch,
    detailDispatch,
    addSnackbarMessage,
    apiCache,
    getSerpFeatures
  ]);

  const fetchChildren = useCallback(async (groupId: string) => {
    if (!projectIdStr) return [];
    try {
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

  const fetchInitialData = useCallback(async (
    paginationLimit: number,
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams,
    startProcessingCheck: () => void
  ) => {
    if (!projectIdStr) return;

    detailDispatch({
      type: 'updateProcessing',
      payload: { isLoadingData: true },
    });
    try {
      const queryParams = new URLSearchParams({
        page: '1',
        limit: paginationLimit.toString(),
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
          const processingStatusData = initialData.processingStatus as {
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
              processingStatus: processingStatusData.status ?? 'idle',
              processingProgress: processingStatusData.progress || 0,
              processingMessage: processingStatusData.message || '',
              processingCurrentFile: processingStatusData.currentFileName ?? null,
              processingQueue: processingStatusData.queuedFiles ?? [],
              processingQueuedJobs: processingStatusData.queuedJobs ?? 0,
              processingRunningJobs: processingStatusData.runningJobs ?? 0,
              processingFileErrors: processingStatusData.fileErrors ?? [],
              uploadedFileCount: processingStatusData.uploadedFileCount ?? 0,
              processedFileCount: processingStatusData.processedFileCount ?? 0,
              uploadedFiles: processingStatusData.uploadedFiles ?? [],
              processedFiles: processingStatusData.processedFiles ?? [],
              processingLocked: Boolean(processingStatusData.locked),
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
      fetchKeywords(1, paginationLimit, activeView, sortParams, filterParams);
    } finally {
      detailDispatch({
        type: 'updateProcessing',
        payload: { isLoadingData: false },
      });
    }
  }, [projectIdStr, dispatch, projectIdNum, addSnackbarMessage, fetchKeywords, detailDispatch]);

  return {
    fetchProjectStats,
    fetchKeywords,
    fetchChildren,
    fetchInitialData,
    getSerpFeatures,
  };
}
