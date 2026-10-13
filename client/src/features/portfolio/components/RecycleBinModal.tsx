import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../../../services/api/client';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';

interface DeletedPortfolio {
  id: string;
  name: string;
  deleted_at: string;
}

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: () => void; // Trigger refetch of main portfolios
}

export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({ isOpen, onClose, onRestore }) => {
  const [deletedPortfolios, setDeletedPortfolios] = useState<DeletedPortfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioToPermanentlyDelete, setPortfolioToPermanentlyDelete] = useState<string | null>(null);

  const fetchDeleted = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/portfolios?deleted=true');
      setDeletedPortfolios(data || []);
    } catch (err) {
      console.error('Error fetching deleted portfolios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDeleted();
    }
  }, [isOpen]);

  const handleRestore = async (id: string) => {
    try {
      await api.post(`/api/portfolios/${id}/restore`, {});
      
      setDeletedPortfolios(prev => prev.filter(p => p.id !== id));
      onRestore();
    } catch (err) {
      console.error('Error restoring portfolio:', err);
      alert('Failed to restore. Please try again.');
    }
  };

  const executePermanentDelete = async () => {
    if (!portfolioToPermanentlyDelete) return;
    try {
      await api.delete(`/api/portfolios/${portfolioToPermanentlyDelete}?permanent=true`);
      
      setDeletedPortfolios(prev => prev.filter(p => p.id !== portfolioToPermanentlyDelete));
    } catch (err) {
      console.error('Error permanently deleting:', err);
      alert('Failed to delete. Please try again.');
    } finally {
      setPortfolioToPermanentlyDelete(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg shadow-2xl shadow-black/50 w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-4 py-3 border-b border-divider flex items-center justify-between bg-background shrink-0">
          <h2 className="text-sm font-semibold text-primary">Recycle Bin</h2>
          <button onClick={onClose} className="p-1 text-tertiary hover:text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto min-h-[200px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-zinc-900"></div>
            </div>
          ) : deletedPortfolios.length === 0 ? (
            <div className="text-center py-8 text-secondary text-sm">
              Your recycle bin is empty.
            </div>
          ) : (
            <div className="space-y-2">
              {deletedPortfolios.map(portfolio => {
                const deletedDate = new Date(portfolio.deleted_at);
                const expiryDate = new Date(deletedDate);
                expiryDate.setDate(expiryDate.getDate() + 30);
                
                const daysRemaining = Math.max(0, Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
                
                return (
                  <div key={portfolio.id} className="flex items-center justify-between p-3 bg-background border border-divider rounded-lg">
                    <div className="flex flex-col min-w-0 pr-4">
                      <span className="text-sm font-medium text-primary truncate">{portfolio.name}</span>
                      <span className="text-xs text-danger mt-0.5">
                        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => handleRestore(portfolio.id)}
                        className="p-1.5 text-secondary hover:text-success hover:bg-success/10 rounded transition-colors"
                        title="Restore Portfolio"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setPortfolioToPermanentlyDelete(portfolio.id)}
                        className="p-1.5 text-secondary hover:text-danger hover:bg-danger/10 rounded transition-colors"
                        title="Delete Permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!portfolioToPermanentlyDelete}
        onClose={() => setPortfolioToPermanentlyDelete(null)}
        onConfirm={executePermanentDelete}
        title="Permanently Delete"
        message={`Are you sure you want to permanently delete "${deletedPortfolios.find(p => p.id === portfolioToPermanentlyDelete)?.name}"? This action cannot be undone.`}
        confirmText="Delete Permanently"
        isDestructive={true}
        requireInputToConfirm={deletedPortfolios.find(p => p.id === portfolioToPermanentlyDelete)?.name}
      />
    </div>
  );
};
