"use client";
import { useCallback } from 'react';
import { AppDispatch } from '@/store/store';
import { setChildrenForGroup, setProjectStats } from '@/store/projectSlice';
import {
  confirmKeywords,
  unconfirmKeywords,
  groupKeywords,
  regroupKeywords,
  ungroupKeywords,
  unblockKeywords,
  exportGroupedKeywords,
  exportParentKeywords,
  importParentKeywords,
} from '@/lib/api/keywords';
import { fetchProjectStats as fetchProjectStatsApi } from '@/lib/api/projects';
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

interface UseKeywordActionsProps {
  projectIdStr: string;
  dispatch: AppDispatch;
  detailDispatch: React.Dispatch<ProjectDetailAction>;
  apiCache: ApiCache;
  addSnackbarMessage: (text: string, type: 'success' | 'error' | 'info', options?: { description?: string; stage?: ProcessingStatus }) => void;
  bumpLogsRefresh: () => void;
  guardGroupingAction: () => boolean;
  childrenCache: Record<string, Keyword[]>;
  fetchKeywords: (
    page?: number,
    limit?: number,
    view?: ActiveKeywordView,
    sort?: SortParams,
    filters?: FilterParams,
    forceRefresh?: boolean
  ) => Promise<void>;
  fetchProjectStats: () => Promise<void>;
  calculateMaintainedPage: (
    currentPage: number,
    currentLimit: number,
    selectedIds: Set<number>,
    totalItemsBefore: number
  ) => number;
}

export interface UseKeywordActionsReturn {
  handleConfirmKeywords: (
    selectedKeywordIds: Set<number>,
    activeView: ActiveKeywordView,
    pagination: { page: number; limit: number; total: number },
    sortParams: SortParams,
    filterParams: FilterParams
  ) => Promise<void>;
  handleUnconfirmKeywords: (
    selectedKeywordIds: Set<number>,
    activeView: ActiveKeywordView,
    pagination: { page: number; limit: number; total: number },
    sortParams: SortParams,
    filterParams: FilterParams
  ) => Promise<void>;
  handleGroupKeywords: (
    selectedKeywordIds: Set<number>,
    groupName: string,
    activeView: ActiveKeywordView,
    pagination: { page: number; limit: number; total: number },
    sortParams: SortParams,
    filterParams: FilterParams,
    filteredAndSortedKeywords: Keyword[],
    overrideGroupName?: string
  ) => Promise<void>;
  handleUngroupKeywords: (
    selectedKeywordIds: Set<number>,
    activeView: ActiveKeywordView,
    pagination: { page: number; limit: number; total: number },
    sortParams: SortParams,
    filterParams: FilterParams
  ) => Promise<void>;
  handleUnblockKeywords: (
    selectedKeywordIds: Set<number>,
    activeView: ActiveKeywordView,
    pagination: { page: number; limit: number; total: number },
    sortParams: SortParams,
    filterParams: FilterParams
  ) => Promise<void>;
  handleMiddleClickGroup: (
    keywordIds: number[],
    groupName: string,
    activeView: ActiveKeywordView,
    ungroupedKeywords: Keyword[],
    pagination: { page: number; limit: number },
    sortParams: SortParams,
    filterParams: FilterParams,
    setGroupName: (value: string) => void
  ) => Promise<void>;
  handleExportCSV: (activeView: ActiveKeywordView) => Promise<void>;
  handleExportParentKeywords: () => Promise<void>;
  handleImportParentKeywords: (
    file: File,
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => Promise<void>;
  calculateMaintainedPage: (
    currentPage: number,
    currentLimit: number,
    selectedIds: Set<number>,
    totalItemsBefore: number
  ) => number;
}

export function useKeywordActions({
  projectIdStr,
  dispatch,
  detailDispatch,
  apiCache,
  addSnackbarMessage,
  bumpLogsRefresh,
  guardGroupingAction,
  childrenCache,
  fetchKeywords,
  fetchProjectStats,
}: UseKeywordActionsProps): UseKeywordActionsReturn {
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

  const handleConfirmKeywords = useCallback(async (
    selectedKeywordIds: Set<number>,
    activeView: ActiveKeywordView,
    pagination: { page: number; limit: number; total: number },
    sortParams: SortParams,
    filterParams: FilterParams
  ) => {
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
  }, [projectIdStr, addSnackbarMessage, fetchKeywords, fetchProjectStats, calculateMaintainedPage, bumpLogsRefresh, guardGroupingAction, detailDispatch]);

  const handleUnconfirmKeywords = useCallback(async (
    selectedKeywordIds: Set<number>,
    activeView: ActiveKeywordView,
    pagination: { page: number; limit: number; total: number },
    sortParams: SortParams,
    filterParams: FilterParams
  ) => {
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
  }, [projectIdStr, addSnackbarMessage, fetchKeywords, fetchProjectStats, calculateMaintainedPage, bumpLogsRefresh, guardGroupingAction, detailDispatch]);

  const handleGroupKeywords = useCallback(async (
    selectedKeywordIds: Set<number>,
    groupName: string,
    activeView: ActiveKeywordView,
    pagination: { page: number; limit: number; total: number },
    sortParams: SortParams,
    filterParams: FilterParams,
    filteredAndSortedKeywords: Keyword[],
    overrideGroupName?: string
  ) => {
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
      let messagePrefix = 'grouped';

      if (activeView === 'grouped') {
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
  }, [projectIdStr, calculateMaintainedPage, addSnackbarMessage, apiCache, childrenCache, dispatch, fetchKeywords, bumpLogsRefresh, guardGroupingAction, detailDispatch]);

  const handleUngroupKeywords = useCallback(async (
    selectedKeywordIds: Set<number>,
    activeView: ActiveKeywordView,
    pagination: { page: number; limit: number; total: number },
    sortParams: SortParams,
    filterParams: FilterParams
  ) => {
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
  }, [projectIdStr, addSnackbarMessage, fetchKeywords, fetchProjectStats, calculateMaintainedPage, bumpLogsRefresh, guardGroupingAction, detailDispatch]);

  const handleUnblockKeywords = useCallback(async (
    selectedKeywordIds: Set<number>,
    activeView: ActiveKeywordView,
    pagination: { page: number; limit: number; total: number },
    sortParams: SortParams,
    filterParams: FilterParams
  ) => {
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
  }, [projectIdStr, addSnackbarMessage, fetchKeywords, fetchProjectStats, calculateMaintainedPage, bumpLogsRefresh, detailDispatch]);

  const handleMiddleClickGroup = useCallback(async (
    keywordIds: number[],
    groupName: string,
    activeView: ActiveKeywordView,
    ungroupedKeywords: Keyword[],
    pagination: { page: number; limit: number },
    sortParams: SortParams,
    filterParams: FilterParams,
    setGroupName: (value: string) => void
  ) => {
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
      await groupKeywords(projectIdStr, keywordIds, trimmedGroupName);
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
  }, [projectIdStr, addSnackbarMessage, fetchKeywords, fetchProjectStats, bumpLogsRefresh, guardGroupingAction, detailDispatch]);

  const handleExportCSV = useCallback(async (activeView: ActiveKeywordView) => {
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
  }, [projectIdStr, addSnackbarMessage, bumpLogsRefresh, detailDispatch]);

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
  }, [projectIdStr, addSnackbarMessage, bumpLogsRefresh, detailDispatch]);

  const handleImportParentKeywords = useCallback(async (
    file: File,
    pagination: { page: number; limit: number },
    activeView: ActiveKeywordView,
    sortParams: SortParams,
    filterParams: FilterParams
  ) => {
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
  }, [projectIdStr, addSnackbarMessage, fetchKeywords, bumpLogsRefresh, detailDispatch]);

  return {
    handleConfirmKeywords,
    handleUnconfirmKeywords,
    handleGroupKeywords,
    handleUngroupKeywords,
    handleUnblockKeywords,
    handleMiddleClickGroup,
    handleExportCSV,
    handleExportParentKeywords,
    handleImportParentKeywords,
    calculateMaintainedPage,
  };
}
