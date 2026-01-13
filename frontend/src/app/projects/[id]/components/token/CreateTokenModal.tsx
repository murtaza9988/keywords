import React from 'react';

interface CreateTokenModalProps {
  searchTerm: string;
  tokenName: string;
  onTokenNameChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isCreating: boolean;
}

export function CreateTokenModal({
  searchTerm,
  tokenName,
  onTokenNameChange,
  onConfirm,
  onCancel,
  isCreating
}: CreateTokenModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h3 className="text-lg font-semibold mb-4">Create New Token</h3>
        <p className="text-sm text-gray-600 mb-4">
          Create a token &quot;{tokenName}&quot; that will be added to all keywords containing &quot;{searchTerm}&quot;.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Token Name</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={tokenName}
            onChange={(e) => onTokenNameChange(e.target.value)}
            placeholder="Enter token name"
          />
        </div>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isCreating || !tokenName.trim()}
            className={`px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white ${
              isCreating || !tokenName.trim()
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isCreating ? 'Creating...' : 'Create Token'}
          </button>
        </div>
      </div>
    </div>
  );
}