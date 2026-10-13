import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../../services/api/client';

interface RenamePortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRenamed: () => void;
  portfolioId: string | null;
  currentName: string;
}

export function RenamePortfolioModal({ isOpen, onClose, onRenamed, portfolioId, currentName }: RenamePortfolioModalProps) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setError('');
    }
  }, [isOpen, currentName]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !portfolioId || name.trim() === currentName) return;

    setLoading(true);
    setError('');

    let dbError: any = null;
    try {
      await api.put(`/api/portfolios/${portfolioId}`, { name: name.trim() });
    } catch (e: any) {
      dbError = e;
    }

    setLoading(false);

    if (dbError) {
      setError(dbError.message);
    } else {
      onRenamed();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay">
      <div className="bg-surface w-full max-w-md rounded-lg p-6 relative shadow-2xl shadow-black/50">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-tertiary hover:text-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-xl font-semibold mb-1 text-primary tracking-tight">Rename Portfolio</h2>
        <p className="text-sm text-secondary mb-6">Enter a new name for your portfolio.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="rename" className="block text-sm font-medium text-secondary mb-1">
              Portfolio Name
            </label>
            <input
              type="text"
              id="rename"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
              placeholder="e.g. Long-term Hold"
              autoFocus
            />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-secondary hover:bg-background border border-transparent rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || name.trim() === currentName}
              className="bg-surface hover:bg-zinc-800 text-primary text-sm font-medium py-2 px-4 rounded-lg  transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Save'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
