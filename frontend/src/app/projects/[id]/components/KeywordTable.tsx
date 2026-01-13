/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { memo, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { Keyword, GroupedKeywordsDisplay, ActiveKeywordView, SortParams } from './types';
import { KeywordRow } from './KeywordRow';
import fetchSerpFeatures  from '@/lib/apiClient';
import apiClient from '@/lib/apiClient';
import authService from '@/lib/authService';

interface KeywordTableProps {
  groupedKeywords: GroupedKeywordsDisplay[];
  loading: boolean;
  isTableLoading: boolean;
  loadingChildren: Set<string>;
  expandedGroups: Set<string>;
  toggleGroupExpansion: (groupId: string, hasChildren: boolean) => void;
  selectedKeywordIds: Set<number>;
  toggleKeywordSelection: (keywordId: number) => void;
  selectedTokens: string[];
  toggleTokenSelection: (token: string, event: React.MouseEvent) => void;
  removeToken: (token: string) => void;
  projectId: string;
  currentView: ActiveKeywordView;
  sortParams: SortParams;
  onSort: (column: keyof Keyword | 'groupName' | 'serpFeatures', direction?: 'asc' | 'desc') => void;
  isAllSelected: boolean;
  isAnySelected: boolean;
  handleSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleMiddleClickGroup: (keywordIds: number[]) => void;
  onSerpFilterChange?: (features: string[]) => void;
}

interface FilterState {
  serpFeatures: string[];
}

export const KeywordTable: React.FC<KeywordTableProps> = memo(({
  groupedKeywords,
  loading,
  isTableLoading,
  loadingChildren,
  expandedGroups,
  toggleGroupExpansion,
  selectedKeywordIds,
  toggleKeywordSelection,
  selectedTokens,
  toggleTokenSelection,
  removeToken,
  projectId,
  currentView,
  sortParams,
  onSort,
  isAllSelected,
  isAnySelected,
  handleSelectAllClick,
  handleMiddleClickGroup,
  onSerpFilterChange
}) => {
  const renderSortIcon = (columnKey: keyof Keyword | 'groupName' | 'serpFeatures') => {
    if (sortParams.column !== columnKey) {
      return <ChevronsUpDown className="h-4 w-4 ml-1 text-gray-400 inline-block" />;
    }
    return sortParams.direction === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-1 text-gray-600 inline-block" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1 text-gray-600 inline-block" />
    );
  };

  const [showSerpFilter, setShowSerpFilter] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    serpFeatures: [],
  });
  const [filteredData, setFilteredData] = useState<GroupedKeywordsDisplay[]>([]);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [serpFeaturesList, setSerpFeaturesList] = useState<string[]>([]);
  const [isLoadingSerpFeatures, setIsLoadingSerpFeatures] = useState(false);
  const serpFilterButtonRef = useRef<HTMLButtonElement>(null);
  const serpFilterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSerpFeaturesData = async () => {
      if (!projectId) return;
      
      setIsLoadingSerpFeatures(true);
      try {
        if (!authService.isAuthenticated()) {
          console.error('No token found');
          return;
        }
        
        const features = await apiClient.fetchSerpFeatures(projectId);
        setSerpFeaturesList(features);
      } catch (error) {
        console.error('Error fetching SERP features:', error);
      } finally {
        setIsLoadingSerpFeatures(false);
      }
    };
    
    fetchSerpFeaturesData();
  }, [projectId]);

  const getSerpFeatures = (item: any): string[] => {
    if (!item || !item.serpFeatures) return [];
    if (Array.isArray(item.serpFeatures)) return item.serpFeatures;
    if (typeof item.serpFeatures === 'string') {
      try {
        const parsed = JSON.parse(item.serpFeatures);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  };
  const arraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
  };
  const applyFilters = useCallback((newFilterState: FilterState) => {
    let result: GroupedKeywordsDisplay[] = groupedKeywords.map(group => ({
      ...group,
      children: group.children ? [...group.children] : [],
    }));
  
    if (newFilterState.serpFeatures.length > 0) {
      result = result.map(group => {
        const parentFeatures = getSerpFeatures(group.parent);
        const parentMatches = parentFeatures.length > 0
          ? newFilterState.serpFeatures.every(f => parentFeatures.includes(f))
          : false;
        
        const filteredChildren = group.children?.filter(child => {
          const childFeatures = getSerpFeatures(child);
          return childFeatures.length > 0
            ? newFilterState.serpFeatures.every(f => childFeatures.includes(f))
            : false;
        }) || [];
        
        return {
          ...group,
          children: filteredChildren,
          parent: parentMatches ? group.parent : { ...group.parent, serpFeatures: [] },
        };
      }).filter(group =>
        (getSerpFeatures(group.parent).length > 0 && newFilterState.serpFeatures.every(f => getSerpFeatures(group.parent).includes(f))) 
        || (group.children && group.children.length > 0)
      );
    }
    setFilteredData(result);
    if (onSerpFilterChange && !arraysEqual(newFilterState.serpFeatures, filterState.serpFeatures)) {
      onSerpFilterChange(newFilterState.serpFeatures);
    }
  }, [groupedKeywords, onSerpFilterChange, filterState.serpFeatures]);

const toggleSerpFeature = useCallback((feature: string) => {
  setFilterState(prev => {
    const newFeatures = prev.serpFeatures.includes(feature)
      ? prev.serpFeatures.filter(f => f !== feature)
      : [...prev.serpFeatures, feature];
    if (!arraysEqual(newFeatures, prev.serpFeatures)) {
      const newState = { ...prev, serpFeatures: newFeatures };
      applyFilters(newState);
      return newState;
    }
    
    return prev;
  });
}, [applyFilters]);

  const onSelectAllSerpFeatures = useCallback(() => {
    setFilterState(prev => {
      const newState = { ...prev, serpFeatures: serpFeaturesList };
      applyFilters(newState);
      return newState;
    });
  }, [serpFeaturesList, applyFilters]);

  const onClearFilters = useCallback(() => {
    setFilterState({ serpFeatures: [] });
    setFilteredData(groupedKeywords);
    if (onSerpFilterChange) {
      onSerpFilterChange([]);
    }
  }, [groupedKeywords, onSerpFilterChange]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (filterState.serpFeatures.length > 0) {
      e.preventDefault();
      onClearFilters();
    }
  }, [filterState, onClearFilters]);

  useEffect(() => {
    if (showSerpFilter && serpFilterButtonRef.current) {
      const buttonRect = serpFilterButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: buttonRect.bottom + window.scrollY + 5,
        left: buttonRect.left + window.scrollX,
      });
    }
  }, [showSerpFilter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showSerpFilter &&
        serpFilterDropdownRef.current &&
        !serpFilterDropdownRef.current.contains(event.target as Node) &&
        serpFilterButtonRef.current &&
        !serpFilterButtonRef.current.contains(event.target as Node)
      ) {
        setShowSerpFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSerpFilter]);

  useEffect(() => {
    applyFilters(filterState);
  }, [groupedKeywords, applyFilters]);

  const keywordColumnKey = currentView === 'grouped' ? 'groupName' : 'keyword';
  const keywordColumnHeader = currentView === 'grouped' ? 'Page Name' : 'Keyword';
  const displayData = filterState.serpFeatures.length > 0 ? filteredData : groupedKeywords;

  return (
    <div className="flex flex-col lg:h-[calc(100vh-400px)]  border border-[#eaeaea] shadow-sm">
      <div className="flex-1 overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr onDoubleClick={handleDoubleClick}>
              <th scope="col" className="w-8 px-3 py-1 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  className="h-6 w-6 rounded border-[#eaeaea] text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={isAllSelected}
                  ref={input => { if (input) input.indeterminate = !isAllSelected && isAnySelected }}
                  onChange={handleSelectAllClick}
                  aria-label={isAllSelected ? "Deselect all" : "Select all"}
                  disabled={groupedKeywords.length === 0}
                />
              </th>
              <th scope="col" className="w-[30%] py-1 text-left text-[13px] font-light text-gray-800 uppercase tracking-wider cursor-pointer" onClick={() => onSort(keywordColumnKey)}>
                <div className="flex items-center">
                  <span>{keywordColumnHeader}</span>
                  {renderSortIcon(keywordColumnKey)}
                </div>
              </th>
              <th scope="col" className="w-[18%] px-2 py-1 text-left text-[13px] font-light text-gray-800 uppercase tracking-wider">Tokens</th>
              <th scope="col" className="w-14 px-2 py-1 text-left text-[13px] font-light text-gray-800 uppercase tracking-wider">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span>SERP</span>
                    {filterState.serpFeatures.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-blue-600" title="Filters active"></span>
                    )}
                    <button
                      className="text-gray-500 hover:text-gray-700 focus:outline-none p-2 rounded-full hover:bg-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSerpFilter(prev => !prev);
                      }}
                      ref={serpFilterButtonRef}
                      disabled={isLoadingSerpFeatures}
                    >
                      {isLoadingSerpFeatures ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                {showSerpFilter && createPortal(
                  <div
                    className="bg-white shadow-xl rounded-lg border border-gray-200 w-64 z-[9999]"
                    style={{
                      position: 'absolute',
                      top: dropdownPosition.top + 'px',
                      left: dropdownPosition.left + 'px',
                    }}
                    ref={serpFilterDropdownRef}
                  >
                    <div className="p-3">
                      <div className="text-xs font-semibold text-gray-700 mb-2">Filter by Values</div>
                      <div className="max-h-60 overflow-y-auto">
                        {isLoadingSerpFeatures ? (
                          <div className="flex justify-center items-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-600" />
                            <span className="text-sm text-gray-600">Loading SERP features...</span>
                          </div>
                        ) : serpFeaturesList.length === 0 ? (
                          <div className="text-sm text-gray-500 py-2 px-2 italic">
                            No SERP features found
                          </div>
                        ) : (
                          serpFeaturesList.map(feature => (
                            <label
                              key={feature}
                              className="flex items-center px-2 py-1 hover:bg-gray-100 rounded text-sm cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={filterState.serpFeatures.includes(feature)}
                                onChange={() => toggleSerpFeature(feature)}
                              />
                              <span className="truncate">{feature}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="p-3 border-t border-gray-200 bg-gray-50 flex justify-between">
                      <button
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        onClick={onSelectAllSerpFeatures}
                        disabled={isLoadingSerpFeatures || serpFeaturesList.length === 0}
                      >
                        Select All
                      </button>
                      <button
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        onClick={onClearFilters}
                        disabled={isLoadingSerpFeatures || filterState.serpFeatures.length === 0}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>,
                  document.body
                )}
              </th>
              <th scope="col" className="w-10 px-2 py-1 text-center text-[13px] font-light text-gray-800 uppercase tracking-wider cursor-pointer" onClick={() => onSort('childCount')}>
                <div className="flex items-center justify-center">
                  <span>Counts</span>
                  {renderSortIcon('childCount')}
                </div>
              </th>
              <th scope="col" className="w-10 px-2 py-1 text-right text-[13px] font-light text-gray-800 uppercase tracking-wider cursor-pointer" onClick={() => onSort('length')}>
                <div className="flex items-center justify-end">
                  <span>LEN</span>
                  {renderSortIcon('length')}
                </div>
              </th>
              <th scope="col" className="w-10 px-2 py-1 text-right text-[13px] font-light text-gray-800 uppercase tracking-wider cursor-pointer" onClick={() => onSort('volume')}>
                <div className="flex items-center justify-end">
                  <span>Vol.</span>
                  {renderSortIcon('volume')}
                </div>
              </th>
              <th scope="col" className="w-10 px-2 py-1 text-right text-[13px] font-light text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-200" onClick={() => onSort('difficulty')}>
                <div className="flex items-center justify-end">
                  <span>Diff.</span>
                  {renderSortIcon('difficulty')}
                </div>
              </th>
              {(currentView === 'ungrouped' || currentView === 'grouped') && (
                <th scope="col" className="w-10 px-2 py-1 text-right text-[13px] font-light text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-200" onClick={() => onSort('rating')}>
                  <div className="flex items-center justify-end">
                    <span>Rt</span>
                    {renderSortIcon('rating')}
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(loading || isTableLoading) ? (
              <tr className="bg-white h-10">
                <td colSpan={currentView === 'ungrouped' || currentView === 'grouped' ? 9 : 8} className="px-4 py-2 text-center">
                  <div className="flex justify-center lg:mt-50 items-center flex-col text-gray-700">
                    <Loader2 className="animate-spin h-8 w-8 text-blue-600 mb-3" />
                    <p className="text-sm font-medium">{isTableLoading ? 'Processing...' : 'Loading...'}</p>
                  </div>
                </td>
              </tr>
            ) : displayData.length === 0 ? (
              <tr className="bg-white h-10">
                <td colSpan={currentView === 'ungrouped' || currentView === 'grouped' ? 9 : 8} className="px-4 py-2 text-center text-sm text-gray-700 italic">
                  {filterState.serpFeatures.length > 0
                    ? 'No keywords match the selected filters.'
                    : `No ${currentView === 'grouped' ? 'groups' : 'keywords'} found.`}
                </td>
              </tr>
            ) : (
              displayData.map((groupData, index) => {
                const parent = groupData.parent;
                const groupId = parent.groupId;
                const isParentExpanded = !!groupId && expandedGroups.has(groupId);
                const isLoadingThisParentChildren = !!groupId && loadingChildren.has(groupId);

                return (
                  <React.Fragment key={groupData.key}>
                    <KeywordRow
                      keyword={parent}
                      isChild={false}
                      isGroupExpanded={isParentExpanded}
                      isLoadingThisGroupChildren={isLoadingThisParentChildren}
                      isSelected={selectedKeywordIds.has(parent.id)}
                      onToggleSelection={toggleKeywordSelection}
                      onToggleExpansion={toggleGroupExpansion}
                      onToggleToken={toggleTokenSelection}
                      selectedTokens={selectedTokens}
                      selectedKeywordIds={selectedKeywordIds}
                      removeToken={removeToken}
                      onMiddleClickGroup={handleMiddleClickGroup}
                      index={index}
                      currentView={currentView}
                    />
                    {isParentExpanded && groupData.children?.map((child, childIndex) => (
                      <KeywordRow
                        key={`child-${groupId}-${child.id}-${childIndex}`}
                        keyword={child}
                        isChild={true}
                        isGroupExpanded={false}
                        isLoadingThisGroupChildren={false}
                        isSelected={selectedKeywordIds.has(child.id)}
                        onToggleSelection={toggleKeywordSelection}
                        onToggleExpansion={() => {}}
                        onToggleToken={toggleTokenSelection}
                        selectedTokens={selectedTokens}
                        selectedKeywordIds={selectedKeywordIds}
                        removeToken={removeToken}
                        onMiddleClickGroup={handleMiddleClickGroup}
                        index={index + childIndex + 1}
                        currentView={currentView}
                      />
                    ))}
                    {isParentExpanded && (!groupData.children || groupData.children.length === 0) && !isLoadingThisParentChildren && (parent.childCount ?? 0) > 0 && (
                      <tr className={`${index % 2 === 0 ? 'bg-[#f4f4f4]' : 'bg-white'} h-10`}>
                        <td colSpan={currentView === 'ungrouped' || currentView === 'grouped' ? 9 : 8} className="pl-6 px-2 py-2 text-xs text-gray-400 italic">
                          No children found or failed to load.
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        table {
          table-layout: fixed;
          width: 100%;
        }
        th, td {
          overflow: hidden;
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
});
KeywordTable.displayName = 'KeywordTable';