"use client";

import { useCallback, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import apiClient from '@/lib/apiClient';
import { setKeywordsForView, setProjectStats } from '@/store/projectSlice';
import type {
  ActiveKeywordView,
  Keyword,
  PaginationInfo,
  ProcessingStatus,
  SortParams,
} from '../components/types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
}

export interface KeywordFilters {
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
}

interface FetchKeywordsOptions {
  page?: number;
  limit?: number;
  view?: ActiveKeywordView;
  sort: SortParams;
  filters: KeywordFilters;
  includeMatchType: 'any' | 'all';
  excludeMatchType: 'any' | 'all';
  forceRefresh?: boolean;
}

interface FetchInitialDataOptions {
  activeView: ActiveKeywordView;
  paginationLimit: number;
}

interface ProcessingStatusPayload {
  status?: ProcessingStatus;
  progress?: number;
  message?: string;
  currentFileName?: string | null;
  queuedFiles?: string[];
}

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

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

type SerpFeatureValue = string[] | string | null | undefined;

type SerpFeatureCarrier = { serpFeatures?: SerpFeatureValue };

function getSerpFeatures(
  keyword: Keyword | SerpFeatureCarrier | null | undefined
): string[] {
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

export function useProjectKeywords({
  projectIdNum,
  projectIdStr,
  addSnackbarMessage,
}: {
  projectIdNum: number;
  projectIdStr: string;
  addSnackbarMessage: (text: string, type: 'success' | 'error' | 'info') => void;
}) {
  const dispatch = useDispatch();
  const apiCache = useMemo(() => new ApiCache(), []);
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
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 250,
    pages: 0,
  });
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const fetchProjectStats = useCallback(async () => {
    if (!projectIdStr) return;
    try {
      const statsData = await apiClient.fetchSingleProjectStats(projectIdStr);
      const nextStats = {
        ungroupedCount: statsData.ungroupedCount || 0,
        groupedKeywordsCount: statsData.groupedKeywordsCount || 0,
        groupedPages: statsData.groupedPages || 0,
        confirmedKeywordsCount: statsData.confirmedKeywordsCount || 0,
        confirmedPages: statsData.confirmedPages || 0,
        blockedCount: statsData.blockedCount || 0,
        totalParentKeywords: statsData.totalParentKeywords || 0,
        totalKeywords:
          statsData.totalKeywords ||
          (statsData.ungroupedCount +
            statsData.groupedKeywordsCount +
            (statsData.confirmedKeywordsCount ?? 0) +
            statsData.blockedCount),
      };
      setStats(nextStats);
      dispatch(
        setProjectStats({
          projectId: projectIdStr,
          stats: statsData,
        })
      );
    } catch (error) {
      console.error('Error fetching project stats:', error);
      addSnackbarMessage(
        'Error fetching stats: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    }
  }, [projectIdStr, addSnackbarMessage, dispatch]);

  const fetchKeywords = useCallback(
    async ({
      page = pagination.page,
      limit = pagination.limit,
      view,
      sort,
      filters,
      includeMatchType,
      excludeMatchType,
      forceRefresh = false,
    }: FetchKeywordsOptions) => {
      if (!projectIdStr || !view) return;
      setIsTableLoading(true);
      const requestedPage = page;

      try {
        const hasActiveFilters =
          filters.tokens.length > 0 ||
          filters.include ||
          filters.exclude ||
          filters.minVolume !== '' ||
          filters.maxVolume !== '' ||
          filters.minLength !== '' ||
          filters.maxLength !== '' ||
          filters.minDifficulty !== '' ||
          filters.maxDifficulty !== '' ||
          filters.minRating !== '' ||
          filters.maxRating !== '' ||
          (filters.serpFeatures && filters.serpFeatures.length > 0);

        const cacheKey = [projectIdStr, view, page, limit, JSON.stringify(filters)].join('-');
        const totalCountKey = [projectIdStr, view, 'total', JSON.stringify(filters)].join('-');
        const cachedKeywords = !forceRefresh ? apiCache.get<Keyword[]>(cacheKey) : null;
        const cachedTotalCount = !forceRefresh ? apiCache.get<number>(totalCountKey) : null;

        if (cachedKeywords && cachedTotalCount !== null && !forceRefresh) {
          const totalPages = Math.max(1, Math.ceil(cachedTotalCount / limit));
          const validPage = Math.min(requestedPage, totalPages);

          dispatch(
            setKeywordsForView({
              projectId: projectIdStr,
              view,
              keywords: cachedKeywords.map((kw) => ({
                ...kw,
                original_volume: kw.volume || 0,
                project_id: projectIdNum,
                status: view === 'confirmed' ? 'confirmed' : (view as 'ungrouped' | 'grouped' | 'blocked'),
              })),
              totalCount: cachedTotalCount,
            })
          );

          setPagination({
            total: cachedTotalCount,
            page: validPage,
            limit,
            pages: totalPages,
          });

          setIsTableLoading(false);
          return;
        }

        if ((view === 'grouped' || view === 'confirmed') && hasActiveFilters && (forceRefresh || !cachedKeywords)) {
          const largeLimit = 10000;
          const largeQueryParams = new URLSearchParams({
            page: '1',
            limit: largeLimit.toString(),
            status: view,
            sort: sort.column,
            direction: sort.direction,
            includeMatchType,
            excludeMatchType,
          });
          if (filters.tokens?.length > 0) {
            filters.tokens.forEach((token) => largeQueryParams.append('tokens', token));
          }

          if (filters.include) largeQueryParams.set('include', filters.include);
          if (filters.exclude) largeQueryParams.set('exclude', filters.exclude);
          if (filters.minVolume !== '') largeQueryParams.set('minVolume', filters.minVolume.toString());
          if (filters.maxVolume !== '') largeQueryParams.set('maxVolume', filters.maxVolume.toString());
          if (filters.minLength !== '') largeQueryParams.set('minLength', filters.minLength.toString());
          if (filters.maxLength !== '') largeQueryParams.set('maxLength', filters.maxLength.toString());
          if (filters.minDifficulty !== '') {
            largeQueryParams.set('minDifficulty', filters.minDifficulty.toString());
          }
          if (filters.maxDifficulty !== '') {
            largeQueryParams.set('maxDifficulty', filters.maxDifficulty.toString());
          }
          if (filters.minRating !== '') largeQueryParams.set('minRating', filters.minRating.toString());
          if (filters.maxRating !== '') largeQueryParams.set('maxRating', filters.maxRating.toString());

          if (filters.serpFeatures?.length > 0) {
            filters.serpFeatures.forEach((feature) => largeQueryParams.append('serpFeatures', feature));
          }
          const largeData = await apiClient.fetchKeywords(projectIdStr, largeQueryParams, true);
          let allKeywords: Keyword[] = [];
          if ((view as string) === 'ungrouped') allKeywords = largeData.ungroupedKeywords || [];
          else if (view === 'grouped') allKeywords = largeData.groupedKeywords || [];
          else if (view === 'confirmed') allKeywords = largeData.confirmedKeywords || [];
          else if (view === 'blocked') allKeywords = largeData.blockedKeywords || [];
          let filteredResults = [...allKeywords];
          if (filters.tokens.length > 0) {
            filteredResults = filteredResults.filter((keyword) =>
              filters.tokens.every((token) => (keyword.tokens || []).includes(token))
            );
          }

          if (filters.include) {
            const includeTerms = filters.include.split(',').map((t) => t.trim().toLowerCase());
            filteredResults = filteredResults.filter((keyword) => {
              const keywordLower = (keyword.keyword || '').toLowerCase();
              const searchText =
                (view === 'grouped' || view === 'confirmed') && keyword.groupName
                  ? keywordLower + ' ' + keyword.groupName.toLowerCase()
                  : keywordLower;

              return includeMatchType === 'any'
                ? includeTerms.some((term) => searchText.includes(term))
                : includeTerms.every((term) => searchText.includes(term));
            });
          }

          if (filters.exclude) {
            const excludeTerms = filters.exclude.split(',').map((t) => t.trim().toLowerCase());
            filteredResults = filteredResults.filter((keyword) => {
              const keywordLower = (keyword.keyword || '').toLowerCase();
              const searchText =
                (view === 'grouped' || view === 'confirmed') && keyword.groupName
                  ? keywordLower + ' ' + keyword.groupName.toLowerCase()
                  : keywordLower;

              return excludeMatchType === 'any'
                ? !excludeTerms.some((term) => searchText.includes(term))
                : !excludeTerms.every((term) => searchText.includes(term));
            });
          }

          if (filters.serpFeatures && filters.serpFeatures.length > 0) {
            filteredResults = filteredResults.filter((keyword) => {
              const serpFeatures = getSerpFeatures(keyword);
              return filters.serpFeatures.every((feature) => serpFeatures.includes(feature));
            });
          }

          if (filters.minVolume !== '') {
            filteredResults = filteredResults.filter((keyword) => (keyword.volume || 0) >= Number(filters.minVolume));
          }

          if (filters.maxVolume !== '') {
            filteredResults = filteredResults.filter((keyword) => (keyword.volume || 0) <= Number(filters.maxVolume));
          }

          if (filters.minLength !== '') {
            filteredResults = filteredResults.filter((keyword) => (keyword.length || 0) >= Number(filters.minLength));
          }

          if (filters.maxLength !== '') {
            filteredResults = filteredResults.filter((keyword) => (keyword.length || 0) <= Number(filters.maxLength));
          }

          if (filters.minDifficulty !== '') {
            filteredResults = filteredResults.filter(
              (keyword) => (keyword.difficulty || 0) >= Number(filters.minDifficulty)
            );
          }

          if (filters.maxDifficulty !== '') {
            filteredResults = filteredResults.filter(
              (keyword) => (keyword.difficulty || 0) <= Number(filters.maxDifficulty)
            );
          }

          if (filters.minRating !== '') {
            filteredResults = filteredResults.filter((keyword) => (keyword.rating || 0) >= Number(filters.minRating));
          }

          if (filters.maxRating !== '') {
            filteredResults = filteredResults.filter((keyword) => (keyword.rating || 0) <= Number(filters.maxRating));
          }

          const totalItems = filteredResults.length;
          const totalPages = Math.max(1, Math.ceil(totalItems / limit));
          const validPage = Math.min(Math.max(1, requestedPage), totalPages);

          apiCache.set(totalCountKey, totalItems);

          const startIndex = (validPage - 1) * limit;
          const endIndex = Math.min(startIndex + limit, totalItems);
          const pagedResults = filteredResults.slice(startIndex, endIndex);

          apiCache.set(cacheKey, pagedResults);

          dispatch(
            setKeywordsForView({
              projectId: projectIdStr,
              view,
              keywords: pagedResults.map((kw) => ({
                ...kw,
                original_volume: kw.volume || 0,
                project_id: projectIdNum,
                status: view === 'confirmed' ? 'confirmed' : (view as 'ungrouped' | 'grouped' | 'blocked'),
              })),
              totalCount: totalItems,
            })
          );

          setPagination({
            total: totalItems,
            page: validPage,
            limit,
            pages: totalPages,
          });

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
          filters.tokens.forEach((token) => queryParams.append('tokens', token));
        }
        if (filters.include) queryParams.set('include', filters.include);
        if (filters.exclude) queryParams.set('exclude', filters.exclude);
        if (filters.minVolume !== '') queryParams.set('minVolume', filters.minVolume.toString());
        if (filters.maxVolume !== '') queryParams.set('maxVolume', filters.maxVolume.toString());
        if (filters.minLength !== '') queryParams.set('minLength', filters.minLength.toString());
        if (filters.maxLength !== '') queryParams.set('maxLength', filters.maxLength.toString());
        if (filters.minDifficulty !== '') queryParams.set('minDifficulty', filters.minDifficulty.toString());
        if (filters.maxDifficulty !== '') queryParams.set('maxDifficulty', filters.maxDifficulty.toString());
        if (filters.minRating !== '') queryParams.set('minRating', filters.minRating.toString());
        if (filters.maxRating !== '') queryParams.set('maxRating', filters.maxRating.toString());

        if (filters.serpFeatures?.length > 0) {
          filters.serpFeatures.forEach((feature) => queryParams.append('serpFeatures', feature));
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

        dispatch(
          setKeywordsForView({
            projectId: projectIdStr,
            view,
            keywords: keywords.map((kw) => ({
              ...kw,
              original_volume: kw.volume || 0,
              project_id: projectIdNum,
              status: view === 'confirmed' ? 'confirmed' : (view as 'ungrouped' | 'grouped' | 'blocked'),
            })),
            totalCount: totalItems,
          })
        );
        setPagination({
          total: totalItems,
          page: validPage,
          limit,
          pages: totalPages,
        });
      } catch (error) {
        console.error('Error fetching keywords:', error);
        addSnackbarMessage(
          'Error loading keywords: ' + (isError(error) ? error.message : 'Unknown error'),
          'error'
        );
      } finally {
        setIsTableLoading(false);
      }
    },
    [
      projectIdStr,
      pagination.page,
      pagination.limit,
      projectIdNum,
      dispatch,
      addSnackbarMessage,
      apiCache,
    ]
  );

  const fetchChildren = useCallback(
    async (groupId: string) => {
      if (!projectIdStr) return [];
      try {
        const data = await apiClient.fetchChildren(projectIdStr, groupId);
        return data.children;
      } catch (error) {
        console.error('Error fetching children:', error);
        addSnackbarMessage(
          'Error loading children: ' + (isError(error) ? error.message : 'Unknown error'),
          'error'
        );
        return [];
      }
    },
    [projectIdStr, addSnackbarMessage]
  );

  const fetchInitialData = useCallback(
    async ({ activeView, paginationLimit }: FetchInitialDataOptions): Promise<ProcessingStatusPayload | null> => {
      if (!projectIdStr) return null;
      setIsLoadingData(true);
      try {
        const queryParams = new URLSearchParams({
          page: '1',
          limit: paginationLimit.toString(),
          status: activeView,
        });

        const initialData = await apiClient.fetchInitialData(
          projectIdStr + '?' + queryParams.toString()
        );

        if (initialData) {
          if (initialData.stats) {
            dispatch(
              setProjectStats({
                projectId: projectIdStr,
                stats: initialData.stats,
              })
            );
            setStats({
              ungroupedCount: initialData.stats.ungroupedCount || 0,
              groupedKeywordsCount: initialData.stats.groupedKeywordsCount || 0,
              groupedPages: initialData.stats.groupedPages || 0,
              confirmedKeywordsCount: initialData.stats.confirmedKeywordsCount || 0,
              confirmedPages: initialData.stats.confirmedPages || 0,
              blockedCount: initialData.stats.blockedCount || 0,
              totalParentKeywords: initialData.stats.totalParentKeywords || 0,
              totalKeywords:
                initialData.stats.totalKeywords ||
                (initialData.stats.ungroupedCount +
                  initialData.stats.groupedKeywordsCount +
                  (initialData.stats.confirmedKeywordsCount ?? 0) +
                  initialData.stats.blockedCount),
            });
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

            dispatch(
              setKeywordsForView({
                projectId: projectIdStr,
                view: activeView,
                keywords: transformedKeywords,
                totalCount: initialData.pagination?.total,
              })
            );
          }
          if (initialData.pagination) {
            setPagination(initialData.pagination);
          }

          if (initialData.processingStatus?.status) {
            const processingStatus = initialData.processingStatus as ProcessingStatusPayload;
            return processingStatus;
          }
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
        const errorMessage = isError(error) ? error.message : String(error);
        addSnackbarMessage('Error loading initial data: ' + errorMessage, 'error');
      } finally {
        setIsLoadingData(false);
      }
      return null;
    },
    [projectIdStr, dispatch, projectIdNum, addSnackbarMessage]
  );

  return {
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
    invalidateCache: (pattern: string) => apiCache.invalidate(pattern),
    invalidateCacheByView: (view: string) => apiCache.invalidateByView(projectIdStr, view),
    clearCache: () => apiCache.clear(),
  };
}
