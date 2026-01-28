import React from 'react';
import { KeywordTable } from './KeywordTable';
import Pagination from './Pagination';
import { ActiveKeywordView, GroupedKeywordsDisplay, PaginationInfo, SortParams } from './types';

interface KeywordTableState {
  groupedKeywords: GroupedKeywordsDisplay[];
  isLoadingData: boolean;
  isTableLoading: boolean;
  loadingChildren: Set<string>;
  expandedGroups: Set<string>;
  selectedKeywordIds: Set<number>;
  selectedTokens: string[];
  sortParams: SortParams;
  isAllSelected: boolean;
  isAnySelected: boolean;
  projectId: string;
  currentView: ActiveKeywordView;
  pagination: PaginationInfo;
}

interface KeywordTableHandlers {
  toggleGroupExpansion: (groupId: string, hasChildren: boolean) => void;
  toggleKeywordSelection: (keywordId: number) => void;
  toggleTokenSelection: (token: string, event: React.MouseEvent) => void;
  removeToken: (token: string) => void;
  onSort: (column: string) => void;
  onSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onMiddleClickGroup: (keywordIds: number[]) => void;
  onPageChange: (newPage: number) => void;
}

interface KeywordTableContainerProps {
  tableState: KeywordTableState;
  handlers: KeywordTableHandlers;
  serpFilters: {
    onSerpFilterChange: (features: string[]) => void;
  };
}

export function KeywordTableContainer({
  tableState,
  handlers,
  serpFilters,
}: KeywordTableContainerProps): React.ReactElement {
  const shouldShowPagination = tableState.pagination.pages >= 1;

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <div className="flex h-full flex-col min-h-0">
        <KeywordTable
          groupedKeywords={tableState.groupedKeywords}
          loading={tableState.isLoadingData}
          isTableLoading={tableState.isTableLoading}
          loadingChildren={tableState.loadingChildren}
          expandedGroups={tableState.expandedGroups}
          toggleGroupExpansion={handlers.toggleGroupExpansion}
          selectedKeywordIds={tableState.selectedKeywordIds}
          toggleKeywordSelection={handlers.toggleKeywordSelection}
          selectedTokens={tableState.selectedTokens}
          toggleTokenSelection={handlers.toggleTokenSelection}
          removeToken={handlers.removeToken}
          projectId={tableState.projectId}
          currentView={tableState.currentView}
          sortParams={tableState.sortParams}
          onSort={handlers.onSort}
          isAllSelected={tableState.isAllSelected}
          isAnySelected={tableState.isAnySelected}
          handleSelectAllClick={handlers.onSelectAllClick}
          handleMiddleClickGroup={handlers.onMiddleClickGroup}
          onSerpFilterChange={serpFilters.onSerpFilterChange}
        />
        {shouldShowPagination && (
          <div className="sticky bottom-0 bg-surface border-t border-border px-2 py-2">
            <Pagination
              total={tableState.pagination.total}
              page={tableState.pagination.page}
              limit={tableState.pagination.limit}
              pages={tableState.pagination.pages}
              onPageChange={handlers.onPageChange}
              disabled={tableState.isLoadingData}
            />
          </div>
        )}
      </div>
    </div>
  );
}
