import React from 'react';

interface TokenActionButtonsProps {
  isProcessingAction: boolean;
  selectedTokensCount: number;
  onBlockSelected: () => void;
  onUnblockSelected: () => void;
  onMergeSelected: () => void;
  isBlockedView: boolean;
}

export function TokenActionButtons({
  isProcessingAction,
  selectedTokensCount,
  onBlockSelected,
  onUnblockSelected,
  onMergeSelected,
  isBlockedView
}: TokenActionButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4 items-center">
      <button
        onClick={onBlockSelected}
        disabled={isProcessingAction || selectedTokensCount === 0}
        className={`px-3 py-2 border border-transparent rounded-md text-ui-body shadow-sm transition-all duration-200 ${
          selectedTokensCount > 0
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-400 text-white shadow-none cursor-not-allowed'
        }`}
      >
        Block
      </button>

      <button
        onClick={onUnblockSelected}
        disabled={isProcessingAction || selectedTokensCount === 0 || !isBlockedView}
        className={`px-3 py-2 rounded-md text-ui-body shadow-sm transition-all duration-200 ${
          selectedTokensCount > 0 && isBlockedView
            ? 'bg-yellow-500 text-white hover:bg-yellow-600'
            : 'bg-gray-400 text-white shadow-none cursor-not-allowed'
        }`}
      >
        Unblock
      </button>

      <button
        onClick={onMergeSelected}
        disabled={isProcessingAction || selectedTokensCount < 2}
        className={`px-3 py-2 border border-transparent rounded-md text-ui-body shadow-sm transition-all duration-200 ${
          selectedTokensCount >= 2
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-400 text-white shadow-none cursor-not-allowed'
        }`}
      >
        Merge
      </button>
    </div>
  );
}
