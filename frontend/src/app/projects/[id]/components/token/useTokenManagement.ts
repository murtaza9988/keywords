"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { debounce } from 'lodash';

import apiClient from '@/lib/apiClient';
import { selectBlockedKeywordsForProject, selectGroupedKeywordsForProject, selectUngroupedKeywordsForProject } from '@/store/projectSlice';
import { RootState } from '@/store/store';

import type {
  Keyword,
  PaginationInfo,
  TokenActiveView,
  TokenData,
  TokenSortParams,
  UseTokenManagementParams,
  UseTokenManagementResult,
} from './types';

const TOKEN_LIMIT_OPTIONS = [100, 250, 500];
const MINIMUM_SEARCH_LENGTH = 2;

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function useTokenManagement({
  projectId,
  onBlockTokenSuccess,
  onUnblockTokenSuccess,
  onTokenDataChange,
  addSnackbarMessage,
  activeViewKeywords,
  toggleTokenSelection,
  activeView,
}: UseTokenManagementParams): UseTokenManagementResult {
  const [activeTokenView, setActiveTokenView] = useState<TokenActiveView>('current');
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 250,
    pages: 0,
  });
  const [sortParams, setSortParams] = useState<TokenSortParams>({ column: 'volume', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [effectiveSearchTerm, setEffectiveSearchTerm] = useState('');
  const searchInputRef = useRef('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [selectedTokenNames, setSelectedTokenNames] = useState<Set<string>>(new Set());
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const tokenCacheRef = useRef<Map<string, { tokens: TokenData[]; pagination: PaginationInfo }>>(new Map());

  const ungroupedKeywords = useSelector((state: RootState) => selectUngroupedKeywordsForProject(state, projectId));
  const groupedKeywords = useSelector((state: RootState) => selectGroupedKeywordsForProject(state, projectId));
  const blockedKeywords = useSelector((state: RootState) => selectBlockedKeywordsForProject(state, projectId));

  const getCurrentViewKeywords = useCallback(() => {
    if (activeTokenView === 'current') {
      let currentKeywords: Keyword[];
      switch (activeView) {
        case 'ungrouped':
          currentKeywords = ungroupedKeywords;
          break;
        case 'grouped':
          currentKeywords = groupedKeywords;
          break;
        case 'blocked':
          currentKeywords = blockedKeywords;
          break;
        default:
          currentKeywords = [];
      }

      if (currentKeywords.length === 0 && activeViewKeywords.length > 0) {
        currentKeywords = activeViewKeywords
          .flatMap((token) => {
            const tokenList = Array.isArray(token.tokens) ? token.tokens : [];
            return tokenList.map((tokenItem): Keyword => ({
              id: 0,
              keyword: tokenItem,
              volume: token.volume || 0,
              difficulty: token.difficulty || 0,
              original_volume: token.volume || 0,
              project_id: parseInt(projectId, 10),
              tokens: [],
              isParent: false,
              groupId: '0',
              groupName: '',
              status: activeView,
              childCount: 0,
              serpFeatures: [],
              length: (tokenItem || '').length,
            }));
          })
          .filter((keyword) => Boolean(keyword.keyword));
      }

      return currentKeywords;
    }

    if (activeTokenView === 'all') {
      return [...ungroupedKeywords, ...groupedKeywords, ...blockedKeywords];
    }

    if (activeTokenView === 'blocked') {
      return blockedKeywords;
    }

    if (activeTokenView === 'merged') {
      return [...ungroupedKeywords, ...groupedKeywords, ...blockedKeywords];
    }

    return [];
  }, [activeTokenView, activeView, activeViewKeywords, ungroupedKeywords, groupedKeywords, blockedKeywords, projectId]);

  const fetchTokens = useCallback(
    async (view: TokenActiveView, page: number, limit: number, search: string) => {
      if (!projectId) return;

      const cacheKey = [view, page, limit, search, sortParams.column, sortParams.direction, activeView].join('|');
      const cached = tokenCacheRef.current.get(cacheKey);
      if (cached) {
        setTokens(cached.tokens);
        setPagination(cached.pagination);
      }

      const shouldShowLoading = !cached;

      if (view === 'current') {
        if (shouldShowLoading) {
          setIsLoading(true);
        }
        try {
          let currentTokens = activeViewKeywords.map((keyword) => ({
            tokenName: keyword.tokenName,
            volume: keyword.volume || 0,
            difficulty: keyword.difficulty || 0,
            count: keyword.count?.toString() || (keyword.tokens ? keyword.tokens.length.toString() : '0'),
            tokens: keyword.tokens || [],
            isParent: keyword.isParent || false,
            hasChildren: keyword.hasChildren || false,
            childTokens: keyword.childTokens || [],
          }));
          const searchTerms = search
            .split(',')
            .map((term) => term.trim())
            .filter((term) => term.length > 0);
          if (searchTerms.length > 0) {
            currentTokens = currentTokens.filter((token) =>
              searchTerms.some((term) => token.tokenName.toLowerCase().includes(term.toLowerCase()))
            );
          }

          currentTokens.sort((a, b) => {
            let aValue: number;
            let bValue: number;
            switch (sortParams.column) {
              case 'volume':
                aValue = a.volume || 0;
                bValue = b.volume || 0;
                break;
              case 'difficulty':
                aValue = a.difficulty || 0;
                bValue = b.difficulty || 0;
                break;
              case 'count':
                aValue = parseInt(a.count || '0', 10);
                bValue = parseInt(b.count || '0', 10);
                break;
              default:
                return sortParams.direction === 'asc'
                  ? a.tokenName.localeCompare(b.tokenName)
                  : b.tokenName.localeCompare(a.tokenName);
            }
            return sortParams.direction === 'asc' ? aValue - bValue : bValue - aValue;
          });

          const total = currentTokens.length;
          const pages = Math.max(1, Math.ceil(total / limit));
          const currentPage = Math.min(page, pages);
          const start = (currentPage - 1) * limit;

          let paginatedTokens: TokenData[] = [];
          if (total > 0) {
            paginatedTokens = currentTokens.slice(start, Math.min(start + limit, currentTokens.length));
          }

          const nextPagination = {
            total,
            page: currentPage,
            limit,
            pages,
          };

          setTokens(paginatedTokens);
          setPagination(nextPagination);
          tokenCacheRef.current.set(cacheKey, { tokens: paginatedTokens, pagination: nextPagination });

          return;
        } catch (err) {
          console.error('Error processing local tokens:', err);
        } finally {
          setIsLoading(false);
        }
      }

      if (shouldShowLoading) {
        setIsLoading(true);
      }

      try {
        const searchTerms = search
          .split(',')
          .map((term) => term.trim())
          .filter((term) => term.length > 0);

        if (view === 'merged') {
          const queryParams = new URLSearchParams({
            view: 'all',
            page: page.toString(),
            limit: limit.toString(),
            sort: sortParams.column,
            direction: sortParams.direction,
            show_merged: 'true',
          });

          if (searchTerms.length > 0) {
            queryParams.append('search', searchTerms.join(','));
          }

          const response = await apiClient.fetchTokens(projectId, queryParams);
          const mergedTokens = (response.tokens || [])
            .filter((token) => token.isParent)
            .map((token) => ({
              count: token.count?.toString() || '0',
              tokenName: token.tokenName || '',
              volume: token.volume || 0,
              difficulty: token.difficulty || 0,
              hasChildren: token.hasChildren || false,
              isParent: token.isParent || false,
              childTokens: token.childTokens || [],
              tokens: token.tokens || [],
            }));

          const total = mergedTokens.length;
          const pages = Math.max(1, Math.ceil(total / limit));
          const adjustedPage = Math.min(page, pages || 1);

          setTokens(mergedTokens);
          const nextPagination = {
            total,
            page: adjustedPage,
            limit,
            pages,
          };
          setPagination(nextPagination);
          tokenCacheRef.current.set(cacheKey, { tokens: mergedTokens, pagination: nextPagination });
        } else {
          const queryParams = new URLSearchParams({
            view,
            page: page.toString(),
            limit: limit.toString(),
            sort: sortParams.column,
            direction: sortParams.direction,
          });

          if (searchTerms.length > 0) {
            queryParams.append('search', searchTerms.join(','));
          }
          if (view === 'blocked') {
            queryParams.append('blocked_by', 'user');
          }

          const response = await apiClient.fetchTokens(projectId, queryParams);
          const mergedQueryParams = new URLSearchParams({
            view: 'all',
            page: '1',
            limit: '1000',
            show_merged: 'true',
          });

          const mergedResponse = await apiClient.fetchTokens(projectId, mergedQueryParams);
          const mergedChildTokens = new Set();

          (mergedResponse.tokens || []).forEach((token) => {
            if (token.isParent && token.childTokens) {
              token.childTokens.forEach((childToken) => {
                mergedChildTokens.add(childToken);
              });
            }
          });

          const tokensWithCount = (response.tokens || [])
            .filter((token) => !mergedChildTokens.has(token.tokenName))
            .map((token) => ({
              count: token.count?.toString() || '0',
              tokenName: token.tokenName || '',
              volume: token.volume || 0,
              difficulty: token.difficulty || 0,
              hasChildren: token.hasChildren || false,
              isParent: token.isParent || false,
              childTokens: token.childTokens || [],
              tokens: token.tokens || [],
            }));
          const total = response.pagination?.total || tokensWithCount.length;
          const pages = Math.max(1, response.pagination?.pages || Math.ceil(total / limit));
          const adjustedPage = Math.min(page, pages || 1);

          setTokens(tokensWithCount);
          const nextPagination = {
            total,
            page: adjustedPage,
            limit,
            pages,
          };
          setPagination(nextPagination);
          tokenCacheRef.current.set(cacheKey, { tokens: tokensWithCount, pagination: nextPagination });
        }
      } catch (error) {
        console.error('Error fetching tokens:', error);
        addSnackbarMessage(`Error loading tokens: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, sortParams, addSnackbarMessage, activeViewKeywords, activeView]
  );

  useEffect(() => {
    fetchTokens(activeTokenView, pagination.page, pagination.limit, effectiveSearchTerm);
  }, [fetchTrigger, activeTokenView, pagination.page, pagination.limit, effectiveSearchTerm, fetchTokens]);

  useEffect(() => {
    setFetchTrigger((prev) => prev + 1);
  }, []);

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        if (value.length >= MINIMUM_SEARCH_LENGTH || value === '') {
          setEffectiveSearchTerm(value);
          setFetchTrigger((prev) => prev + 1);
        }
      }, 500),
    []
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newSearch = event.target.value;
    setSearchTerm(newSearch);
    searchInputRef.current = newSearch;
    debouncedSearch(newSearch);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    searchInputRef.current = '';
    setEffectiveSearchTerm('');
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFetchTrigger((prev) => prev + 1);
  };

  const handleMergeSelected = async () => {
    const tokensToMerge = Array.from(selectedTokenNames);
    if (tokensToMerge.length < 2) {
      addSnackbarMessage('Select at least 2 tokens to merge.', 'error');
      return;
    }

    setIsProcessingAction(true);

    try {
      const tokensArray = tokens.filter((token) => selectedTokenNames.has(token.tokenName));
      tokensArray.sort((a, b) => (b.volume || 0) - (a.volume || 0));
      const parentToken = tokensArray[0].tokenName;
      const childTokens = tokensArray.slice(1).map((token) => token.tokenName);
      await apiClient.mergeTokens(projectId, parentToken, childTokens);
      addSnackbarMessage(
        `Successfully merged ${childTokens.length + 1} tokens under "${parentToken}".`,
        'success'
      );
      setSelectedTokenNames(new Set());
      setIsLoading(true);
      setFetchTrigger((prev) => prev + 1);
      onTokenDataChange();
    } catch (error) {
      addSnackbarMessage(`Error merging tokens: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleViewChange = (newView: TokenActiveView) => {
    if (activeTokenView !== newView) {
      setActiveTokenView(newView);
      setPagination((prev) => ({ ...prev, page: 1 }));
      setSelectedTokenNames(new Set());
      setFetchTrigger((prev) => prev + 1);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage !== pagination.page && newPage >= 1 && newPage <= pagination.pages && !isLoading) {
      setPagination((prev) => ({ ...prev, page: newPage }));
      setFetchTrigger((prev) => prev + 1);
    }
  };

  const handleLimitChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    if (!isNaN(newLimit) && newLimit !== pagination.limit) {
      setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
      setFetchTrigger((prev) => prev + 1);
    }
  };

  const toggleLocalTokenSelection = (tokenName: string) => {
    setSelectedTokenNames((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tokenName)) newSet.delete(tokenName);
      else newSet.add(tokenName);
      return newSet;
    });
  };

  const handleSelectAllClick = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedTokenNames(new Set(tokens.map((token) => token.tokenName)));
    } else {
      setSelectedTokenNames(new Set());
    }
  };

  const toggleTokenExpansion = (tokenName: string) => {
    setExpandedTokens((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tokenName)) newSet.delete(tokenName);
      else newSet.add(tokenName);
      return newSet;
    });
  };

  const handleBlockSelected = async () => {
    const tokensToBlock = Array.from(selectedTokenNames);
    if (tokensToBlock.length === 0) {
      addSnackbarMessage('No tokens selected to block.', 'error');
      return;
    }
    setIsProcessingAction(true);
    try {
      const response = await apiClient.blockTokens(projectId, tokensToBlock);
      addSnackbarMessage(
        `Successfully blocked ${response.count} keywords for ${tokensToBlock.length} token(s).`,
        'success'
      );
      setSelectedTokenNames(new Set());
      setIsLoading(true);
      setFetchTrigger((prev) => prev + 1);
      onBlockTokenSuccess();
      onTokenDataChange();
    } catch (error) {
      addSnackbarMessage(`Error blocking tokens: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleUnblockSelected = async () => {
    const tokensToUnblock = Array.from(selectedTokenNames);
    if (tokensToUnblock.length === 0) {
      addSnackbarMessage('No tokens selected to unblock.', 'error');
      return;
    }
    setIsProcessingAction(true);
    try {
      const response = await apiClient.unblockTokens(projectId, tokensToUnblock);
      addSnackbarMessage(`Successfully unblocked ${response.count} token(s).`, 'success');
      setSelectedTokenNames(new Set());
      setIsLoading(true);
      setFetchTrigger((prev) => prev + 1);
      onUnblockTokenSuccess();
      onTokenDataChange();
    } catch (error) {
      addSnackbarMessage(`Error unblocking tokens: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleBlockSingleToken = async (tokenName: string) => {
    setIsProcessingAction(true);
    try {
      const response = await apiClient.blockTokens(projectId, [tokenName]);
      addSnackbarMessage(
        `Successfully blocked ${response.count} keywords for token "${tokenName}".`,
        'success'
      );
      setIsLoading(true);
      setFetchTrigger((prev) => prev + 1);
      onBlockTokenSuccess();
    } catch (error) {
      addSnackbarMessage(
        `Error blocking token "${tokenName}": ${isError(error) ? error.message : 'Unknown error'}`,
        'error'
      );
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCreateToken = useCallback(() => {
    if (!searchTerm.trim()) {
      addSnackbarMessage('Please enter a search term first', 'error');
      return;
    }

    const defaultTokenName = searchTerm.replace(/\s+/g, '').toLowerCase();

    if (!newTokenName) {
      setNewTokenName(defaultTokenName);
    }

    setShowCreateToken(true);
  }, [searchTerm, addSnackbarMessage, newTokenName]);

  const handleConfirmCreateToken = useCallback(async () => {
    if (!newTokenName.trim()) {
      addSnackbarMessage('Token name cannot be empty', 'error');
      return;
    }

    setIsCreatingToken(true);

    try {
      const response = await apiClient.createToken(projectId, searchTerm, newTokenName);
      addSnackbarMessage(
        `Successfully created token "${newTokenName}" for "${searchTerm}" in ${response.affected_keywords} keywords`,
        'success'
      );
      setShowCreateToken(false);
      setNewTokenName('');
      setIsLoading(true);
      setFetchTrigger((prev) => prev + 1);
      onTokenDataChange();
    } catch (error) {
      addSnackbarMessage(`Error creating token: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsCreatingToken(false);
    }
  }, [projectId, searchTerm, newTokenName, addSnackbarMessage, onTokenDataChange]);

  const handleCancelCreateToken = () => {
    setShowCreateToken(false);
    setNewTokenName('');
  };

  const handleUnblockSingleToken = async (tokenName: string) => {
    setIsProcessingAction(true);
    try {
      const response = await apiClient.unblockTokens(projectId, [tokenName]);
      addSnackbarMessage(`Successfully unblocked token "${tokenName}".`, 'success');
      setIsLoading(true);
      setFetchTrigger((prev) => prev + 1);
      onUnblockTokenSuccess();
      onTokenDataChange();
    } catch (error) {
      addSnackbarMessage(
        `Error unblocking token "${tokenName}": ${isError(error) ? error.message : 'Unknown error'}`,
        'error'
      );
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleUnmergeToken = async (tokenName: string) => {
    setIsProcessingAction(true);

    try {
      await apiClient.unmergeToken(projectId, tokenName);
      addSnackbarMessage(`Successfully unmerged token "${tokenName}".`, 'success');
      setIsLoading(true);
      setFetchTrigger((prev) => prev + 1);
      onTokenDataChange();
      setExpandedTokens((prev) => {
        const newSet = new Set(prev);
        newSet.delete(tokenName);
        return newSet;
      });
    } catch (error) {
      addSnackbarMessage(
        `Error unmerging token "${tokenName}": ${isError(error) ? error.message : 'Unknown error'}`,
        'error'
      );
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSort = (column: string) => {
    setSortParams((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'asc' };
    });
    setIsLoading(true);
    setFetchTrigger((prev) => prev + 1);
  };

  const handleTokenClick = (tokenName: string) => {
    toggleTokenSelection(tokenName);
  };

  const getTopKeywords = useCallback(
    (token: TokenData) => {
      let keywords: Keyword[] = [];

      if (activeTokenView === 'current') {
        switch (activeView) {
          case 'ungrouped':
            keywords = ungroupedKeywords;
            break;
          case 'grouped':
            keywords = groupedKeywords;
            break;
          case 'blocked':
            keywords = blockedKeywords;
            break;
          default:
            keywords = [];
        }
      } else {
        keywords = getCurrentViewKeywords();
      }

      if (!keywords || keywords.length === 0) {
        return [];
      }

      return keywords
        .filter((keyword) => {
          const keywordLower = keyword.keyword.toLowerCase();
          const tokenLower = token.tokenName.toLowerCase();
          return keywordLower.includes(tokenLower);
        })
        .map((keyword) => ({
          tokenName: keyword.keyword,
          volume: keyword.volume || 0,
          difficulty: keyword.difficulty || 0,
        }))
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, 10);
    },
    [activeTokenView, activeView, ungroupedKeywords, groupedKeywords, blockedKeywords, getCurrentViewKeywords]
  );

  const handleUnmergeIndividualToken = async (parentToken: string, childToken: string) => {
    setIsProcessingAction(true);

    try {
      await apiClient.unmergeIndividualToken(projectId, parentToken, childToken);
      addSnackbarMessage(`Successfully unmerged "${childToken}" from "${parentToken}".`, 'success');
      setIsLoading(true);
      setFetchTrigger((prev) => prev + 1);
      onTokenDataChange();
    } catch (error) {
      addSnackbarMessage(`Error unmerging token: ${isError(error) ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const showMinimumCharInfo = searchTerm.length > 0 && searchTerm.length < MINIMUM_SEARCH_LENGTH;

  return {
    activeTokenView,
    tokens,
    pagination,
    sortParams,
    searchTerm,
    showMinimumCharInfo,
    isLoading,
    isProcessingAction,
    selectedTokenNames,
    expandedTokens,
    hoveredToken,
    showCreateToken,
    newTokenName,
    isCreatingToken,
    handleSearchChange,
    handleClearSearch,
    handleMergeSelected,
    handleViewChange,
    handlePageChange,
    handleLimitChange,
    handleSelectAllClick,
    toggleLocalTokenSelection,
    toggleTokenExpansion,
    handleBlockSelected,
    handleUnblockSelected,
    handleBlockSingleToken,
    handleCreateToken,
    handleConfirmCreateToken,
    handleCancelCreateToken,
    handleUnblockSingleToken,
    handleUnmergeToken,
    handleSort,
    handleTokenClick,
    getTopKeywords,
    handleUnmergeIndividualToken,
    setHoveredToken,
    setNewTokenName,
  };
}

export { MINIMUM_SEARCH_LENGTH, TOKEN_LIMIT_OPTIONS };
