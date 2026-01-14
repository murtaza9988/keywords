"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';

import { CreateTokenModal } from './CreateTokenModal';
import { TokenMergePanel } from './TokenMergePanel';
import { TokenPagination } from './TokenPagination';
import { TokenSearchBar } from './TokenSearchBar';
import { TokenTable } from './TokenTable';
import type { TokenManagementProps } from './types';
import { MINIMUM_SEARCH_LENGTH, TOKEN_LIMIT_OPTIONS, useTokenManagement } from './useTokenManagement';

export function TokenManagement({
  projectId,
  onBlockTokenSuccess,
  onUnblockTokenSuccess,
  onTokenDataChange,
  addSnackbarMessage,
  activeViewKeywords,
  toggleTokenSelection,
  activeView,
}: TokenManagementProps) {
  const {
    activeTokenView,
    tokens,
    pagination,
    sortParams,
    searchTerm,
    showMinimumCharInfo,
    isLoading,
    isProcessingAction,
    selectedTokenNames,
    expandedTokens,
    hoveredToken,
    showCreateToken,
    newTokenName,
    isCreatingToken,
    handleSearchChange,
    handleClearSearch,
    handleMergeSelected,
    handleViewChange,
    handlePageChange,
    handleLimitChange,
    handleSelectAllClick,
    toggleLocalTokenSelection,
    toggleTokenExpansion,
    handleBlockSelected,
    handleUnblockSelected,
    handleBlockSingleToken,
    handleCreateToken,
    handleConfirmCreateToken,
    handleCancelCreateToken,
    handleUnblockSingleToken,
    handleUnmergeToken,
    handleSort,
    handleTokenClick,
    getTopKeywords,
    handleUnmergeIndividualToken,
    setHoveredToken,
    setNewTokenName,
  } = useTokenManagement({
    projectId,
    onBlockTokenSuccess,
    onUnblockTokenSuccess,
    onTokenDataChange,
    addSnackbarMessage,
    activeViewKeywords,
    toggleTokenSelection,
    activeView,
  });

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-[15px] font-semibold mb-4 text-foreground">Token Management</h2>

      <div className="relative">
        <TokenSearchBar
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          onClearSearch={handleClearSearch}
          onCreateToken={handleCreateToken}
        />

        {showMinimumCharInfo && (
          <div className="text-xs text-muted mt-1 absolute top-full left-0">
            Type at least {MINIMUM_SEARCH_LENGTH} characters to search...
          </div>
        )}
      </div>

      <TokenMergePanel
        isProcessingAction={isProcessingAction}
        selectedTokensCount={selectedTokenNames.size}
        onBlockSelected={handleBlockSelected}
        onUnblockSelected={handleUnblockSelected}
        onMergeSelected={handleMergeSelected}
        isBlockedView={activeTokenView === 'blocked'}
        activeView={activeTokenView}
        onViewChange={handleViewChange}
        limit={pagination.limit}
        limitOptions={TOKEN_LIMIT_OPTIONS}
        onLimitChange={handleLimitChange}
      />

      <div className="flex flex-col flex-1 min-h-0 border border-border rounded-md bg-white overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-auto relative">
          {isLoading ? (
            <div className="flex justify-center items-center h-full w-full bg-white absolute inset-0 z-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : tokens.length > 0 ? (
            <TokenTable
              tokens={tokens}
              selectedTokenNames={selectedTokenNames}
              expandedTokens={expandedTokens}
              onSelectAll={handleSelectAllClick}
              onToggleSelection={toggleLocalTokenSelection}
              onToggleExpansion={toggleTokenExpansion}
              onTokenClick={handleTokenClick}
              onBlockToken={handleBlockSingleToken}
              onUnblockToken={handleUnblockSingleToken}
              onUnmergeToken={handleUnmergeToken}
              onUnmergeIndividualToken={handleUnmergeIndividualToken}
              isLoading={false}
              isProcessingAction={isProcessingAction}
              sortParams={sortParams}
              onSort={handleSort}
              getTopKeywords={getTopKeywords}
              onTokenHover={setHoveredToken}
              hoveredToken={hoveredToken}
              activeTokenView={activeTokenView}
            />
          ) : (
            <div className="flex justify-center items-center h-full">
              <p className="text-muted">No tokens found</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-border bg-white px-2 py-2">
          <TokenPagination pagination={pagination} onPageChange={handlePageChange} isLoading={isLoading} />
        </div>
      </div>

      {showCreateToken && (
        <CreateTokenModal
          searchTerm={searchTerm}
          tokenName={newTokenName}
          onTokenNameChange={setNewTokenName}
          onConfirm={handleConfirmCreateToken}
          onCancel={handleCancelCreateToken}
          isCreating={isCreatingToken}
        />
      )}
    </div>
  );
}
