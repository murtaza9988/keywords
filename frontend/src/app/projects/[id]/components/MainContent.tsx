/* eslint-disable react-hooks/exhaustive-deps */
import React, { memo } from 'react';
import { KeywordTable } from './KeywordTable';
import Pagination from './Pagination';
import { ActiveKeywordView, GroupedKeywordsDisplay, PaginationInfo, SortParams } from './types';
import { debounce } from 'lodash';
const LIMIT_OPTIONS = [100, 250, 500, 1000, 2500, 5000];

interface MainContentProps {
  activeView: ActiveKeywordView;
  keywordsToDisplay: GroupedKeywordsDisplay[];
  pagination: PaginationInfo;
  isLoadingData: boolean;
  loadingChildren: Set<string>;
  expandedGroups: Set<string>;
  selectedKeywordIds: Set<number>;
  selectedTokens: string[];
  sortParams: SortParams;
  isAllSelected: boolean;
  isAnySelected: boolean;
  projectIdStr: string;
  isTableLoading: boolean;
  selectedParentKeywordCount: number;
  minVolume: string;
  maxVolume: string;
  minLength: string;
  maxLength: string;
  minDifficulty: string;
  maxDifficulty: string;
  minRating: string;
  maxRating: string;
  handleMinRatingChange: (value: string) => void; 
  handleMaxRatingChange: (value: string) => void; 
  handleViewChange: (newView: ActiveKeywordView) => void;
  handlePageChange: (newPage: number) => void;
  handleLimitChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  handleMinVolumeChange: (value: string) => void; 
  handleMaxVolumeChange: (value: string) => void; 
  handleMinLengthChange: (value: string) => void; 
  handleMaxLengthChange: (value: string) => void; 
  handleMinDifficultyChange: (value: string) => void; 
  handleMaxDifficultyChange: (value: string) => void; 
  toggleGroupExpansion: (groupId: string, hasChildren: boolean) => void;
  toggleKeywordSelection: (keywordId: number) => void;
  toggleTokenSelection: (token: string, event: React.MouseEvent) => void;
  removeToken: (token: string) => void;
  handleSort: (column: string) => void;
  handleSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleMiddleClickGroup: (keywordIds: number[]) => void;
  currentGroupId?: string;
  groupName?: string;
  stats: {
    ungroupedCount: number;
    groupedKeywordsCount: number;
    groupedPages: number;
    confirmedKeywordsCount?: number;
    confirmedPages?: number;
    blockedCount: number;
    totalKeywords: number;
  };
  selectedSerpFeatures: string[];
  handleSerpFilterChange: (features: string[]) => void;
}

const VolumeInputs = memo(
  ({
    minVolume,
    maxVolume,
    onMinVolumeChange,
    onMaxVolumeChange,
  }: {
    minVolume: string;
    maxVolume: string;
    onMinVolumeChange: (value: string) => void;
    onMaxVolumeChange: (value: string) => void;
  }) => {
    const [localMinVolume, setLocalMinVolume] = React.useState(minVolume);
    const [localMaxVolume, setLocalMaxVolume] = React.useState(maxVolume);
    const minInputRef = React.useRef<HTMLInputElement>(null);
    const maxInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      setLocalMinVolume(minVolume);
    }, [minVolume]);

    React.useEffect(() => {
      setLocalMaxVolume(maxVolume);
    }, [maxVolume]);

    const debouncedMinChange = React.useCallback(
      debounce((value: string) => {
        onMinVolumeChange(value);
      }, 500),
      [onMinVolumeChange]
    );

    const debouncedMaxChange = React.useCallback(
      debounce((value: string) => {
        onMaxVolumeChange(value);
      }, 500),
      [onMaxVolumeChange]
    );

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalMinVolume(value);
      debouncedMinChange(value);
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalMaxVolume(value);
      debouncedMaxChange(value);
    };

    
    return (
      <div className="flex items-center">
        <span className="text-[13px] text-foreground font-light mr-1">Vol:</span>
        <input
          ref={minInputRef}
          type="number"
          placeholder="Min"
          value={localMinVolume}
          onChange={handleMinChange}
          className="w-16 p-1 text-xs border border-border rounded-md text-[13px] bg-white text-foreground shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 appearance-none hover:border-gray-400"
          autoComplete="off"
          maxLength={8}
        />
        <span className="mx-1 text-muted">-</span>
        <input
          ref={maxInputRef}
          type="number"
          placeholder="Max"
          value={localMaxVolume}
          onChange={handleMaxChange}
          className="w-16 p-1 text-xs border border-border rounded-md text-[13px] bg-white text-foreground shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 appearance-none hover:border-gray-400"
          autoComplete="off"
          maxLength={8}
        />
      </div>
    );
  }
);

const LengthInputs = memo(
  ({
    minLength,
    maxLength,
    onMinLengthChange,
    onMaxLengthChange,
  }: {
    minLength: string;
    maxLength: string;
    onMinLengthChange: (value: string) => void;
    onMaxLengthChange: (value: string) => void;
  }) => {
    const [localMinLength, setLocalMinLength] = React.useState(minLength);
    const [localMaxLength, setLocalMaxLength] = React.useState(maxLength);
    const minInputRef = React.useRef<HTMLInputElement>(null);
    const maxInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      setLocalMinLength(minLength);
    }, [minLength]);

    React.useEffect(() => {
      setLocalMaxLength(maxLength);
    }, [maxLength]);

    const debouncedMinChange = React.useCallback(
      debounce((value: string) => {
        onMinLengthChange(value);
      }, 500),
      [onMinLengthChange]
    );

    const debouncedMaxChange = React.useCallback(
      debounce((value: string) => {
        onMaxLengthChange(value);
      }, 500),
      [onMaxLengthChange]
    );

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalMinLength(value);
      debouncedMinChange(value);
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalMaxLength(value);
      debouncedMaxChange(value);
    };

    return (
      <div className="flex items-center ml-2">
        <span className="text-[13px] text-foreground font-light mr-1">Len:</span>
        <input
          ref={minInputRef}
          type="number"
          placeholder="Min"
          value={localMinLength}
          onChange={handleMinChange}
          className="w-16 p-1 text-xs border border-border rounded-md text-[13px] bg-white text-foreground shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 appearance-none hover:border-gray-400"
          autoComplete="off"
          maxLength={3}
        />
        <span className="mx-1 text-muted">-</span>
        <input
          ref={maxInputRef}
          type="number"
          placeholder="Max"
          value={localMaxLength}
          onChange={handleMaxChange}
          className="w-16 p-1 text-xs border border-border rounded-md text-[13px] bg-white text-foreground shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 appearance-none hover:border-gray-400"
          autoComplete="off"
          maxLength={3}
        />
      </div>
    );
  }
);

LengthInputs.displayName = 'LengthInputs';

const DifficultyInputs = memo(
  ({
    minDifficulty,
    maxDifficulty,
    onMinDifficultyChange,
    onMaxDifficultyChange,
  }: {
    minDifficulty: string;
    maxDifficulty: string;
    onMinDifficultyChange: (value: string) => void;
    onMaxDifficultyChange: (value: string) => void;
  }) => {
    const [localMinDifficulty, setLocalMinDifficulty] = React.useState(minDifficulty);
    const [localMaxDifficulty, setLocalMaxDifficulty] = React.useState(maxDifficulty);
    const minInputRef = React.useRef<HTMLInputElement>(null);
    const maxInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      setLocalMinDifficulty(minDifficulty);
    }, [minDifficulty]);

    React.useEffect(() => {
      setLocalMaxDifficulty(maxDifficulty);
    }, [maxDifficulty]);

    const debouncedMinChange = React.useCallback(
      debounce((value: string) => {
        onMinDifficultyChange(value);
      }, 500),
      [onMinDifficultyChange]
    );

    const debouncedMaxChange = React.useCallback(
      debounce((value: string) => {
        onMaxDifficultyChange(value);
      }, 500),
      [onMaxDifficultyChange]
    );

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalMinDifficulty(value);
      debouncedMinChange(value);
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalMaxDifficulty(value);
      debouncedMaxChange(value);
    };

  
   
    return (
      <div className="flex items-center ml-2 ">
        <span className="text-[13px] text-foreground font-light mr-1">Diff:</span>
        <input
          ref={minInputRef}
          type="number"
          step="0.1"
          placeholder="Min"
          value={localMinDifficulty}
          onChange={handleMinChange}
          className="w-16 p-1 text-xs border border-border rounded-md text-[13px] bg-white text-foreground shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 appearance-none hover:border-gray-400"
          autoComplete="off"
          maxLength={5}
        />
        <span className="mx-1 text-muted">-</span>
        <input
          ref={maxInputRef}
          type="number"
          step="0.1"
          placeholder="Max"
          value={localMaxDifficulty}
          onChange={handleMaxChange}
          className="w-16 p-1 text-xs border border-border rounded-md text-[13px] bg-white text-foreground shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 appearance-none hover:border-gray-400"
          autoComplete="off"
          maxLength={5}
        />
      </div>
    );
  }
);
const RatingInputs = memo(
  ({
    minRating,
    maxRating,
    onMinRatingChange,
    onMaxRatingChange,
  }: {
    minRating: string;
    maxRating: string;
    onMinRatingChange: (value: string) => void;
    onMaxRatingChange: (value: string) => void;
  }) => {
    const [localMinRating, setLocalMinRating] = React.useState(minRating);
    const [localMaxRating, setLocalMaxRating] = React.useState(maxRating);
    const minInputRef = React.useRef<HTMLInputElement>(null);
    const maxInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      setLocalMinRating(minRating);
    }, [minRating]);

    React.useEffect(() => {
      setLocalMaxRating(maxRating);
    }, [maxRating]);

    const debouncedMinChange = React.useCallback(
      debounce((value: string) => {
        onMinRatingChange(value);
      }, 500),
      [onMinRatingChange]
    );

    const debouncedMaxChange = React.useCallback(
      debounce((value: string) => {
        onMaxRatingChange(value);
      }, 500),
      [onMaxRatingChange]
    );

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalMinRating(value);
      debouncedMinChange(value);
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalMaxRating(value);
      debouncedMaxChange(value);
    };

    return (
      <div className="flex items-center ml-2">
        <span className="text-[13px] text-foreground font-light mr-1">Rt:</span>
        <input
          ref={minInputRef}
          type="number"
          placeholder="Min"
          value={localMinRating}
          onChange={handleMinChange}
          className="w-16 p-1 text-xs border border-border rounded-md text-[13px] bg-white text-foreground shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 appearance-none hover:border-gray-400"
          autoComplete="off"
          maxLength={3}
        />
        <span className="mx-1 text-muted">-</span>
        <input
          ref={maxInputRef}
          type="number"
          placeholder="Max"
          value={localMaxRating}
          onChange={handleMaxChange}
          className="w-16 p-1 text-xs border border-border rounded-md text-[13px] bg-white text-foreground shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 appearance-none hover:border-gray-400"
          autoComplete="off"
          maxLength={3}
        />
      </div>
    );
  }
);
VolumeInputs.displayName = 'VolumeInputs';
DifficultyInputs.displayName = 'DifficultyInputs';
RatingInputs.displayName = 'RatingInputs';

export const MainContent: React.FC<MainContentProps> = memo(({
  activeView,
  keywordsToDisplay,
  pagination,
  isLoadingData,
  loadingChildren,
  expandedGroups,
  selectedKeywordIds,
  selectedTokens,
  sortParams,
  isAllSelected,
  isAnySelected,
  projectIdStr,
  isTableLoading,
  selectedParentKeywordCount,
  minVolume,
  maxVolume,
  minLength,
  maxLength,
  minDifficulty,
  maxDifficulty,
  minRating,
  maxRating,
  handleViewChange,
  handlePageChange,
  handleLimitChange,
  handleMinVolumeChange,
  handleMaxVolumeChange,
  handleMinLengthChange,
  handleMaxLengthChange,
  handleMinDifficultyChange,
  handleMaxDifficultyChange,
  handleMinRatingChange,
  handleMaxRatingChange,
  toggleGroupExpansion,
  toggleKeywordSelection,
  toggleTokenSelection,
  removeToken,
  handleSort,
  handleSelectAllClick,
  handleMiddleClickGroup,
  stats,
  handleSerpFilterChange,
}) => {
  const totalKeywords = stats.totalKeywords > 0
    ? stats.totalKeywords
    : (stats.ungroupedCount + stats.groupedKeywordsCount + (stats.confirmedKeywordsCount || 0) + stats.blockedCount);

  const ungroupedPercent = totalKeywords > 0
    ? ((stats.ungroupedCount / totalKeywords) * 100).toFixed(2)
    : '0.0';
  const groupedPercent = totalKeywords > 0
    ? ((stats.groupedKeywordsCount / totalKeywords) * 100).toFixed(2)
    : '0.0';
  const confirmedPercent = totalKeywords > 0 && stats.confirmedKeywordsCount
    ? ((stats.confirmedKeywordsCount / totalKeywords) * 100).toFixed(2)
    : '0.0';
  const blockedPercent = totalKeywords > 0
    ? ((stats.blockedCount / totalKeywords) * 100).toFixed(2)
    : '0.0';

  const viewLabels = {
    ungrouped: `View 1 (UG; ${stats.ungroupedCount.toLocaleString()}/${ungroupedPercent}%)`,
    grouped: `View 2 (G; ${stats.groupedPages.toLocaleString()}/${stats.groupedKeywordsCount.toLocaleString()}/${groupedPercent}%)`,
    confirmed: `View 3 (C; ${(stats.confirmedPages || 0).toLocaleString()}/${(stats.confirmedKeywordsCount || 0).toLocaleString()}/${confirmedPercent}%)`,
    blocked: `View 4 (${stats.blockedCount.toLocaleString()}/${blockedPercent}%)`,
  };

  const shouldShowPagination = pagination.pages >= 1;
  const showSelectedParentCount = activeView === 'grouped' && selectedKeywordIds.size > 0;

  return (
    <>
      <div className="flex flex-col gap-1 pb-2 border-b border-border">
        <h2 className="text-[15px] font-semibold text-foreground">Keyword Management</h2>
        {showSelectedParentCount && (
          <span className="text-xs text-muted">
            Selected parent keywords: {selectedParentKeywordCount.toLocaleString()}
          </span>
        )}
      </div>
      <div className="flex flex-col justify-end mb-4 gap-3 shrink-0 bg-surface-muted/40 rounded-lg p-2">
        <div className="flex items-center gap-2 w-full justify-end">
          <VolumeInputs
            minVolume={minVolume}
            maxVolume={maxVolume}
            onMinVolumeChange={handleMinVolumeChange}
            onMaxVolumeChange={handleMaxVolumeChange}
          />
          <LengthInputs
            minLength={minLength}
            maxLength={maxLength}
            onMinLengthChange={handleMinLengthChange}
            onMaxLengthChange={handleMaxLengthChange}
          />
          <DifficultyInputs
            minDifficulty={minDifficulty}
            maxDifficulty={maxDifficulty}
            onMinDifficultyChange={handleMinDifficultyChange}
            onMaxDifficultyChange={handleMaxDifficultyChange}
          />
          <RatingInputs
            minRating={minRating}
            maxRating={maxRating}
            onMinRatingChange={handleMinRatingChange}
            onMaxRatingChange={handleMaxRatingChange}
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex border border-border p-0.5 gap-2 rounded bg-surface-muted w-full sm:w-auto justify-center shrink-0">
            <button
              onClick={() => handleViewChange('ungrouped')}
              className={`flex-1 sm:flex-none px-1 py-2 text-[13px] rounded transition-colors hover:cursor-pointer ${activeView === 'ungrouped' ? 'bg-blue-600 text-white shadow-sm' : 'text-muted hover:text-foreground hover:bg-surface-muted'}`}
            >
              {viewLabels.ungrouped}
            </button>
            <button
              onClick={() => handleViewChange('grouped')}
              className={`flex-1 sm:flex-none px-1 py-2 text-[13px] rounded transition-colors hover:cursor-pointer ${activeView === 'grouped' ? 'bg-blue-600 text-white shadow-sm' : 'text-muted hover:text-foreground hover:bg-surface-muted'}`}
            >
              {viewLabels.grouped}
            </button>
            <button
              onClick={() => handleViewChange('confirmed')}
              className={`flex-1 sm:flex-none px-1 py-2 text-[13px] rounded transition-colors hover:cursor-pointer ${activeView === 'confirmed' ? 'bg-green-600 text-white shadow-sm' : 'text-muted hover:text-foreground hover:bg-surface-muted'}`}
            >
              {viewLabels.confirmed}
            </button>
            <button
              onClick={() => handleViewChange('blocked')}
              className={`flex-1 sm:flex-none px-1 py-2 text-sm rounded transition-colors hover:cursor-pointer ${activeView === 'blocked' ? 'bg-red-600 text-white shadow-sm' : 'text-muted hover:text-foreground hover:bg-surface-muted'}`}
            >
              {viewLabels.blocked}
            </button>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-1 text-xs text-foreground">
            <span className="flex-shrink-0">
              Showing <span className="inline-block min-w-[30px] text-center">{keywordsToDisplay.length.toLocaleString()}</span> | 
              Page <span className="inline-block min-w-[10px] text-center">{pagination.page}</span> /
              <span className="inline-block min-w-[20px] text-center">{pagination.pages.toLocaleString()}</span> | 
              Total: <span className="inline-block min-w-[50px] text-center">{pagination.total.toLocaleString()}</span>
            </span>
            <div className="relative inline-block ml-1">
              <select
                id="itemsPerPage"
                value={pagination.limit}
                onChange={handleLimitChange}
                className="appearance-none bg-white border border-border rounded text-sm py-1 pl-2 pr-6 focus:outline-none cursor-pointer"
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
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col min-h-0">
          <KeywordTable
            groupedKeywords={keywordsToDisplay}
            loading={isLoadingData}
            isTableLoading={isTableLoading}
            loadingChildren={loadingChildren}
            expandedGroups={expandedGroups}
            toggleGroupExpansion={toggleGroupExpansion}
            selectedKeywordIds={selectedKeywordIds}
            toggleKeywordSelection={toggleKeywordSelection}
            selectedTokens={selectedTokens}
            toggleTokenSelection={toggleTokenSelection}
            removeToken={removeToken}
            projectId={projectIdStr}
            currentView={activeView}
            sortParams={sortParams}
            onSort={handleSort}
            isAllSelected={isAllSelected}
            isAnySelected={isAnySelected}
            handleSelectAllClick={handleSelectAllClick}
            handleMiddleClickGroup={handleMiddleClickGroup}
            onSerpFilterChange={handleSerpFilterChange}
          />
          {shouldShowPagination && (
            <div className="sticky bottom-0 bg-white border-t border-border px-2 py-2">
              <Pagination
                total={pagination.total}
                page={pagination.page}
                limit={pagination.limit}
                pages={pagination.pages}
                onPageChange={handlePageChange}
                disabled={isLoadingData}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
});

MainContent.displayName = 'MainContent';
