import { useState, useEffect } from 'react';
import { X, RefreshCw, Plus, Check } from 'lucide-react';
import { api } from '../../../services/api/client';
import { useCurrency } from '../../../app/providers/CurrencyProvider';

interface CorporateActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  portfolioId: string;
  onSuccess: () => void;
  existingEvents?: { type: string; date: number; raw: any }[];
}

interface DividendEvent {
  date: string;
  amount: number;
}

interface SplitEvent {
  date: string;
  numerator: number;
  denominator: number;
  splitRatio: string;
}


export function CorporateActionsViewerModal({ isOpen, onClose, symbol, portfolioId, onSuccess, existingEvents = [] }: CorporateActionModalProps) {
  const { currencySymbol, formatCurrency: fmtCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [addingEventId, setAddingEventId] = useState<string | null>(null);
  const [addedEvents, setAddedEvents] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [dividends, setDividends] = useState<DividendEvent[]>([]);
  const [splits, setSplits] = useState<SplitEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'dividends' | 'splits' | 'bonuses'>('all');
  const [autoSync, setAutoSync] = useState(false);
  const [updatingAutoSync, setUpdatingAutoSync] = useState(false);

  useEffect(() => {
    if (isOpen && symbol) {
      fetchCorporateActions();
    }
    
    if (isOpen && portfolioId) {
      fetchAutoSyncStatus();
    }
  }, [isOpen, symbol, portfolioId]);

  const fetchAutoSyncStatus = async () => {
    try {
      const data = await api.get(`/api/portfolios/${portfolioId}`);
      if (data) {
        setAutoSync(data.auto_sync_corporate_actions || false);
      }
    } catch (err) {
      console.error('Failed to fetch auto sync status:', err);
    }
  };

  const handleToggleAutoSync = async () => {
    setUpdatingAutoSync(true);
    const newValue = !autoSync;
    try {
      await api.put(`/api/portfolios/${portfolioId}`, { auto_sync_corporate_actions: newValue });
      setAutoSync(newValue);
    } catch (err) {
      console.error('Failed to update auto sync:', err);
      alert('Failed to update auto sync settings');
    } finally {
      setUpdatingAutoSync(false);
    }
  };

  const fetchCorporateActions = async (forceRefresh = false) => {
    const cacheKey = `corp_actions_${symbol}`;
    
    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setDividends(parsed.dividends);
          setSplits(parsed.splits);
          return;
        } catch (e) {
          // ignore parse errors and fetch fresh
        }
      }
    }

    setLoading(true);
    setError('');
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const response = await fetch(`${baseUrl}/api/corporate-actions?symbol=${symbol}`);
      if (!response.ok) {
        throw new Error('Failed to fetch corporate actions');
      }
      const data = await response.json();
      
      sessionStorage.setItem(cacheKey, JSON.stringify({
        dividends: data.dividends || [],
        splits: data.splits || []
      }));

      setDividends(data.dividends || []);
      setSplits(data.splits || []);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  type UnifiedEvent = 
    | (DividendEvent & { type: 'DIVIDEND' })
    | (SplitEvent & { type: 'SPLIT' });

  const allEvents: UnifiedEvent[] = [
    ...dividends.map(d => ({ ...d, type: 'DIVIDEND' as const })),
    ...splits.map(s => ({ ...s, type: 'SPLIT' as const }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const isAlreadyAdded = (event: UnifiedEvent, idx: number) => {
    // Check if it was added in this session
    if (addedEvents.has(`${event.date}-${idx}`)) return true;

    // Check against existing database events
    const eventDateString = new Date(event.date).toISOString().split('T')[0];
    return existingEvents.some(ex => {
      if (event.type === 'DIVIDEND' && ex.type !== 'DIVIDEND') return false;
      if (event.type === 'SPLIT' && ex.type !== 'SPLIT' && ex.type !== 'BONUS') return false;

      const exDateString = new Date(ex.date).toISOString().split('T')[0];
      if (exDateString !== eventDateString) return false;

      if (event.type === 'DIVIDEND') {
        return Number(ex.raw.quantity) === event.amount;
      } else {
        const ratio = event.numerator / event.denominator;
        return Number(ex.raw.quantity) === ratio;
      }
    });
  };

  let displayEvents = allEvents;
  if (activeTab === 'dividends') {
    displayEvents = displayEvents.filter(e => e.type === 'DIVIDEND');
  } else if (activeTab === 'splits' || activeTab === 'bonuses') {
    displayEvents = displayEvents.filter(e => e.type === 'SPLIT');
  }

  const handleAdd = async (event: UnifiedEvent, idx: number) => {
    const eventId = `${event.date}-${idx}`;
    setAddingEventId(eventId);
    
    try {
      let entryPrice = 0;
      let quantity = 0;
      
      if (event.type === 'DIVIDEND') {
        entryPrice = -2;
        quantity = event.amount;
      } else if (event.type === 'SPLIT') {
        entryPrice = -1;
        quantity = event.numerator / event.denominator;
      }

      // Check if we hold shares on or before this date
      const buyData = await api.get(`/api/stocks?portfolio_id=${portfolioId}&symbol=${symbol}&entry_price_gt=0`);

      if (!buyData || buyData.length === 0) {
        throw new Error(`You must have at least one buy position for ${symbol} before adding this ${event.type.toLowerCase()}.`);
      }

      const firstBuyDate = new Date(buyData[0].entry_date).getTime();
      const actionDate = new Date(event.date).getTime();

      if (actionDate < firstBuyDate) {
        throw new Error(`This ${event.type.toLowerCase()} date (${new Date(event.date).toLocaleDateString()}) is before your first buy date (${new Date(buyData[0].entry_date).toLocaleDateString()}). It cannot be added.`);
      }

      await api.post('/api/stocks', {
        portfolio_id: portfolioId,
        symbol: symbol,
        quantity: quantity,
        entry_price: entryPrice,
        entry_date: new Date(event.date).toISOString().split('T')[0],
        brokerage: 0,
        govt_tax: 0
      });
      setAddedEvents(prev => new Set(prev).add(`${event.date}-${idx}`));
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to add corporate action');
    } finally {
      setAddingEventId(null);
    }
  };

  const handleAddAllValid = async () => {
    setSyncingAll(true);
    try {
      const unaddedEvents = displayEvents.filter((ev, idx) => !isAlreadyAdded(ev, idx));

      if (unaddedEvents.length === 0) {
        alert('All visible valid actions are already added!');
        return;
      }

      const buyData = await api.get(`/api/stocks?portfolio_id=${portfolioId}&symbol=${symbol}&entry_price_gt=0`);

      if (!buyData || buyData.length === 0) {
        alert(`You must have at least one buy position for ${symbol} before adding corporate actions.`);
        return;
      }

      const firstBuyDate = new Date(buyData[0].entry_date).getTime();
      const inserts: any[] = [];
      const newAddedEventKeys: string[] = [];

      unaddedEvents.forEach((event) => {
        const actionDate = new Date(event.date).getTime();
        if (actionDate < firstBuyDate) return;

        let entryPrice = 0;
        let quantity = 0;

        if (event.type === 'DIVIDEND') {
          entryPrice = -2;
          quantity = event.amount;
        } else {
          entryPrice = -1;
          quantity = event.numerator / event.denominator;
        }

        inserts.push({
          portfolio_id: portfolioId,
          symbol: symbol,
          quantity: quantity,
          entry_price: entryPrice,
          entry_date: new Date(event.date).toISOString().split('T')[0],
          brokerage: 0,
          govt_tax: 0
        });
        
        const trueIdx = displayEvents.indexOf(event);
        newAddedEventKeys.push(`${event.date}-${trueIdx}`);
      });

      if (inserts.length === 0) {
        alert('No valid actions found to add (they occurred before your first buy).');
        return;
      }

      await api.post('/api/stocks/bulk', { inserts });

      setAddedEvents(prev => {
        const next = new Set(prev);
        newAddedEventKeys.forEach(k => next.add(k));
        return next;
      });

      alert(`Successfully added ${inserts.length} corporate action(s)!`);
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to sync corporate actions');
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg shadow-2xl shadow-black/50 w-full max-w-2xl overflow-hidden flex flex-col h-[500px]">
        <div className="px-6 py-4 border-b border-divider flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-primary">Corporate Actions</h2>
            <p className="text-xs text-secondary mt-0.5">{symbol}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-tertiary hover:text-secondary hover:bg-surface-hover rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-divider flex flex-col sm:flex-row gap-3 sm:items-center justify-between shrink-0 bg-background/50">
          <div className="flex bg-surface-hover p-0.5 rounded-lg border border-divider w-full sm:w-fit overflow-x-auto">
            {(['all', 'dividends', 'splits', 'bonuses'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 sm:px-4 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap flex-1 sm:flex-none ${
                  activeTab === tab ? 'bg-surface text-primary ' : 'text-secondary hover:text-secondary'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-secondary hover:text-primary transition-colors">
              <input 
                type="checkbox" 
                checked={autoSync} 
                onChange={handleToggleAutoSync}
                disabled={updatingAutoSync}
                className="rounded border-divider bg-surface text-blue-500 focus:ring-blue-500 disabled:opacity-50"
              />
              <span className={updatingAutoSync ? "opacity-50" : ""}>Auto-sync daily (8 AM)</span>
            </label>
            <div className="w-px h-3 bg-divider hidden sm:block"></div>
            <button
              onClick={handleAddAllValid}
              disabled={loading || syncingAll || displayEvents.length === 0}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-800 transition-colors disabled:opacity-50 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1.5 rounded-md"
              title="Automatically add all valid corporate actions that aren't already added"
            >
              {syncingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Sync All Valid
            </button>
            <div className="w-px h-3 bg-divider"></div>
            <button 
              onClick={() => fetchCorporateActions(true)}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-primary transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-tertiary">
              <RefreshCw className="w-8 h-8 animate-spin mb-4 text-secondary" />
              <p className="text-sm">Fetching historical events...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-danger text-sm">{error}</div>
          ) : displayEvents.length === 0 ? (
            <div className="text-center py-12 text-secondary text-sm">
              <p>No historical {activeTab === 'all' ? 'events' : activeTab} found for {symbol}.</p>
              {activeTab === 'bonuses' && (
                <p className="text-xs text-tertiary mt-2">Note: Yahoo Finance often records bonus issues as stock splits.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayEvents.map((event, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border border-divider rounded-lg hover:border-divider hover:bg-background transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      event.type === 'DIVIDEND' ? 'bg-success/20 text-success' : 'bg-purple-500/20 text-purple-300'
                    }`}>
                      {event.type === 'DIVIDEND' ? 'D' : 'S'}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-primary">
                        {event.type === 'DIVIDEND' ? 'Dividend' : 'Stock Split / Bonus'}
                      </div>
                      <div className="text-xs text-secondary">{formatDate(event.date)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-bold text-primary">
                        {event.type === 'DIVIDEND' 
                          ? `${event.amount?.toFixed(2)}` 
                          : `${event.numerator}:${event.denominator}`}
                      </div>
                      <div className="text-[10px] text-tertiary mt-0.5 uppercase tracking-wider">
                        {event.type === 'DIVIDEND' ? 'Per Share' : 'Ratio'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdd(event, idx)}
                      disabled={addingEventId === `${event.date}-${idx}` || isAlreadyAdded(event, idx)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 ml-2 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${
                        isAlreadyAdded(event, idx)
                          ? 'bg-success/10 text-success cursor-not-allowed'
                          : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                      }`}
                      title={isAlreadyAdded(event, idx) ? "Already added" : "Add to portfolio"}
                    >
                      {addingEventId === `${event.date}-${idx}` ? (
                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> <span>Adding...</span></>
                      ) : isAlreadyAdded(event, idx) ? (
                        <><Check className="w-3.5 h-3.5" /> <span>Added</span></>
                      ) : (
                        <><Plus className="w-3.5 h-3.5" /> <span>Add</span></>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
