import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  requireInputToConfirm?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  requireInputToConfirm
}) => {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmDisabled = requireInputToConfirm ? inputValue !== requireInputToConfirm : false;

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-[100]">
      <div className="bg-surface rounded-lg shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-full shrink-0 ${isDestructive ? 'bg-danger/20 text-danger' : 'bg-blue-500/20 text-blue-400'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-primary mb-1 leading-tight">{title}</h3>
              <p className="text-sm text-secondary leading-relaxed">
                {message}
              </p>
              {requireInputToConfirm && (
                <div className="mt-4">
                  <label className="block text-xs text-secondary mb-1.5">
                    Please type <strong className="font-bold text-primary">{requireInputToConfirm}</strong> to confirm.
                  </label>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
                    placeholder={requireInputToConfirm}
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="px-5 py-4 bg-background flex items-center justify-end gap-2 border-t border-divider">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-hover rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              if (!isConfirmDisabled) {
                onConfirm();
                onClose();
              }
            }}
            disabled={isConfirmDisabled}
            className={`px-4 py-2 text-sm font-medium text-primary rounded-lg transition-colors  ${ 
              isConfirmDisabled
                ? 'bg-divider cursor-not-allowed opacity-50'
                : isDestructive 
                  ? 'bg-danger hover:bg-danger/80' 
                  : 'bg-surface hover:bg-zinc-800'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
