import React, { memo, useRef } from 'react';
import { Loader2, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { Keyword,  ActiveKeywordView } from './types';

const isExpandable = (keyword: Keyword): boolean => !!keyword.isParent && (keyword.childCount ?? 0) > 0 && !!keyword.groupId;

export const KeywordRow: React.FC<{
    keyword: Keyword;
    isChild: boolean;
    isGroupExpanded: boolean;
    isLoadingThisGroupChildren: boolean;
    isSelected: boolean;
    onToggleSelection: (id: number) => void;
    onToggleExpansion: (groupId: string, hasChildren: boolean) => void;
    onToggleToken: (token: string, event: React.MouseEvent) => void;
    selectedTokens: string[];
    selectedKeywordIds: Set<number>;
    removeToken: (token: string) => void;
    onMiddleClickGroup: (keywordIds: number[]) => void;
    index: number;
    currentView: ActiveKeywordView;
  }> = memo(({
    keyword,
    isChild,
    isGroupExpanded,
    isLoadingThisGroupChildren,
    isSelected,
    onToggleSelection,
    onToggleExpansion,
    onToggleToken,
    selectedTokens,
    selectedKeywordIds,
    onMiddleClickGroup,
    index,
    currentView,
  }) => {
    const expandable = !isChild && isExpandable(keyword);
    const groupId = keyword.groupId;
  
    const displayText = (!isChild && currentView === 'grouped' && keyword.groupName)
      ? keyword.groupName
      : keyword.keyword;
  
    const orderedTokens = React.useMemo(() => {
      if (!keyword.tokens || keyword.tokens.length === 0 || !keyword.keyword) return [];
      const keywordLower = keyword.keyword.toLowerCase();
      const tokenSet = new Set(keyword.tokens);
      const tokensInOrder: string[] = [];
      const words = keywordLower.split(/\s+/);
      words.forEach(word => {
        if (tokenSet.has(word) && !tokensInOrder.includes(word)) {
          tokensInOrder.push(word);
        }
      });
      keyword.tokens.forEach(token => {
        if (!tokensInOrder.includes(token) && !tokensInOrder.includes(token)) {
          tokensInOrder.push(token);
        }
      });
      return tokensInOrder;
    }, [keyword.keyword, keyword.tokens]);
  
    const handleRowClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (expandable && groupId) {
        onToggleExpansion(groupId, (keyword.childCount ?? 0) > 0);
      }
    };
  
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (!(e.nativeEvent as MouseEvent).shiftKey) {
        onToggleSelection(keyword.id);
      }
    };
    const checkboxRef = useRef<HTMLInputElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.currentTarget.blur();
      if (e.key === 'Shift' || e.key === 'Control') {
        e.preventDefault();
        e.stopPropagation();
        if (checkboxRef.current) {
          checkboxRef.current.blur();
        }
      }
    };
    const handleTokenClick = (token: string, event: React.MouseEvent) => {
      event.stopPropagation();
      if (event.ctrlKey || event.metaKey) {
        onToggleToken(token, event);
      } else {
        onToggleToken(token, event);
      }
    };
  
    const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();

        const windowWithHandling = window as Window & { __handlingMiddleClick?: boolean };
        if (windowWithHandling.__handlingMiddleClick) return;
        windowWithHandling.__handlingMiddleClick = true;

        try {
          if (currentView === 'ungrouped') {
            // If there are selected keywords, group them all (include clicked keyword if not already selected)
            // If no keywords selected, just group the clicked keyword
            let keywordIds: number[];
            if (selectedKeywordIds.size > 0) {
              // Use all selected keywords, adding the clicked one if not already in selection
              const selectedArray = Array.from(selectedKeywordIds);
              if (!selectedKeywordIds.has(keyword.id)) {
                selectedArray.push(keyword.id);
              }
              keywordIds = selectedArray;
            } else {
              // No selection, just group the clicked keyword
              keywordIds = [keyword.id];
            }

            if (keywordIds.length === 0) return;

            onMiddleClickGroup(keywordIds);
          }
        } finally {
          setTimeout(() => {
            windowWithHandling.__handlingMiddleClick = false;
          }, 300);
        }
      }
    };
    const keywordPaddingClass = isChild ? 'pl-6' : 'pl-1';
    const rowBgClass = index % 2 === 0 ? 'bg-table-row' : 'bg-table-row-alt';
    const stickyBgClass = isSelected ? 'bg-surface-muted' : rowBgClass;
    const showCheckbox = currentView !== 'ungrouped' || !isChild;
    const showRatingColumn = currentView === 'ungrouped' || currentView === 'grouped';
  
    return (
      <tr
        className={`${rowBgClass} hover:bg-surface-muted transition-colors duration-100 ${expandable ? 'cursor-pointer' : ''} ${isSelected ? 'bg-surface-muted' : ''} h-8`}
        onMouseDown={handleMouseDown}
      >
        <td className={`w-[44px] px-2 py-1 whitespace-nowrap sticky left-0 z-10 ${stickyBgClass}`} onClick={e => e.stopPropagation()}>
          {showCheckbox && (
            <input
              type="checkbox"
              ref={checkboxRef}
              className="h-6 w-4.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
              checked={isSelected}
              onChange={handleCheckboxChange}
              onKeyDown={handleKeyDown}
              tabIndex={-1}
              onFocus={(e) => e.currentTarget.blur()}
              aria-label={`Select keyword ${keyword.keyword}`}
            />
          )}
          {!showCheckbox && <span className="w-6 inline-block"></span>}
        </td>
        <td className={`w-[36%] py-1 text-ui-body font-light sticky left-[44px] z-10 ${stickyBgClass}`}>
          <div className={`flex items-start gap-x-0.5 ${keywordPaddingClass}`}>
            <span className="break-words leading-tight" title={displayText}>{displayText}</span>
            <span className="w-5 h-5 inline-flex items-center justify-center flex-shrink-0 flex-shrink-0" onClick={handleRowClick}>
              {expandable ? (
                isLoadingThisGroupChildren ? (
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                ) : (
                  isGroupExpanded ? (
                    <ChevronDown size={16} className="text-muted" />
                  ) : (
                    <ChevronRight size={16} className="text-muted" />
                  )
                )
              ) : (isChild ? <span className="w-5 h-5 inline-block flex-shrink-0"></span> : null)}
            </span>
          </div>
        </td>
        <td className="w-[44%] py-1 text-ui-body whitespace-nowrap">
          <div className="flex flex-wrap gap-1 items-center">
            {orderedTokens.length > 0 ? (
              orderedTokens.map((token, index) => (
                <span
                  key={`token-${keyword.id}-${index}`}
                  onClick={(e) => handleTokenClick(token, e)}
                  className={`inline-block px-1.5 py-0.5 rounded text-ui-meta font-light cursor-pointer transition-colors duration-150 whitespace-nowrap ${
                    selectedTokens.includes(token)
                      ? 'bg-accent text-on-primary'
                      : 'bg-surface-container-high text-foreground hover:bg-surface-container-highest hover:shadow-sm'
                  }`}
                >
                  {token}
                </span>
              ))
            ) : (
              <span className="text-ui-meta text-muted italic">No tokens</span>
            )}
          </div>
        </td>
        <td className="w-[40px] px-0.5 py-1 text-ui-meta text-foreground overflow-hidden group relative">
          {keyword.serpFeatures && keyword.serpFeatures.length > 0 ? (
            <div
              className="flex justify-center cursor-default relative"
              title={keyword.serpFeatures.join(', ')}
            >
              <Layers className="w-3 h-3 text-muted" />
              <div className="fixed z-[9999] bg-surface text-foreground shadow-lg rounded p-2 max-w-xs hidden group-hover:block border border-border"
                  style={{
                    left: 'auto',
                    right: 'auto',
                    top: 'auto',
                    transform: 'translateY(10px)'
                  }}>
                <ul className="list-disc pl-4 text-ui-meta">
                  {keyword.serpFeatures.map((feature, idx) => (
                    <li key={idx}>{feature}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <span className="text-ui-meta text-muted italic"></span>
          )}
        </td>
        <td className="w-[40px] px-0.5 py-1 text-ui-body text-center whitespace-nowrap">
          {!isChild && (keyword.childCount ?? 0) > 0 ? (
            <span className="inline-block bg-primary-container text-on-primary-container text-ui-meta font-semibold px-1 py-0.5 rounded-full">
              {(keyword.childCount ?? 0).toLocaleString()}
            </span>
          ) : null}
        </td>
        <td className="w-[35px] px-0.5 py-1 text-ui-body text-center whitespace-nowrap">
          {keyword.keyword.length}
        </td>
        <td className="w-[40px] px-0.5 py-1 text-ui-body text-center whitespace-nowrap">
          {(keyword.volume ?? 0).toLocaleString()}
        </td>
        <td className="w-[40px] px-0.5 py-1 text-ui-body text-center whitespace-nowrap">
          {(keyword.difficulty ?? 0).toFixed(1)}
        </td>
        {showRatingColumn && (
          <td className="w-[35px] px-0.5 py-1 text-ui-body text-center whitespace-nowrap">
            {keyword.rating !== null && keyword.rating !== undefined ? keyword.rating : '-'}
          </td>
        )}
      </tr>
    );
  });
  KeywordRow.displayName = 'KeywordRow';
  
