import React, { useMemo } from 'react';
import { TokenData, TokenSortParams, TokenActiveView, TokenKeywordSummary } from '../types';
import { ArrowUp, ArrowDown, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { TokenKeywordPopover } from './TokenKeywordPopover';

interface TokenTableProps {
  tokens: TokenData[];
  selectedTokenNames: Set<string>;
  expandedTokens: Set<string>;
  onSelectAll: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleSelection: (tokenName: string) => void;
  onToggleExpansion: (tokenName: string) => void;
  onTokenClick: (tokenName: string) => void;
  onBlockToken: (tokenName: string) => void;
  onUnblockToken: (tokenName: string) => void;
  onUnmergeToken: (tokenName: string) => void;
  onTokenHover: (tokenName: string | null) => void;
  hoveredToken: string | null;
  isLoading: boolean;
  isProcessingAction: boolean;
  sortParams: TokenSortParams;
  onSort: (column: string) => void;
  getTopKeywords: (token: TokenData) => TokenKeywordSummary[];
  activeTokenView: TokenActiveView;
  onUnmergeIndividualToken: (parentToken: string, childToken: string) => void;
}

export function TokenTable({
  tokens,
  selectedTokenNames,
  expandedTokens,
  onSelectAll,
  onToggleSelection,
  onToggleExpansion,
  onTokenClick,
  onBlockToken,
  onUnblockToken,
  onUnmergeToken,
  onTokenHover,
  hoveredToken,
  isProcessingAction,
  sortParams,
  onSort,
  getTopKeywords,
  activeTokenView,
  onUnmergeIndividualToken,
}: TokenTableProps) {
  const compactNumberFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
    []
  );

  const renderSortIcon = (column: string) => {
    if (sortParams.column === column) {
      return sortParams.direction === 'asc' ? (
        <ArrowUp className="h-3 w-3 ml-1" />
      ) : (
        <ArrowDown className="h-3 w-3 ml-1" />
      );
    }
    return null;
  };

  const renderSortableHeader = (
    column: string,
    label: string,
    align: 'left' | 'right' = 'left',
    className = ''
  ) => (
    <th
      scope="col"
      className={`px-1 py-1.5 text-${align} text-[13px] font-light text-foreground uppercase tracking-wider cursor-pointer hover:text-muted ${className}`}
      onClick={() => onSort(column)}
    >
      <div className={`flex items-center ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {renderSortIcon(column)}
      </div>
    </th>
  );

  const allSelected = useMemo(() => {
    return tokens.length > 0 && selectedTokenNames.size === tokens.length;
  }, [tokens, selectedTokenNames]);

  const EmptyState = () => (
    <tr>
      <td colSpan={6} className="px-4 py-8 text-center text-muted">
        <div className="flex flex-col items-center justify-center space-y-2">
          <AlertCircle className="h-8 w-8 text-muted" />
          <p>No tokens found</p>
          {activeTokenView === 'current' && (
            <p className="text-xs max-w-md">Try changing your search or view settings</p>
          )}
        </div>
      </td>
    </tr>
  );

  return (
   <div className="relative h-full">
        <table className="w-full table-fixed divide-y divide-gray-200 text-xs">
          <colgroup>
            <col className="w-[36px]" />
            <col className="w-auto" />
            <col className="w-[52px]" />
            <col className="w-[64px]" />
            <col className="w-[52px]" />
            <col className="w-[56px]" />
          </colgroup>
          <thead className="bg-surface-muted sticky top-0 z-5">
            <tr>
              <th scope="col" className="px-1 py-1.5 text-left">
                <input
                  type="checkbox"
                  className="rounded border-border w-4 h-4 text-blue-600"
                  checked={allSelected}
                  onChange={onSelectAll}
                  disabled={tokens.length === 0}
                  aria-label={allSelected ? 'Deselect all tokens' : 'Select all tokens'}
                />
              </th>
              {renderSortableHeader('tokenName', 'Token', 'left')}
              {renderSortableHeader('count', 'Ct.', 'right')}
              {renderSortableHeader('volume', 'Vol', 'right')}
              {renderSortableHeader('difficulty', 'Diff', 'right')}
              <th
                scope="col"
                className="px-1 py-1.5 text-center text-[13px] font-light text-foreground uppercase tracking-wider"
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tokens.length === 0 ? <EmptyState /> : (
              tokens.map((token, index) => {
                const rowBgClass = index % 2 === 0 ? 'bg-table-row' : 'bg-table-row-alt';
                const isSelected = selectedTokenNames.has(token.tokenName);
                const isExpanded = expandedTokens.has(token.tokenName);
                const hasChildren = token.hasChildren || (token.childTokens && token.childTokens.length > 0);

                return (
                  <React.Fragment key={token.tokenName}>
                    <tr
                      className={`${rowBgClass} ${isSelected ? 'bg-surface-muted' : ''} hover:bg-surface-muted ${
                        hasChildren ? 'border-b-0' : ''
                      }`}
                    >
                      <td className={`px-1 py-1 whitespace-nowrap ${isSelected ? 'bg-surface-muted' : rowBgClass}`}>
                        <input
                          type="checkbox"
                          className="rounded border-border text-blue-600"
                          checked={isSelected}
                          onChange={() => onToggleSelection(token.tokenName)}
                          disabled={isProcessingAction}
                          aria-label={isSelected ? `Deselect ${token.tokenName}` : `Select ${token.tokenName}`}
                        />
                      </td>
                      <td
                        className={`pr-0.5 pl-1 py-1 whitespace-nowrap text-[13px] font-medium text-foreground relative ${isSelected ? 'bg-surface-muted' : rowBgClass}`}
                        onMouseEnter={() => onTokenHover(token.tokenName)}
                        onMouseLeave={() => onTokenHover(null)}
                      >
                        <div className="flex items-center min-w-0">
                          <span
                            onClick={() => onTokenClick(token.tokenName)}
                            className="hover:text-blue-500 hover:underline cursor-pointer truncate"
                            title={token.tokenName}
                          >
                            {token.tokenName}
                          </span>
                          {hasChildren && (
                            <button
                              onClick={() => onToggleExpansion(token.tokenName)}
                              className="hover:cursor-pointer ml-1 h-4 w-4 flex items-center justify-center text-muted hover:text-foreground"
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                        {hoveredToken === token.tokenName && (
                          <TokenKeywordPopover token={token} getTopKeywords={getTopKeywords} index={index} />
                        )}
                      </td>
                      <td className="pl-0.5 pr-1 py-1 whitespace-nowrap text-[13px] text-right text-muted tabular-nums">
                        {token.count ?? 'N/A'}
                      </td>
                      <td
                        className="px-1 py-1 whitespace-nowrap text-[13px] text-right text-muted tabular-nums"
                        title={token.volume != null ? token.volume.toLocaleString() : undefined}
                      >
                        {token.volume != null ? compactNumberFormatter.format(token.volume) : 'N/A'}
                      </td>
                      <td className="px-1 py-1 whitespace-nowrap text-[13px] text-right text-muted tabular-nums">
                        {token.difficulty != null ? Number(token.difficulty).toFixed(0) : 'N/A'}
                      </td>
                      <td className="px-1 py-1 whitespace-nowrap text-center flex items-center justify-center space-x-1">
                        {activeTokenView === 'blocked' ? (
                          <button
                            onClick={() => onUnblockToken(token.tokenName)}
                            disabled={isProcessingAction}
                            className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            title={`Unblock token "${token.tokenName}"`}
                            aria-label={`Unblock token "${token.tokenName}"`}
                          />
                        ) : activeTokenView === 'merged' && hasChildren ? (
                          <button
                            onClick={() => onUnmergeToken(token.tokenName)}
                            disabled={isProcessingAction}
                            className="text-[10px] px-1 py-0.5 bg-surface-muted cursor-pointer hover:bg-surface-muted/70 text-foreground rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={`Unmerge token "${token.tokenName}"`}
                          >
                            Unmerge
                          </button>
                        ) : (
                          <button
                            onClick={() => onBlockToken(token.tokenName)}
                            disabled={isProcessingAction}
                            className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
                            aria-label={`Block token "${token.tokenName}"`}
                          />
                        )}
                      </td>
                    </tr>

                    {isExpanded && hasChildren && (
                      <tr className="bg-surface-muted/60">
                        <td colSpan={6} className="px-2 py-1">
                          <div className="pl-8 border-l-2 border-border">
                            {token.childTokens && token.childTokens.length > 0 ? (
                              <div className="space-y-1">
                                {token.childTokens.map(childToken => (
                                  <div
                                    key={childToken}
                                    className="flex items-center justify-between text-[12px] py-0.5"
                                  >
                                    <span className="text-foreground truncate" title={childToken}>
                                      {childToken}
                                    </span>
                                    <div className="flex items-center space-x-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onUnmergeIndividualToken(token.tokenName, childToken);
                                        }}
                                        disabled={isProcessingAction}
                                        className="text-[10px] px-1 py-0.5 bg-surface-muted hover:bg-surface-muted/70 text-foreground rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={`Unmerge "${childToken}" from "${token.tokenName}"`}
                                        aria-label={`Unmerge "${childToken}" from "${token.tokenName}"`}
                                      >
                                        Unmerge
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[12px] text-muted py-1">No child tokens available</div>
                            )}
                          </div>
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
  );
}
