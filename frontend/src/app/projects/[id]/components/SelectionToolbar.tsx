import React, { memo } from 'react';
import { ActiveKeywordView, PaginationInfo } from './types';

const LIMIT_OPTIONS = [100, 250, 500, 1000, 2500, 5000];

interface SelectionToolbarProps {
  activeView: ActiveKeywordView;
  viewLabels: Record<ActiveKeywordView, string>;
  keywordsCount: number;
  pagination: PaginationInfo;
  isLoadingData: boolean;
  onViewChange: (newView: ActiveKeywordView) => void;
  onLimitChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const SelectionToolbar = memo(({
  activeView,
  viewLabels,
  keywordsCount,
  pagination,
  isLoadingData,
  onViewChange,
  onLimitChange,
}: SelectionToolbarProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
      <div className="flex border border-border p-0.5 gap-2 rounded bg-surface-muted w-full sm:w-auto justify-center shrink-0">
        <button
          onClick={() => onViewChange('ungrouped')}
          className={`flex-1 sm:flex-none px-1 py-2 text-ui-tab rounded transition-colors hover:cursor-pointer ${activeView === 'ungrouped' ? 'bg-accent text-on-primary shadow-sm' : 'hover:text-foreground hover:bg-surface-container'}`}
        >
          {viewLabels.ungrouped}
        </button>
        <button
          onClick={() => onViewChange('grouped')}
          className={`flex-1 sm:flex-none px-1 py-2 text-ui-tab rounded transition-colors hover:cursor-pointer ${activeView === 'grouped' ? 'bg-accent text-on-primary shadow-sm' : 'hover:text-foreground hover:bg-surface-container'}`}
        >
          {viewLabels.grouped}
        </button>
        <button
          onClick={() => onViewChange('confirmed')}
          className={`flex-1 sm:flex-none px-1 py-2 text-ui-tab rounded transition-colors hover:cursor-pointer ${activeView === 'confirmed' ? 'bg-success text-on-success shadow-sm' : 'hover:text-foreground hover:bg-surface-container'}`}
        >
          {viewLabels.confirmed}
        </button>
        <button
          onClick={() => onViewChange('blocked')}
          className={`flex-1 sm:flex-none px-1 py-2 text-ui-tab rounded transition-colors hover:cursor-pointer ${activeView === 'blocked' ? 'bg-danger text-on-error shadow-sm' : 'hover:text-foreground hover:bg-surface-container'}`}
        >
          {viewLabels.blocked}
        </button>
      </div>

      <div className="flex items-center justify-center sm:justify-end gap-1 text-ui-body">
        <span className="flex-shrink-0">
          Showing <span className="inline-block min-w-[30px] text-center">{keywordsCount.toLocaleString()}</span> | 
          Page <span className="inline-block min-w-[10px] text-center">{pagination.page}</span> /
          <span className="inline-block min-w-[20px] text-center">{pagination.pages.toLocaleString()}</span> | 
          Total: <span className="inline-block min-w-[50px] text-center">{pagination.total.toLocaleString()}</span>
        </span>
        <div className="relative inline-block ml-1">
          <select
            id="itemsPerPage"
            value={pagination.limit}
            onChange={onLimitChange}
            className="appearance-none bg-white border border-border rounded text-ui-body py-1 pl-2 pr-6 focus:outline-none cursor-pointer"
            aria-label="Items per page"
            disabled={isLoadingData}
          >
            {LIMIT_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-foreground">
            <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
});

SelectionToolbar.displayName = 'SelectionToolbar';
