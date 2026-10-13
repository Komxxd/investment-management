import React, { useState, useEffect, useRef } from 'react';
import { useCurrency } from '../../../app/providers/CurrencyProvider';
import { X, Search } from 'lucide-react';
import { api } from '../../../services/api/client';

interface CorporateActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'bonus' | 'split' | 'dividend' | null;
  portfolioId: string | null;
  ownedSymbols: string[];
  symbolGroups: any[];
  onSuccess?: () => void;
}

export function CorporateActionModal({ isOpen, onClose, type, portfolioId, ownedSymbols, symbolGroups, onSuccess }: CorporateActionModalProps) {
  const { currencySymbol, formatCurrency: fmtCurrency } = useCurrency();
  const [symbol, setSymbol] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [qty, setQty] = useState('');
  const [splitFactor, setSplitFactor] = useState('');
  const [dividend, setDividend] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredSymbols = ownedSymbols.filter(sym => sym.toLowerCase().includes(searchQuery.toLowerCase()));

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSymbol('');
      setSearchQuery('');
      setDate(new Date().toISOString().split('T')[0]);
      setQty('');
      setSplitFactor('');
      setDividend('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, ownedSymbols]);

  if (!isOpen || !type || !portfolioId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type !== 'bonus' && type !== 'split' && type !== 'dividend') {
      return;
    }

    if (!symbol) {
      setError('Please select an asset symbol');
      return;
    }

    if (type === 'bonus' && (!qty || Number(qty) <= 0)) {
      setError('Please enter a valid bonus quantity');
      return;
    }

    if (type === 'split' && (!splitFactor || Number(splitFactor) <= 0)) {
      setError('Please enter a valid split factor');
      return;
    }

    if (type === 'dividend' && (!dividend || Number(dividend) <= 0)) {
      setError('Please enter a valid dividend amount');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (type === 'bonus' || type === 'split' || type === 'dividend') {
        const group = symbolGroups.find(g => g.symbol === symbol.toUpperCase());
        if (!group || !group.events) {
          setError(`You must have at least one buy position for this symbol before adding a ${type}.`);
          setSubmitting(false);
          return;
        }

        const firstBuyEvent = group.events.find((ev: any) => ev.type === 'BUY');
        if (!firstBuyEvent) {
          setError(`You must have at least one buy position for this symbol before adding a ${type}.`);
          setSubmitting(false);
          return;
        }

        const firstBuyDate = firstBuyEvent.date;
        const actionDate = new Date(date).getTime();

        if (actionDate < firstBuyDate) {
          setError(`${type.charAt(0).toUpperCase() + type.slice(1)} date cannot be before the first buy date (${new Date(firstBuyEvent.raw.entry_date).toLocaleDateString()})`);
          setSubmitting(false);
          return;
        }
        
        // Validate that we hold shares on exactly this date
        let openQty = 0;
        for (const ev of group.events) {
           if (ev.date > actionDate) break; // Only consider events up to the action date
           
           if (ev.type === 'BUY') {
              openQty += Number(ev.raw.quantity);
           } else if (ev.type === 'SELL') {
              openQty -= Number(ev.raw.quantity);
           } else if (ev.type === 'BONUS') {
              if (openQty > 0) openQty += Number(ev.raw.quantity);
           } else if (ev.type === 'SPLIT') {
              if (openQty > 0) openQty *= Number(ev.raw.quantity);
           }
        }
        
        if (openQty <= 0) {
           setError(`You do not hold any shares of ${symbol.toUpperCase()} on this date. You cannot add a ${type}.`);
           setSubmitting(false);
           return;
        }
      }

      // Bonus = 0 cost, Split = -1 cost marker, Dividend = -2 cost marker
      await api.post('/api/stocks', {
        portfolio_id: portfolioId,
        symbol: symbol.toUpperCase(),
        quantity: type === 'bonus' ? Number(qty) : type === 'split' ? Number(splitFactor) : Number(dividend),
        entry_price: type === 'bonus' ? 0 : type === 'split' ? -1 : -2,
        entry_date: date,
        brokerage: 0,
        govt_tax: 0
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || `Failed to process ${type} action`);
    } finally {
      setSubmitting(false);
    }
  };

  const titles = {
    bonus: 'Add Bonus Issue',
    split: 'Add Stock Split',
    dividend: 'Add Dividend'
  };

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg shadow-2xl shadow-black/50 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-divider flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-primary">{titles[type]}</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-tertiary hover:text-secondary rounded-full hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Content */}
          <div className="p-6 flex-1 overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
                {error}
              </div>
            )}

            {type === 'bonus' || type === 'split' || type === 'dividend' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Asset Symbol
                  </label>
                  <div className="relative" ref={dropdownRef}>
                    <Search className="w-4 h-4 text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSymbol('');
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder="Search asset you own..."
                      className="w-full pl-9 pr-3 py-2 bg-surface border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-all"
                      required
                    />
                    
                    {showDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-surface border border-divider rounded-lg shadow-2xl shadow-black/50 shadow-black/40 max-h-48 overflow-y-auto">
                        {filteredSymbols.length > 0 ? (
                          filteredSymbols.map(sym => (
                            <div
                              key={sym}
                              onClick={() => {
                                setSymbol(sym);
                                setSearchQuery(sym);
                                setShowDropdown(false);
                              }}
                              className="px-3 py-2 cursor-pointer hover:bg-background text-sm font-medium text-primary transition-colors"
                            >
                              {sym}
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-secondary text-center">
                            No matching assets found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    {type === 'bonus' ? 'Entry Date' : type === 'split' ? 'Split Date' : 'Dividend Date'}
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-all"
                    required
                  />
                </div>

                {type === 'bonus' ? (
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">
                      Bonus Qty <span className="text-xs text-tertiary font-normal ml-1">(Shares added)</span>
                    </label>
                    <input
                      type="number"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-all"
                      placeholder="e.g. 100"
                      min="0"
                      step="0.0001"
                      required
                    />
                  </div>
                ) : type === 'split' ? (
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">
                      Split Factor <span className="text-xs text-tertiary font-normal ml-1">(Multiplier, e.g. 2 for 1:2 split)</span>
                    </label>
                    <input
                      type="number"
                      value={splitFactor}
                      onChange={(e) => setSplitFactor(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-all"
                      placeholder="e.g. 2"
                      min="0.0001"
                      step="any"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">
                      Dividend Per Share ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      value={dividend}
                      onChange={(e) => setDividend(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-all"
                      placeholder="e.g. 5.50"
                      min="0.01"
                      step="any"
                      required
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-secondary mb-2">Form fields will be added here.</p>
                <p className="text-xs text-tertiary">This is a placeholder for {titles[type]}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-divider flex justify-end gap-3 shrink-0 bg-background/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-secondary bg-surface border border-gray-300 rounded-lg hover:bg-background transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (type !== 'bonus' && type !== 'split' && type !== 'dividend')}
              className="px-4 py-2 text-sm font-medium text-primary bg-surface rounded-lg hover:bg-zinc-800 transition-colors  disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
