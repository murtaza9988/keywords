import React from 'react';

import { TokenActionButtons } from './TokenActionButton';
import { TokenViewTabs } from './TokenTableView';
import type { TokenMergePanelProps } from './types';

export function TokenMergePanel({
  isProcessingAction,
  selectedTokensCount,
  onBlockSelected,
  onUnblockSelected,
  onMergeSelected,
  isBlockedView,
  activeView,
  onViewChange,
  limit,
  limitOptions,
  onLimitChange,
}: TokenMergePanelProps) {
  return (
    <div className="space-y-2">
      <TokenActionButtons
        isProcessingAction={isProcessingAction}
        selectedTokensCount={selectedTokensCount}
        onBlockSelected={onBlockSelected}
        onUnblockSelected={onUnblockSelected}
        onMergeSelected={onMergeSelected}
        isBlockedView={isBlockedView}
      />

      <TokenViewTabs
        activeView={activeView}
        onViewChange={onViewChange}
        limit={limit}
        limitOptions={limitOptions}
        onLimitChange={onLimitChange}
      />
    </div>
  );
}
