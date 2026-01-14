import React, { memo } from 'react';
import { debounce } from 'lodash';
import { KeywordTableContainer } from './KeywordTableContainer';
import { SelectionToolbar } from './SelectionToolbar';
import { ActiveKeywordView, GroupedKeywordsDisplay, PaginationInfo, SortParams } from './types';

interface FilterValues {
  minVolume: string;
  maxVolume: string;
  minLength: string;
  maxLength: string;
  minDifficulty: string;
  maxDifficulty: string;
  minRating: string;
  maxRating: string;
}

interface FilterHandlers {
  onMinVolumeChange: (value: string) => void;
  onMaxVolumeChange: (value: string) => void;
  onMinLengthChange: (value: string) => void;
  onMaxLengthChange: (value: string) => void;
  onMinDifficultyChange: (value: string) => void;
  onMaxDifficultyChange: (value: string) => void;
  onMinRatingChange: (value: string) => void;
  onMaxRatingChange: (value: string) => void;
}

interface StatsSummary {
  ungroupedCount: number;
  groupedKeywordsCount: number;
  groupedPages: number;
  confirmedKeywordsCount?: number;
  confirmedPages?: number;
  blockedCount: number;
  totalKeywords: number;
}

interface MainContentProps {
  viewState: {
    activeView: ActiveKeywordView;
    stats: StatsSummary;
    selectedParentKeywordCount: number;
  };
  tableState: {
    keywordsToDisplay: GroupedKeywordsDisplay[];
    pagination: PaginationInfo;
    isLoadingData: boolean;
    isTableLoading: boolean;
    loadingChildren: Set<string>;
    expandedGroups: Set<string>;
    selectedKeywordIds: Set<number>;
    selectedTokens: string[];
    sortParams: SortParams;
    isAllSelected: boolean;
    isAnySelected: boolean;
    projectIdStr: string;
  };
  filterValues: FilterValues;
  filterHandlers: FilterHandlers;
  tableHandlers: {
    onViewChange: (newView: ActiveKeywordView) => void;
    onPageChange: (newPage: number) => void;
    onLimitChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    onSort: (column: string) => void;
    onSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onMiddleClickGroup: (keywordIds: number[]) => void;
    toggleGroupExpansion: (groupId: string, hasChildren: boolean) => void;
    toggleKeywordSelection: (keywordId: number) => void;
    toggleTokenSelection: (token: string, event: React.MouseEvent) => void;
    removeToken: (token: string) => void;
  };
  serpFilters: {
    onSerpFilterChange: (features: string[]) => void;
  };
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

    const debouncedMinChange = React.useMemo(
      () => debounce((value: string) => {
        onMinVolumeChange(value);
      }, 500),
      [onMinVolumeChange]
    );

    const debouncedMaxChange = React.useMemo(
      () => debounce((value: string) => {
        onMaxVolumeChange(value);
      }, 500),
      [onMaxVolumeChange]
    );

    React.useEffect(() => () => debouncedMinChange.cancel(), [debouncedMinChange]);
    React.useEffect(() => () => debouncedMaxChange.cancel(), [debouncedMaxChange]);

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

    const debouncedMinChange = React.useMemo(
      () => debounce((value: string) => {
        onMinLengthChange(value);
      }, 500),
      [onMinLengthChange]
    );

    const debouncedMaxChange = React.useMemo(
      () => debounce((value: string) => {
        onMaxLengthChange(value);
      }, 500),
      [onMaxLengthChange]
    );

    React.useEffect(() => () => debouncedMinChange.cancel(), [debouncedMinChange]);
    React.useEffect(() => () => debouncedMaxChange.cancel(), [debouncedMaxChange]);

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

    const debouncedMinChange = React.useMemo(
      () => debounce((value: string) => {
        onMinDifficultyChange(value);
      }, 500),
      [onMinDifficultyChange]
    );

    const debouncedMaxChange = React.useMemo(
      () => debounce((value: string) => {
        onMaxDifficultyChange(value);
      }, 500),
      [onMaxDifficultyChange]
    );

    React.useEffect(() => () => debouncedMinChange.cancel(), [debouncedMinChange]);
    React.useEffect(() => () => debouncedMaxChange.cancel(), [debouncedMaxChange]);

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

    const debouncedMinChange = React.useMemo(
      () => debounce((value: string) => {
        onMinRatingChange(value);
      }, 500),
      [onMinRatingChange]
    );

    const debouncedMaxChange = React.useMemo(
      () => debounce((value: string) => {
        onMaxRatingChange(value);
      }, 500),
      [onMaxRatingChange]
    );

    React.useEffect(() => () => debouncedMinChange.cancel(), [debouncedMinChange]);
    React.useEffect(() => () => debouncedMaxChange.cancel(), [debouncedMaxChange]);

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
  viewState,
  tableState,
  filterValues,
  filterHandlers,
  tableHandlers,
  serpFilters,
}) => {
  const totalKeywords = viewState.stats.totalKeywords > 0
    ? viewState.stats.totalKeywords
    : (viewState.stats.ungroupedCount + viewState.stats.groupedKeywordsCount + (viewState.stats.confirmedKeywordsCount || 0) + viewState.stats.blockedCount);

  const ungroupedPercent = totalKeywords > 0
    ? ((viewState.stats.ungroupedCount / totalKeywords) * 100).toFixed(2)
    : '0.0';
  const groupedPercent = totalKeywords > 0
    ? ((viewState.stats.groupedKeywordsCount / totalKeywords) * 100).toFixed(2)
    : '0.0';
  const confirmedPercent = totalKeywords > 0 && viewState.stats.confirmedKeywordsCount
    ? ((viewState.stats.confirmedKeywordsCount / totalKeywords) * 100).toFixed(2)
    : '0.0';
  const blockedPercent = totalKeywords > 0
    ? ((viewState.stats.blockedCount / totalKeywords) * 100).toFixed(2)
    : '0.0';

  const viewLabels: Record<ActiveKeywordView, string> = {
    ungrouped: `View 1 (UG; ${viewState.stats.ungroupedCount.toLocaleString()}/${ungroupedPercent}%)`,
    grouped: `View 2 (G; ${viewState.stats.groupedPages.toLocaleString()}/${viewState.stats.groupedKeywordsCount.toLocaleString()}/${groupedPercent}%)`,
    confirmed: `View 3 (C; ${(viewState.stats.confirmedPages || 0).toLocaleString()}/${(viewState.stats.confirmedKeywordsCount || 0).toLocaleString()}/${confirmedPercent}%)`,
    blocked: `View 4 (${viewState.stats.blockedCount.toLocaleString()}/${blockedPercent}%)`,
  };

  const showSelectedParentCount = viewState.activeView === 'grouped' && tableState.selectedKeywordIds.size > 0;

  return (
    <>
      <div className="flex flex-col gap-1 pb-2 border-b border-border">
        <h2 className="text-[15px] font-semibold text-foreground">Keyword Management</h2>
        {showSelectedParentCount && (
          <span className="text-xs text-muted">
            Selected parent keywords: {viewState.selectedParentKeywordCount.toLocaleString()}
          </span>
        )}
      </div>
      <div className="flex flex-col justify-end mb-4 gap-3 shrink-0 bg-surface-muted/40 rounded-lg p-2">
        <div className="flex items-center gap-2 w-full justify-end">
          <VolumeInputs
            minVolume={filterValues.minVolume}
            maxVolume={filterValues.maxVolume}
            onMinVolumeChange={filterHandlers.onMinVolumeChange}
            onMaxVolumeChange={filterHandlers.onMaxVolumeChange}
          />
          <LengthInputs
            minLength={filterValues.minLength}
            maxLength={filterValues.maxLength}
            onMinLengthChange={filterHandlers.onMinLengthChange}
            onMaxLengthChange={filterHandlers.onMaxLengthChange}
          />
          <DifficultyInputs
            minDifficulty={filterValues.minDifficulty}
            maxDifficulty={filterValues.maxDifficulty}
            onMinDifficultyChange={filterHandlers.onMinDifficultyChange}
            onMaxDifficultyChange={filterHandlers.onMaxDifficultyChange}
          />
          <RatingInputs
            minRating={filterValues.minRating}
            maxRating={filterValues.maxRating}
            onMinRatingChange={filterHandlers.onMinRatingChange}
            onMaxRatingChange={filterHandlers.onMaxRatingChange}
          />
        </div>

        <SelectionToolbar
          activeView={viewState.activeView}
          viewLabels={viewLabels}
          keywordsCount={tableState.keywordsToDisplay.length}
          pagination={tableState.pagination}
          isLoadingData={tableState.isLoadingData}
          onViewChange={tableHandlers.onViewChange}
          onLimitChange={tableHandlers.onLimitChange}
        />
      </div>

      <KeywordTableContainer
        tableState={{
          groupedKeywords: tableState.keywordsToDisplay,
          isLoadingData: tableState.isLoadingData,
          isTableLoading: tableState.isTableLoading,
          loadingChildren: tableState.loadingChildren,
          expandedGroups: tableState.expandedGroups,
          selectedKeywordIds: tableState.selectedKeywordIds,
          selectedTokens: tableState.selectedTokens,
          sortParams: tableState.sortParams,
          isAllSelected: tableState.isAllSelected,
          isAnySelected: tableState.isAnySelected,
          projectId: tableState.projectIdStr,
          currentView: viewState.activeView,
          pagination: tableState.pagination,
        }}
        handlers={{
          toggleGroupExpansion: tableHandlers.toggleGroupExpansion,
          toggleKeywordSelection: tableHandlers.toggleKeywordSelection,
          toggleTokenSelection: tableHandlers.toggleTokenSelection,
          removeToken: tableHandlers.removeToken,
          onSort: tableHandlers.onSort,
          onSelectAllClick: tableHandlers.onSelectAllClick,
          onMiddleClickGroup: tableHandlers.onMiddleClickGroup,
          onPageChange: tableHandlers.onPageChange,
        }}
        serpFilters={serpFilters}
      />
    </>
  );
});

MainContent.displayName = 'MainContent';
