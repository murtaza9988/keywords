"use client";

import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import apiClient from '@/lib/apiClient';
import { setChildrenForGroup, setKeywordsForView, setProjectStats } from '@/store/projectSlice';
import type { Keyword, ActiveKeywordView, SortParams } from '../components/types';
import type { KeywordFilters } from './useProjectKeywords';

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function useKeywordActions({
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
}: {
  projectIdStr: string;
  activeView: ActiveKeywordView;
  pagination: { page: number; limit: number; total: number };
  sortParams: SortParams;
  selectedTokens: string[];
  includeFilter: string;
  excludeFilter: string;
  includeMatchType: 'any' | 'all';
  excludeMatchType: 'any' | 'all';
  minVolume: string;
  maxVolume: string;
  minLength: string;
  maxLength: string;
  minDifficulty: string;
  maxDifficulty: string;
  minRating: string;
  maxRating: string;
  selectedSerpFeatures: string[];
  groupName: string;
  selectedKeywordIds: Set<number>;
  filteredAndSortedKeywords: Keyword[];
  ungroupedKeywords: Keyword[];
  childrenCache: Record<string, Keyword[]>;
  calculateMaintainedPage: (
    currentPage: number,
    currentLimit: number,
    selectedIds: Set<number>,
    totalItemsBefore: number
  ) => number;
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
  clearCache: () => void;
  invalidateCache: (pattern: string) => void;
  addSnackbarMessage: (text: string, type: 'success' | 'error' | 'info') => void;
  bumpLogsRefresh: () => void;
  setSelectedKeywordIds: (next: Set<number>) => void;
  setGroupName: (next: string) => void;
  setExpandedGroups: (next: Set<string>) => void;
  setIsTableLoading: (isLoading: boolean) => void;
  setIsProcessingAction: (isProcessing: boolean) => void;
  toggleTokenSelection: (token: string) => void;
}) {
  const dispatch = useDispatch();
  const [isExportingParent, setIsExportingParent] = useState(false);
  const [isImportingParent, setIsImportingParent] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const buildFilters = useCallback(
    (overrides: Partial<KeywordFilters> = {}): KeywordFilters => ({
      tokens: selectedTokens,
      include: includeFilter,
      exclude: excludeFilter,
      minVolume: minVolume ? parseInt(minVolume) : '',
      maxVolume: maxVolume ? parseInt(maxVolume) : '',
      minLength: minLength ? parseInt(minLength) : '',
      maxLength: maxLength ? parseInt(maxLength) : '',
      minDifficulty: minDifficulty ? parseFloat(minDifficulty) : '',
      maxDifficulty: maxDifficulty ? parseFloat(maxDifficulty) : '',
      minRating: minRating ? parseInt(minRating) : '',
      maxRating: maxRating ? parseInt(maxRating) : '',
      serpFeatures: selectedSerpFeatures,
      ...overrides,
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
      setIsExporting(false);
    }
  }, [activeView, projectIdStr, addSnackbarMessage, bumpLogsRefresh]);

  const handleExportParentKeywords = useCallback(async () => {
    setIsExportingParent(true);
    addSnackbarMessage('Starting parent keywords export, please wait...', 'success');

    try {
      const blobData = await apiClient.exportParentKeywords(projectIdStr);
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
      setIsExportingParent(false);
    }
  }, [projectIdStr, addSnackbarMessage, bumpLogsRefresh]);

  const handleImportParentKeywords = useCallback(
    async (file: File) => {
      setIsImportingParent(true);
      addSnackbarMessage('Starting parent keywords import, please wait...', 'success');

      try {
        const formData = new FormData();
        formData.append('file', file);

        await apiClient.importParentKeywords(projectIdStr, formData);
        addSnackbarMessage('Parent keywords imported successfully', 'success');

        await fetchKeywords({
          page: pagination.page,
          limit: pagination.limit,
          view: activeView,
          sort: sortParams,
          filters: buildFilters(),
          includeMatchType,
          excludeMatchType,
          forceRefresh: true,
        });
        bumpLogsRefresh();
      } catch (error) {
        console.error('Error during parent import:', error);
        addSnackbarMessage(
          'Error importing parent keywords: ' + (isError(error) ? error.message : 'Unknown error'),
          'error'
        );
      } finally {
        setIsImportingParent(false);
      }
    },
    [
      projectIdStr,
      addSnackbarMessage,
      fetchKeywords,
      pagination.page,
      pagination.limit,
      activeView,
      sortParams,
      buildFilters,
      includeMatchType,
      excludeMatchType,
      bumpLogsRefresh,
    ]
  );

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
      dispatch(
        setKeywordsForView({
          projectId: projectIdStr,
          view: 'grouped',
          keywords: [],
        })
      );

      Object.keys(childrenCache).forEach((groupId) => {
        dispatch(setChildrenForGroup({ projectId: projectIdStr, groupId, children: [] }));
      });

      const data = await apiClient.confirmKeywords(projectIdStr, keywordIds);
      addSnackbarMessage('Confirmed ' + data.count + ' keywords', 'success');

      await Promise.all([
        fetchKeywords({
          page: maintainedPage,
          limit: pagination.limit,
          view: activeView,
          sort: sortParams,
          filters: buildFilters({
            minVolume: '',
            maxVolume: '',
            minLength: '',
            maxLength: '',
            minDifficulty: '',
            maxDifficulty: '',
            minRating: '',
            maxRating: '',
            serpFeatures: [],
          }),
          includeMatchType,
          excludeMatchType,
          forceRefresh: true,
        }),
        fetchProjectStats(),
      ]);

      bumpLogsRefresh();
      setSelectedKeywordIds(new Set());
      setGroupName('');
      setExpandedGroups(new Set());
    } catch (error) {
      addSnackbarMessage(
        'Error confirming keywords: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      setIsProcessingAction(false);
      setIsTableLoading(false);
    }
  }, [
    selectedKeywordIds,
    activeView,
    projectIdStr,
    addSnackbarMessage,
    dispatch,
    childrenCache,
    fetchKeywords,
    pagination.limit,
    pagination.total,
    pagination.page,
    sortParams,
    fetchProjectStats,
    calculateMaintainedPage,
    bumpLogsRefresh,
    buildFilters,
    includeMatchType,
    excludeMatchType,
    setSelectedKeywordIds,
    setGroupName,
    setExpandedGroups,
    setIsProcessingAction,
    setIsTableLoading,
  ]);

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
      dispatch(
        setKeywordsForView({
          projectId: projectIdStr,
          view: 'confirmed',
          keywords: [],
        })
      );

      Object.keys(childrenCache).forEach((groupId) => {
        dispatch(setChildrenForGroup({ projectId: projectIdStr, groupId, children: [] }));
      });

      const data = await apiClient.unconfirmKeywords(projectIdStr, keywordIds);
      addSnackbarMessage('Unconfirmed ' + data.count + ' keywords', 'success');

      await Promise.all([
        fetchKeywords({
          page: maintainedPage,
          limit: pagination.limit,
          view: activeView,
          sort: sortParams,
          filters: buildFilters({
            minVolume: '',
            maxVolume: '',
            minLength: '',
            maxLength: '',
            minDifficulty: '',
            maxDifficulty: '',
            minRating: '',
            maxRating: '',
            serpFeatures: [],
          }),
          includeMatchType,
          excludeMatchType,
          forceRefresh: true,
        }),
        fetchProjectStats(),
      ]);

      bumpLogsRefresh();
      setSelectedKeywordIds(new Set());
      setGroupName('');
      setExpandedGroups(new Set());
    } catch (error) {
      addSnackbarMessage(
        'Error unconfirming keywords: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      setIsProcessingAction(false);
      setIsTableLoading(false);
    }
  }, [
    selectedKeywordIds,
    activeView,
    projectIdStr,
    addSnackbarMessage,
    dispatch,
    childrenCache,
    fetchKeywords,
    pagination.limit,
    pagination.total,
    pagination.page,
    sortParams,
    fetchProjectStats,
    calculateMaintainedPage,
    bumpLogsRefresh,
    buildFilters,
    includeMatchType,
    excludeMatchType,
    setSelectedKeywordIds,
    setGroupName,
    setExpandedGroups,
    setIsProcessingAction,
    setIsTableLoading,
  ]);

  const handleGroupKeywords = useCallback(
    async (overrideGroupName?: string) => {
      const keywordIds = Array.from(selectedKeywordIds);
      const trimmedGroupName =
        overrideGroupName && typeof overrideGroupName === 'string'
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
        let messagePrefix = 'grouped';

        if (activeView === 'grouped') {
          messagePrefix = 'regrouped';
          const selectedParents = keywordIds
            .map((id) => filteredAndSortedKeywords.find((k) => k.id === id))
            .filter((k) => k && k.isParent);
          const selectedChildren: Keyword[] = [];
          for (const id of keywordIds) {
            for (const groupId in childrenCache) {
              const children = childrenCache[groupId];
              const foundChild = children.find((child) => child.id === id);
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
            setIsProcessingAction(false);
            setIsTableLoading(false);
            return;
          }
        } else {
          data = await apiClient.groupKeywords(projectIdStr, keywordIds, trimmedGroupName);
          addSnackbarMessage(
            'Successfully ' + messagePrefix + ' ' + data.count + ' keywords as "' + trimmedGroupName + '"',
            'success'
          );
        }

        bumpLogsRefresh();
        clearCache();

        Object.keys(childrenCache).forEach((groupId) => {
          dispatch(setChildrenForGroup({ projectId: projectIdStr, groupId, children: [] }));
        });

        setSelectedKeywordIds(new Set());
        setGroupName('');

        const refreshData = async () => {
          try {
            const statsData = await apiClient.fetchSingleProjectStats(projectIdStr);
            if (statsData) {
              dispatch(
                setProjectStats({
                  projectId: projectIdStr,
                  stats: statsData,
                })
              );
            }

            await fetchKeywords({
              page: maintainedPage,
              limit: pagination.limit,
              view: activeView,
              sort: sortParams,
              filters: buildFilters({
                serpFeatures: [],
              }),
              includeMatchType,
              excludeMatchType,
              forceRefresh: true,
            });

            if (data && data.groupId) {
              const newGroupId = data.groupId;
              dispatch(
                setChildrenForGroup({
                  projectId: projectIdStr,
                  groupId: newGroupId,
                  children: [],
                })
              );
            }
          } catch (err) {
            console.error('Error refreshing data:', err);
            addSnackbarMessage(
              'Error refreshing data: ' + (isError(err) ? err.message : 'Unknown error'),
              'error'
            );
          } finally {
            setIsProcessingAction(false);
            setIsTableLoading(false);
          }
        };

        refreshData();
      } catch (error) {
        console.error('Grouping error:', error);
        addSnackbarMessage(
          'Error grouping keywords: ' + (isError(error) ? error.message : 'Unknown error'),
          'error'
        );
        setIsProcessingAction(false);
        setIsTableLoading(false);
      }
    },
    [
      selectedKeywordIds,
      groupName,
      projectIdStr,
      calculateMaintainedPage,
      pagination.page,
      pagination.limit,
      pagination.total,
      addSnackbarMessage,
      activeView,
      clearCache,
      childrenCache,
      filteredAndSortedKeywords,
      dispatch,
      fetchKeywords,
      sortParams,
      includeMatchType,
      excludeMatchType,
      buildFilters,
      bumpLogsRefresh,
      setSelectedKeywordIds,
      setGroupName,
      setIsProcessingAction,
      setIsTableLoading,
    ]
  );

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
      dispatch(
        setKeywordsForView({
          projectId: projectIdStr,
          view: 'grouped',
          keywords: [],
        })
      );

      Object.keys(childrenCache).forEach((groupId) => {
        dispatch(setChildrenForGroup({ projectId: projectIdStr, groupId, children: [] }));
      });

      const data = await apiClient.ungroupKeywords(projectIdStr, keywordIds);
      addSnackbarMessage('Ungrouped ' + data.count + ' keywords', 'success');

      await Promise.all([
        fetchKeywords({
          page: maintainedPage,
          limit: pagination.limit,
          view: activeView,
          sort: sortParams,
          filters: buildFilters(),
          includeMatchType,
          excludeMatchType,
          forceRefresh: true,
        }),
        fetchProjectStats(),
      ]);

      bumpLogsRefresh();
      setSelectedKeywordIds(new Set());
      setGroupName('');
      setExpandedGroups(new Set());
    } catch (error) {
      addSnackbarMessage(
        'Error ungrouping keywords: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      setIsProcessingAction(false);
      setIsTableLoading(false);
    }
  }, [
    selectedKeywordIds,
    activeView,
    projectIdStr,
    addSnackbarMessage,
    dispatch,
    childrenCache,
    fetchKeywords,
    pagination.limit,
    pagination.total,
    pagination.page,
    sortParams,
    buildFilters,
    includeMatchType,
    excludeMatchType,
    fetchProjectStats,
    calculateMaintainedPage,
    bumpLogsRefresh,
    setSelectedKeywordIds,
    setGroupName,
    setExpandedGroups,
    setIsProcessingAction,
    setIsTableLoading,
  ]);

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
      addSnackbarMessage('Unblocked ' + data.count + ' keywords', 'success');

      await Promise.all([
        fetchKeywords({
          page: maintainedPage,
          limit: pagination.limit,
          view: activeView,
          sort: sortParams,
          filters: buildFilters(),
          includeMatchType,
          excludeMatchType,
          forceRefresh: true,
        }),
        fetchProjectStats(),
      ]);

      bumpLogsRefresh();
      setSelectedKeywordIds(new Set());
    } catch (error) {
      addSnackbarMessage(
        'Error unblocking keywords: ' + (isError(error) ? error.message : 'Unknown error'),
        'error'
      );
    } finally {
      setIsProcessingAction(false);
      setIsTableLoading(false);
    }
  }, [
    selectedKeywordIds,
    activeView,
    projectIdStr,
    addSnackbarMessage,
    fetchKeywords,
    pagination.limit,
    pagination.total,
    pagination.page,
    sortParams,
    buildFilters,
    includeMatchType,
    excludeMatchType,
    fetchProjectStats,
    calculateMaintainedPage,
    bumpLogsRefresh,
    setSelectedKeywordIds,
    setIsProcessingAction,
    setIsTableLoading,
  ]);

  const handleMiddleClickGroup = useCallback(
    async (keywordIds: number[]) => {
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
        const selectedKeywords = keywordIds
          .map((id) => ungroupedKeywords.find((k) => k.id === id))
          .filter(Boolean);

        if (selectedKeywords.length > 0) {
          const highestVolumeKeyword = selectedKeywords.reduce(
            (max, curr) => ((curr?.volume || 0) > (max?.volume || 0) ? curr : max),
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

      const keywordInfo =
        keywordIds.length === 1 && ungroupedKeywords
          ? ungroupedKeywords.find((k) => k.id === keywordIds[0])?.keyword
          : keywordIds.length + ' keywords';

      setIsProcessingAction(true);
      try {
        const data = await apiClient.groupKeywords(projectIdStr, keywordIds, trimmedGroupName);
        addSnackbarMessage('Grouped ' + keywordInfo + ' as "' + trimmedGroupName + '"', 'success');

        await fetchKeywords({
          page: pagination.page,
          limit: pagination.limit,
          view: activeView,
          sort: sortParams,
          filters: buildFilters(),
          includeMatchType,
          excludeMatchType,
          forceRefresh: true,
        });
        await fetchProjectStats();
        bumpLogsRefresh();
        setSelectedKeywordIds(new Set());
      } catch (error) {
        addSnackbarMessage(
          'Error grouping keyword: ' + (isError(error) ? error.message : 'Unknown error'),
          'error'
        );
      } finally {
        setIsProcessingAction(false);
      }
    },
    [
      activeView,
      groupName,
      projectIdStr,
      ungroupedKeywords,
      addSnackbarMessage,
      setGroupName,
      fetchKeywords,
      pagination.page,
      pagination.limit,
      sortParams,
      buildFilters,
      includeMatchType,
      excludeMatchType,
      fetchProjectStats,
      setSelectedKeywordIds,
      setIsProcessingAction,
      bumpLogsRefresh,
    ]
  );

  const handleTokenDataChange = useCallback(async () => {
    invalidateCache(projectIdStr + '-stats');
    await Promise.all([
      fetchKeywords({
        page: pagination.page,
        limit: pagination.limit,
        view: activeView,
        sort: sortParams,
        filters: buildFilters(),
        includeMatchType,
        excludeMatchType,
        forceRefresh: true,
      }),
      fetchProjectStats(),
    ]);
  }, [
    fetchKeywords,
    pagination.page,
    pagination.limit,
    activeView,
    sortParams,
    buildFilters,
    includeMatchType,
    excludeMatchType,
    fetchProjectStats,
    invalidateCache,
    projectIdStr,
  ]);

  const handleAdvancedTokenSelection = useCallback(
    async (token: string, event: React.MouseEvent) => {
      event.stopPropagation();
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        if (!projectIdStr) return;
        setIsProcessingAction(true);
        setIsTableLoading(true);
        try {
          const tokensBackup = [...selectedTokens].filter((t) => t !== token);
          const includeFilterBackup = includeFilter;
          const excludeFilterBackup = excludeFilter;
          const minVolumeBackup = minVolume;
          const maxVolumeBackup = maxVolume;
          const minDifficultyBackup = minDifficulty;
          const maxDifficultyBackup = maxDifficulty;
          const serpFeaturesBackup = [...selectedSerpFeatures];
          const currentPage = pagination.page;
          const data = await apiClient.blockToken(projectIdStr, token);
          addSnackbarMessage('Blockd ' + data.count + ' keywords with token "' + token + '"', 'success');
          invalidateCache(projectIdStr + '-' + activeView + '-total-');
          await fetchProjectStats();
          await fetchKeywords({
            page: currentPage,
            limit: pagination.limit,
            view: activeView,
            sort: sortParams,
            filters: buildFilters({
              tokens: tokensBackup,
              include: includeFilterBackup,
              exclude: excludeFilterBackup,
              minVolume: minVolumeBackup ? parseInt(minVolumeBackup) : '',
              maxVolume: maxVolumeBackup ? parseInt(maxVolumeBackup) : '',
              minDifficulty: minDifficultyBackup ? parseFloat(minDifficultyBackup) : '',
              maxDifficulty: maxDifficultyBackup ? parseFloat(maxDifficultyBackup) : '',
              serpFeatures: serpFeaturesBackup,
              minRating: minRating ? parseInt(minRating) : '',
              maxRating: maxRating ? parseInt(maxRating) : '',
            }),
            includeMatchType,
            excludeMatchType,
            forceRefresh: false,
          });
          bumpLogsRefresh();
        } catch (error) {
          addSnackbarMessage(
            'Error blocking keywords: ' + (isError(error) ? error.message : 'Unknown error'),
            'error'
          );
        } finally {
          setIsProcessingAction(false);
          setIsTableLoading(false);
        }
      } else {
        toggleTokenSelection(token);
      }
    },
    [
      projectIdStr,
      selectedTokens,
      includeFilter,
      excludeFilter,
      minVolume,
      maxVolume,
      minDifficulty,
      maxDifficulty,
      selectedSerpFeatures,
      pagination.page,
      pagination.limit,
      addSnackbarMessage,
      invalidateCache,
      activeView,
      fetchProjectStats,
      fetchKeywords,
      sortParams,
      minRating,
      maxRating,
      toggleTokenSelection,
      bumpLogsRefresh,
      includeMatchType,
      excludeMatchType,
      buildFilters,
      setIsProcessingAction,
      setIsTableLoading,
    ]
  );

  return {
    isExportingParent,
    isImportingParent,
    isExporting,
    handleExportCSV,
    handleExportParentKeywords,
    handleImportParentKeywords,
    handleConfirmKeywords,
    handleUnconfirmKeywords,
    handleGroupKeywords,
    handleUngroupKeywords,
    handleUnblockKeywords,
    handleMiddleClickGroup,
    handleTokenDataChange,
    handleAdvancedTokenSelection,
  };
}
