import React from 'react';
import { X } from 'lucide-react';
import { SnackbarMessage } from './types';

interface SnackbarProps {
  messages: SnackbarMessage[];
  onClose: (id: number) => void;
}

export const Snackbar: React.FC<SnackbarProps> = ({ messages, onClose }) => {
  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex items-center justify-between px-4 py-2 rounded shadow-lg text-white text-sm animate-fade-in-out ${
            msg.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => onClose(msg.id)} className="ml-2 focus:outline-none">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};