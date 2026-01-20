/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import React, { useCallback, useEffect, useMemo } from 'react';
import { setChildrenForGroup } from '@/store/projectSlice';
import { Header } from './Header';
import { FiltersSection } from './FiltersSection';
import { MainContent } from './MainContent';
import { Snackbar } from './Snackbar';
import { TokenManagement } from './token/TokenManagement';
import { TextAreaInputs } from './TextAreaInputs';
import { ProjectDetailTabs } from './ProjectDetailTabs';
import { ProjectDetailOverview } from './ProjectDetailOverview';
import { ProjectDetailProcess } from './ProjectDetailProcess';
import { ProjectDetailLogs } from './ProjectDetailLogs';
import { ProjectDetailToolbar } from './ProjectDetailToolbar';
import { Keyword, ActiveKeywordView } from './types';
import {
  useProjectDetailState,
  useKeywordFetching,
  useKeywordActions,
  useProcessingStatus,
  useKeywordFilters,
} from './hooks';

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export default function ProjectDetail(): React.ReactElement {
  // State management hook
  const stateHook = useProjectDetailState();
  const {
    projectIdStr,
    projectIdNum,
    project,
    ungroupedKeywords,
    childrenCache,
    state,
    detailDispatch,
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
    processingMessage,
    processingStage,
    processingStageDetail,
    processingCurrentFile,
    processingQueue,
    processingSucceededJobs,
    processingFailedJobs,
    processingFileErrors,
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
    selectedSerpFeatures,
    stats,
    filterParams,
    apiCache,
    dispatch,
    statusCheckIntervalRef,
    statusCheckIntervalMsRef,
    lastStatusErrorRef,
    statusErrorCountRef,
    lastStatusErrorToastTimeRef,
    prevActiveViewRef,
    animationFrameRef,
    bumpLogsRefresh,
    addSnackbarMessage,
    removeSnackbarMessage,
    setActiveTab,
    setGroupName,
    setIncludeMatchType,
    setExcludeMatchType,
    guardGroupingAction,
    getCurrentViewData,
    processingQueuedJobs,
    processingRunningJobs,
  } = stateHook;

  // Data fetching hook
  const fetchingHook = useKeywordFetching({
    projectIdStr,
    projectIdNum,
    dispatch,
    detailDispatch,
    apiCache,
    addSnackbarMessage,
    includeMatchType,
    excludeMatchType,
  });
  const { fetchProjectStats, fetchKeywords, fetchChildren, fetchInitialData, getSerpFeatures } = fetchingHook;

  // Keyword actions hook
  const actionsHook = useKeywordActions({
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
    calculateMaintainedPage: (currentPage, currentLimit, selectedIds, totalItemsBefore) => {
      const currentStartIndex = (currentPage - 1) * currentLimit;
      const estimatedRemovedCount = selectedIds.size;
      const newTotal = Math.max(0, totalItemsBefore - estimatedRemovedCount);
      if (currentPage === 1) return 1;
      const newPage = Math.max(1, Math.ceil((currentStartIndex + 1) / currentLimit));
      const maxPage = Math.max(1, Math.ceil(newTotal / currentLimit));
      return Math.min(newPage, maxPage);
    },
  });

  // Processing status hook
  const processingHook = useProcessingStatus({
    projectIdStr,
    projectIdNum,
    dispatch,
    detailDispatch,
    addSnackbarMessage,
    bumpLogsRefresh,
    fetchKeywords,
    fetchProjectStats,
    statusCheckIntervalRef,
    statusCheckIntervalMsRef,
    lastStatusErrorRef,
    statusErrorCountRef,
    lastStatusErrorToastTimeRef,
    processingStatus,
    processingLocked,
    processingQueue,
    processingCurrentFile,
    processingQueuedJobs,
    processingRunningJobs,
  });
  const {
    csvUploadsRefreshKey,
    startProcessingCheck,
    handleUploadStart,
    handleUploadBatchStart,
    handleUploadSuccess,
    handleUploadError,
  } = processingHook;

  // Filters hook
  const filtersHook = useKeywordFilters({
    projectIdStr,
    detailDispatch,
    apiCache,
    addSnackbarMessage,
    bumpLogsRefresh,
    fetchKeywords,
    fetchProjectStats,
    childrenCache,
  });

  // Keyboard event handlers
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

    const filteredAndSortedKeywords = getCurrentViewData();

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
            await actionsHook.handleGroupKeywords(
              selectedKeywordIds,
              groupName,
              activeView,
              { page: pagination.page, limit: pagination.limit, total: pagination.total },
              sortParams,
              filterParams,
              filteredAndSortedKeywords,
              trimmedGroupName
            );
          } else {
            addSnackbarMessage('No valid group name determined', 'error');
          }
        } finally {
          setTimeout(() => {
            windowWithHandling.__handlingShiftPress = false;
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

        try {
          blurActiveCheckboxes();

          if (activeView === 'grouped') {
            await actionsHook.handleConfirmKeywords(
              selectedKeywordIds,
              activeView,
              { page: pagination.page, limit: pagination.limit, total: pagination.total },
              sortParams,
              filterParams
            );
          } else if (activeView === 'confirmed') {
            await actionsHook.handleUnconfirmKeywords(
              selectedKeywordIds,
              activeView,
              { page: pagination.page, limit: pagination.limit, total: pagination.total },
              sortParams,
              filterParams
            );
          }
        } finally {
          setTimeout(() => {
            windowWithHandling.__handlingCtrlPress = false;
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
    actionsHook,
    pagination,
    sortParams,
    filterParams,
    getCurrentViewData,
    childrenCache,
    isProcessingAction,
    addSnackbarMessage,
    setGroupName,
  ]);

  // Initial data fetch
  useEffect(() => {
    if (projectIdStr) {
      fetchInitialData(pagination.limit, activeView, sortParams, filterParams, startProcessingCheck);
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
      processingHook.stopProcessingCheck();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [projectIdStr]);

  // Computed values
  const filteredAndSortedKeywords = useMemo(() => getCurrentViewData(), [getCurrentViewData]);

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

  // Event handlers
  const toggleKeywordSelection = useCallback(async (keywordId: number) => {
    let nextSelected = new Set(selectedKeywordIds);
    let nextGroupName = groupName;
    const allFilteredIds = filteredAndSortedKeywords.map(k => k.id);

    try {
      if (keywordId === -1) {
        for (const id of allFilteredIds) {
          nextSelected.add(id);
          const parent = filteredAndSortedKeywords.find(k => k.id === id);
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
          if (nextSelected.size === 0) {
            nextGroupName = '';
          }
        } else {
          if (selectedKeyword) {
            nextSelected = new Set(nextSelected);
            nextSelected.add(keywordId);

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
    detailDispatch,
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
  }, [projectIdStr, dispatch, addSnackbarMessage, expandedGroups, loadingChildren, fetchChildren, detailDispatch]);

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
    activeView, pagination, sortParams, filterParams, fetchKeywords, projectIdStr, apiCache, detailDispatch
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
  }, [pagination, isLoadingData, fetchKeywords, activeView, sortParams, filterParams, detailDispatch]);

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
  }, [pagination, fetchKeywords, activeView, sortParams, filterParams, detailDispatch]);

  const handleSort = useCallback((column: string) => {
    if (column === 'tokens' || column === 'serpFeatures') return;
    const newDirection: 'asc' | 'desc' = sortParams.column === column && sortParams.direction === 'asc' ? 'desc' : 'asc';
    const newSortParams = { column, direction: newDirection };
    detailDispatch({
      type: 'updatePagination',
      payload: {
        sortParams: newSortParams,
        pagination: { ...pagination, page: 1 },
      },
    });
    fetchKeywords(1, pagination.limit, activeView, newSortParams, filterParams);
  }, [sortParams.column, sortParams.direction, fetchKeywords, pagination, activeView, filterParams, detailDispatch]);

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

  // Render early return for invalid project
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
        onExportParentKeywords={actionsHook.handleExportParentKeywords}
        onImportParentKeywords={(file) => actionsHook.handleImportParentKeywords(
          file,
          pagination,
          activeView,
          sortParams,
          filterParams
        )}
        onExportCSV={() => actionsHook.handleExportCSV(activeView)}
      />
      <div className="flex-1 w-full">
        <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex flex-col xl:flex-row gap-4">
            <main className="w-full xl:basis-4/5 xl:flex-[4] min-w-0 flex flex-col">
              <div className="bg-white shadow border border-border rounded-lg p-3 sm:p-4 flex flex-col flex-grow h-full">
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
                    onUploadSuccess={(status, message) => handleUploadSuccess(
                      status,
                      message,
                      pagination.limit,
                      activeView,
                      sortParams,
                      filterParams
                    )}
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
                      handleIncludeFilterChange={(e) => filtersHook.handleIncludeFilterChange(
                        e, activeView, pagination, sortParams, filterParams, includeMatchType
                      )}
                      handleExcludeFilterChange={(e) => filtersHook.handleExcludeFilterChange(
                        e, pagination, activeView, sortParams, filterParams
                      )}
                      setGroupName={setGroupName}
                      handleGroupKeywords={(overrideGroupName) => actionsHook.handleGroupKeywords(
                        selectedKeywordIds,
                        groupName,
                        activeView,
                        { page: pagination.page, limit: pagination.limit, total: pagination.total },
                        sortParams,
                        filterParams,
                        filteredAndSortedKeywords,
                        overrideGroupName
                      )}
                      handleUngroupKeywords={() => actionsHook.handleUngroupKeywords(
                        selectedKeywordIds,
                        activeView,
                        { page: pagination.page, limit: pagination.limit, total: pagination.total },
                        sortParams,
                        filterParams
                      )}
                      handleUnblockKeywords={() => actionsHook.handleUnblockKeywords(
                        selectedKeywordIds,
                        activeView,
                        { page: pagination.page, limit: pagination.limit, total: pagination.total },
                        sortParams,
                        filterParams
                      )}
                      removeToken={(token) => filtersHook.removeToken(
                        token, selectedTokens, pagination, activeView, sortParams, filterParams
                      )}
                      handleClearAllFilters={() => filtersHook.clearAllFilters(
                        pagination, activeView, sortParams
                      )}
                      setIncludeMatchType={setIncludeMatchType}
                      setExcludeMatchType={setExcludeMatchType}
                      includeMatchType={includeMatchType}
                      excludeMatchType={excludeMatchType}
                      handleConfirmKeywords={() => actionsHook.handleConfirmKeywords(
                        selectedKeywordIds,
                        activeView,
                        { page: pagination.page, limit: pagination.limit, total: pagination.total },
                        sortParams,
                        filterParams
                      )}
                      handleUnconfirmKeywords={() => actionsHook.handleUnconfirmKeywords(
                        selectedKeywordIds,
                        activeView,
                        { page: pagination.page, limit: pagination.limit, total: pagination.total },
                        sortParams,
                        filterParams
                      )}
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
                        onMinVolumeChange: (value) => filtersHook.handleMinVolumeChange(
                          value, pagination, activeView, sortParams, filterParams
                        ),
                        onMaxVolumeChange: (value) => filtersHook.handleMaxVolumeChange(
                          value, minVolume, pagination, activeView, sortParams, filterParams
                        ),
                        onMinLengthChange: (value) => filtersHook.handleMinLengthChange(
                          value, pagination, activeView, sortParams, filterParams
                        ),
                        onMaxLengthChange: (value) => filtersHook.handleMaxLengthChange(
                          value, pagination, activeView, sortParams, filterParams
                        ),
                        onMinDifficultyChange: (value) => filtersHook.handleMinDifficultyChange(
                          value, minDifficulty, pagination, activeView, sortParams, filterParams
                        ),
                        onMaxDifficultyChange: (value) => filtersHook.handleMaxDifficultyChange(
                          value, pagination, activeView, sortParams, filterParams
                        ),
                        onMinRatingChange: (value) => filtersHook.handleMinRatingChange(
                          value, pagination, activeView, sortParams, filterParams
                        ),
                        onMaxRatingChange: (value) => filtersHook.handleMaxRatingChange(
                          value, minRating, pagination, activeView, sortParams, filterParams
                        ),
                      }}
                      tableHandlers={{
                        onViewChange: handleViewChange,
                        onPageChange: handlePageChange,
                        onLimitChange: handleLimitChange,
                        onSort: handleSort,
                        onSelectAllClick: handleSelectAllClick,
                        onMiddleClickGroup: (keywordIds) => actionsHook.handleMiddleClickGroup(
                          keywordIds,
                          groupName,
                          activeView,
                          ungroupedKeywords,
                          pagination,
                          sortParams,
                          filterParams,
                          setGroupName
                        ),
                        toggleGroupExpansion,
                        toggleKeywordSelection,
                        toggleTokenSelection: (token, event) => filtersHook.handleAdvancedTokenSelection(
                          token,
                          event,
                          selectedTokens,
                          pagination,
                          activeView,
                          sortParams,
                          minVolume,
                          maxVolume,
                          minLength,
                          maxLength,
                          minDifficulty,
                          maxDifficulty,
                          minRating,
                          maxRating,
                          selectedSerpFeatures,
                          includeFilter,
                          excludeFilter
                        ),
                        removeToken: (token) => filtersHook.removeToken(
                          token, selectedTokens, pagination, activeView, sortParams, filterParams
                        ),
                      }}
                      serpFilters={{
                        onSerpFilterChange: (features) => filtersHook.handleSerpFilterChange(
                          features, selectedSerpFeatures, pagination, activeView, sortParams, filterParams
                        ),
                      }}
                    />
                  </>
                )}
                {activeTab === 'process' && (
                  <ProjectDetailProcess />
                )}
                <div className="w-full" style={{ display: activeTab === 'notes' ? 'block' : 'none' }}>
                  <div className="bg-white border border-border rounded-lg p-4">
                    <TextAreaInputs projectId={projectIdStr} />
                  </div>
                </div>
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
                  toggleTokenSelection={(token) => filtersHook.toggleTokenSelection(
                    token, selectedTokens, pagination, activeView, sortParams, filterParams
                  )}
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
