import { useState, useMemo } from 'react';
import { X, RefreshCw, AlertCircle, ArrowRight, Check } from 'lucide-react';
import { api } from '../../../services/api/client';
import { useCurrency } from '../../../app/providers/CurrencyProvider';

interface SymbolGroup {
  symbol: string;
  netQty: number;
  currentValue: number;
  livePrice: number;
}

interface RebalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioId: string;
  symbolGroups: SymbolGroup[];
  totalCurrentValue: number;
  onSuccess: () => void;
}

interface Trade {
  symbol: string;
  action: 'BUY' | 'SELL';
  qty: number;
  price: number;
  value: number;
  targetValue: number;
}

export function RebalanceModal({ isOpen, onClose, portfolioId, symbolGroups, totalCurrentValue, onSuccess }: RebalanceModalProps) {
  const { currencySymbol, formatCurrency: fmtCurrency } = useCurrency();
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const trades = useMemo(() => {
    if (!symbolGroups || symbolGroups.length === 0) return [];
    
    const numAssets = symbolGroups.length;
    const targetValuePerAsset = totalCurrentValue / numAssets;
    
    const proposedTrades: Trade[] = [];
    
    symbolGroups.forEach(group => {
      // Find difference between target and current value
      const diff = targetValuePerAsset - group.currentValue;
      
      // Calculate how many shares to buy/sell to reach target (rounded to nearest whole share)
      // If diff is positive, we need to buy. If negative, sell.
      let actionQty = Math.round(diff / group.livePrice);
      
      if (actionQty !== 0) {
        proposedTrades.push({
          symbol: group.symbol,
          action: actionQty > 0 ? 'BUY' : 'SELL',
          qty: Math.abs(actionQty),
          price: group.livePrice,
          value: Math.abs(actionQty) * group.livePrice,
          targetValue: targetValuePerAsset
        });
      }
    });
    
    // Sort trades: Sells first (to free up capital), then Buys
    return proposedTrades.sort((a, b) => {
      if (a.action === b.action) return b.value - a.value;
      return a.action === 'SELL' ? -1 : 1;
    });
  }, [symbolGroups, totalCurrentValue]);

  const { netCash } = useMemo(() => {
    let required = 0;
    let generated = 0;
    trades.forEach(t => {
      if (t.action === 'BUY') required += t.value;
      else generated += t.value;
    });
    return {
      totalCashRequired: required,
      totalCashGenerated: generated,
      netCash: generated - required
    };
  }, [trades]);

  const executeTrades = async () => {
    if (trades.length === 0) return;
    
    setIsExecuting(true);
    setError(null);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const buysToInsert = trades.filter(t => t.action === 'BUY').map(trade => ({
        portfolio_id: portfolioId,
        symbol: trade.symbol,
        quantity: trade.qty,
        entry_price: trade.price,
        entry_date: today
      }));
      
      const sellsToInsert = trades.filter(t => t.action === 'SELL').map(trade => ({
        portfolio_id: portfolioId,
        symbol: trade.symbol,
        quantity: trade.qty,
        exit_price: trade.price,
        exit_date: today
      }));
      
      if (buysToInsert.length > 0) {
        await api.post('/api/stocks/bulk', { inserts: buysToInsert });
      }
      
      if (sellsToInsert.length > 0) {
        await api.post('/api/sold-stocks/bulk', { inserts: sellsToInsert });
      }
      
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to execute rebalance:", err);
      setError(err.message || "Failed to execute trades.");
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg shadow-2xl shadow-black/50 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-divider flex items-center justify-between shrink-0 bg-surface">
          <div>
            <h2 className="text-xl font-bold text-primary">Equal Weight Rebalancing</h2>
            <p className="text-sm text-secondary mt-1">
              Target Allocation: <strong>{(100 / symbolGroups.length).toFixed(2)}%</strong> per asset
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-tertiary hover:text-secondary hover:bg-surface-hover rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-background/50 p-6">
          {error && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-danger">Rebalance Failed</h4>
                <p className="text-sm text-danger mt-1">{error}</p>
              </div>
            </div>
          )}

          {trades.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-success/20 text-success rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-primary mb-2">Portfolio is Balanced!</h3>
              <p className="text-secondary">Your portfolio is already equally weighted across all assets.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface border border-divider rounded-lg p-4 ">
                  <div className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Target Value / Asset</div>
                  <div className="text-xl font-bold text-primary">
                    {currencySymbol}{(totalCurrentValue / symbolGroups.length).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-surface border border-divider rounded-lg p-4 ">
                  <div className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Trades Required</div>
                  <div className="text-xl font-bold text-primary">
                    {trades.length}
                  </div>
                </div>
                <div className={`border rounded-lg p-4  ${netCash >= 0 ? 'bg-success/10 border-success/20' : 'bg-danger/10 border-danger/20'}`}>
                  <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${netCash >= 0 ? 'text-success' : 'text-danger'}`}>
                    Net Cash {netCash >= 0 ? 'Generated' : 'Required'}
                  </div>
                  <div className={`text-xl font-bold ${netCash >= 0 ? 'text-success' : 'text-danger'}`}>
                    {netCash >= 0 ? '+' : ''}{currencySymbol}{Math.abs(netCash).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Trades Table */}
              <div className="bg-surface border border-divider rounded-lg  overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-background border-b border-divider">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Asset</th>
                      <th className="px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider text-center">Action</th>
                      <th className="px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Qty</th>
                      <th className="px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Price</th>
                      <th className="px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {trades.map((trade, idx) => (
                      <tr key={idx} className="hover:bg-background transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-bold text-sm text-primary">{trade.symbol}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            trade.action === 'BUY' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                          }`}>
                            {trade.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-primary text-right">
                          {trade.qty.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-secondary text-right">
                          {currencySymbol}{trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-primary text-right">
                          {currencySymbol}{trade.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="text-xs text-secondary flex items-start gap-2 bg-blue-500/10 p-3 rounded-lg border border-blue-900/50">
                <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p>
                  Trades are rounded to the nearest whole share as fractional shares are generally not supported on this exchange. 
                  This is why there may be a small Net Cash difference after rebalancing.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-divider bg-surface flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="px-4 py-2 text-sm font-semibold text-secondary hover:text-primary hover:bg-surface-hover rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          
          {trades.length > 0 && (
            <button
              onClick={executeTrades}
              disabled={isExecuting}
              className="px-6 py-2 text-sm font-semibold text-primary bg-surface hover:bg-zinc-800 rounded-lg  transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  Execute Rebalance
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
