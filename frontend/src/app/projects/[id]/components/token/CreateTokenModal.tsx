import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

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
    <Modal open onClose={onCancel}>
      <div className="w-full max-w-sm">
        <h3 className="text-lg font-semibold text-foreground mb-4">Create New Token</h3>
        <p className="text-sm text-muted mb-4">
          Create a token &quot;{tokenName}&quot; that will be added to all keywords containing &quot;{searchTerm}&quot;.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted mb-1">Token Name</label>
          <Input
            type="text"
            value={tokenName}
            onChange={(e) => onTokenNameChange(e.target.value)}
            placeholder="Enter token name"
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isCreating || !tokenName.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Token'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
