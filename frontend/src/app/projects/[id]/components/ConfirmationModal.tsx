import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isProcessing?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isProcessing = false,
}) => {
  return (
    <Modal open={isOpen} onClose={onCancel} aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="relative">
        <Button
          onClick={onCancel}
          disabled={isProcessing}
          variant="ghost"
          size="sm"
          className="absolute top-0 right-0 text-muted hover:text-foreground"
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>

        <h3 className="text-lg font-semibold text-foreground mb-4" id="modal-title">
          {title}
        </h3>
        <p className="text-sm text-muted mb-6">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            variant="secondary"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            variant="danger"
            className="min-w-[110px]"
          >
            {isProcessing ? (
              <Spinner size="sm" className="border-white/40 border-t-white" />
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
