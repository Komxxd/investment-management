import React from 'react';
import { ArrowDownCircle, ArrowUpCircle, Pencil, Trash2 } from 'lucide-react';
import type { FifoBuyLot, FifoHistoryEvent, FifoMatchedSell, SymbolGroup } from './dashboardTypes';

interface HoldingExpandedFifoRowProps {
  group: SymbolGroup;
  colSpan: number;
  currencySymbol: string;
  fmtCurrency: (amount: number, currency?: string) => string;
  onEditStock: (id: string) => void;
  onEditSoldStock: (id: string) => void;
  onDeleteStock: (id: string) => void;
  onDeleteSoldStock: (id: string) => void;
}

const fmtPlain = (n: unknown) =>
  typeof n === 'number' && !isNaN(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

/**
 * Expandable FIFO ledger row showing per-lot buy/corporate-action history alongside matched sell allocations.
 */
export const HoldingExpandedFifoRow: React.FC<HoldingExpandedFifoRowProps> = ({
  group,
  colSpan,
  currencySymbol,
  fmtCurrency,
  onEditStock,
  onEditSoldStock,
  onDeleteStock,
  onDeleteSoldStock,
}) => {
  const renderEventBadge = (evType: string) => {
    if (evType === 'BONUS') {
      return <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-purple-500/20 text-purple-300">BONUS</span>;
    }
    if (evType === 'SPLIT') {
      return <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-amber-100 text-amber-700">SPLIT</span>;
    }
    if (evType === 'DIVIDEND') {
      return <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-blue-500/20 text-blue-300">DIVIDEND</span>;
    }
    return <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-success/20 text-success">BUY</span>;
  };

  return (
    <tr className="border-t border-b border-divider bg-background/70">
      <td colSpan={colSpan} className="p-2">
        <div className="space-y-2">
          {group.fifoBuyLots.length === 0 ? (
            <p className="text-[9px] sm:text-[10px] text-tertiary py-2 text-center">No buy entries found.</p>
          ) : (
            group.fifoBuyLots.map((lot: FifoBuyLot, lotIdx: number) => (
              <div key={`lot-${lot.buy.id}`} className="bg-surface border border-divider rounded-lg p-2 shadow-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {/* Left Column: BUY Lot Details */}
                  <div className="pr-0 md:pr-2 border-b md:border-b-0 md:border-r border-divider pb-2 md:pb-0">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-divider">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-success">
                        <ArrowUpCircle className="w-4 h-4 text-success" />
                        <span>Buy Position{group.fifoBuyLots.length > 1 ? ` #${lotIdx + 1}` : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold ${
                            lot.status === 'CLOSED'
                              ? 'bg-surface-hover text-secondary'
                              : lot.status === 'PARTIALLY_SOLD'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-success/20 text-success'
                          }`}
                        >
                          {lot.status === 'CLOSED'
                            ? `CLOSED (${lot.buyQty}/${lot.buyQty} sold)`
                            : lot.status === 'PARTIALLY_SOLD'
                              ? `PARTIAL (${lot.soldQty}/${lot.buyQty} sold)`
                              : `OPEN (${lot.remainingQty} held)`}
                        </span>
                      </div>
                    </div>

                    <table className="w-full text-left text-[9px] sm:text-[10px] whitespace-nowrap">
                      <thead>
                        <tr className="text-[9px] sm:text-[10px] text-tertiary uppercase border-b border-divider">
                          <th className="pb-1 font-medium">Type</th>
                          <th className="pb-1 font-medium">Date</th>
                          <th className="pb-1 font-medium">Qty</th>
                          <th className="pb-1 font-medium">Price</th>
                          <th className="pb-1 font-medium">Value</th>
                          <th className="pb-1 font-medium">Brokerage</th>
                          <th className="pb-1 font-medium">Govt Tax</th>
                          <th className="pb-1 font-medium">Unrealized PnL</th>
                          <th className="pb-1 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Current Combined State Row */}
                        {lot.history && lot.history.length > 0 && (
                          <tr className="bg-blue-500/10/30">
                            <td className="py-1">
                              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-blue-500/20 text-blue-300">COMBINED</span>
                            </td>
                            <td className="py-1 text-secondary font-medium">
                              {new Date(lot.history[lot.history.length - 1].date).toLocaleDateString()}
                            </td>
                            <td className="py-1 font-bold text-primary">
                              {lot.buyQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                            </td>
                            <td className="py-1 text-secondary font-semibold">{fmtCurrency(lot.entryPrice, group.liveData?.currency)}</td>
                            <td className="py-1 text-secondary font-medium">{fmtCurrency(lot.cost, group.liveData?.currency)}</td>
                            <td></td>
                            <td></td>
                            <td className="py-1 font-medium">
                              <span className={lot.unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}>
                                {lot.unrealizedPnL >= 0 ? '+' : ''}{fmtCurrency(lot.unrealizedPnL, group.liveData?.currency)}
                              </span>
                              <span className="text-[9px] sm:text-[10px] ml-1 text-tertiary">
                                ({lot.unrealizedPct >= 0 ? '+' : ''}{lot.unrealizedPct.toFixed(2)}%)
                              </span>
                            </td>
                            <td className="py-1 text-right"></td>
                          </tr>
                        )}

                        {/* History Events Rows */}
                        {[...(lot.history || [])].reverse().map((ev: FifoHistoryEvent, idx: number) => {
                          const isBuy = ev.type === 'BUY';
                          const eventCost = ev.qty * (ev.price || 0);
                          const eventUnrealizedPnL = isBuy ? ev.qty * (group.livePrice - (ev.price || 0)) : 0;
                          const eventUnrealizedPct = eventCost > 0 ? (eventUnrealizedPnL / eventCost) * 100 : 0;

                          return (
                            <tr key={`${ev.type}-${idx}`} className="border-t border-divider">
                              <td className="py-1">{renderEventBadge(ev.type)}</td>
                              <td className="py-1 text-tertiary">{new Date(ev.date).toLocaleDateString()}</td>
                              <td className="py-1 font-medium text-secondary">
                                {ev.type === 'SPLIT'
                                  ? `x${ev.qty.toFixed(2)}`
                                  : ev.qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                              </td>
                              <td className="py-1 text-tertiary">
                                {ev.type === 'SPLIT'
                                  ? '—'
                                  : ev.type === 'DIVIDEND'
                                    ? `${currencySymbol}${fmtPlain(ev.qty)}/sh`
                                    : ev.price !== undefined
                                      ? `${currencySymbol}${fmtPlain(ev.price)}`
                                      : `${currencySymbol}0.00`}
                              </td>
                              <td className="py-1 text-secondary font-medium">{eventCost > 0 ? `${currencySymbol}${fmtPlain(eventCost)}` : '—'}</td>
                              <td className="py-1 text-secondary text-[9px] sm:text-[10px]">
                                {ev.brokerage ? `${currencySymbol}${fmtPlain(ev.brokerage)}` : '—'}
                              </td>
                              <td className="py-1 text-secondary text-[9px] sm:text-[10px]">
                                {ev.govtTax ? `${currencySymbol}${fmtPlain(ev.govtTax)}` : '—'}
                              </td>
                              <td className="py-1 font-medium">
                                {isBuy ? (
                                  <>
                                    <span className={eventUnrealizedPnL >= 0 ? 'text-success' : 'text-danger'}>
                                      {eventUnrealizedPnL >= 0 ? '+' : ''}{fmtCurrency(eventUnrealizedPnL, group.liveData?.currency)}
                                    </span>
                                    <span className="text-[9px] sm:text-[10px] ml-1 text-tertiary">
                                      ({eventUnrealizedPct >= 0 ? '+' : ''}{eventUnrealizedPct.toFixed(2)}%)
                                    </span>
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-1 text-right">
                                {ev.id && (
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        onEditStock(ev.id!);
                                      }}
                                      className="p-1 text-secondary hover:text-primary rounded hover:bg-surface-hover transition-colors"
                                      title="Edit Entry"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        onDeleteStock(ev.id!);
                                      }}
                                      className="p-1 text-secondary hover:text-danger rounded hover:bg-danger/10 transition-colors"
                                      title="Delete Entry"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Fallback for legacy lots without event history */}
                        {(!lot.history || lot.history.length === 0) && (
                          <tr>
                            <td className="py-1">
                              {lot.entryPrice === 0 ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-purple-500/20 text-purple-300">BONUS</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-success/20 text-success">BUY</span>
                              )}
                            </td>
                            <td className="py-1 text-secondary">{new Date(lot.buy.entry_date).toLocaleDateString()}</td>
                            <td className="py-1 font-medium text-primary">{lot.buyQty.toLocaleString()}</td>
                            <td className="py-1 text-secondary">{fmtCurrency(lot.entryPrice, group.liveData?.currency)}</td>
                            <td className="py-1 text-secondary font-medium">{fmtCurrency(lot.cost, group.liveData?.currency)}</td>
                            <td className="py-1 font-medium">
                              <span className={lot.unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}>
                                {lot.unrealizedPnL >= 0 ? '+' : ''}{fmtCurrency(lot.unrealizedPnL, group.liveData?.currency)}
                              </span>
                              <span className="text-[9px] sm:text-[10px] ml-1 text-tertiary">
                                ({lot.unrealizedPct >= 0 ? '+' : ''}{lot.unrealizedPct.toFixed(2)}%)
                              </span>
                            </td>
                            <td className="py-1 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    onEditStock(lot.buy.id);
                                  }}
                                  className="p-1 text-secondary hover:text-primary rounded hover:bg-surface-hover transition-colors"
                                  title="Edit Buy"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    onDeleteStock(lot.buy.id);
                                  }}
                                  className="p-1 text-secondary hover:text-danger rounded hover:bg-danger/10 transition-colors"
                                  title="Delete Buy"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Right Column: Sell Positions */}
                  <div>
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-divider">
                      <div className="flex items-center gap-1.5 font-semibold text-[10px] text-danger">
                        <ArrowDownCircle className="w-4 h-4 text-danger" />
                        <span>Sell Positions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-secondary font-medium">
                          {lot.soldQty.toLocaleString()} / {lot.buyQty.toLocaleString()} sold
                        </span>
                        {lot.matchedSells.length > 0 && (
                          <span className={`text-[10px] font-semibold ${lot.realizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                            (Realized: {lot.realizedPnL >= 0 ? '+' : ''}{fmtCurrency(lot.realizedPnL, group.liveData?.currency)})
                          </span>
                        )}
                      </div>
                    </div>

                    {lot.matchedSells.length === 0 ? (
                      <p className="text-[10px] text-tertiary py-2 text-center">No sell entries recorded yet.</p>
                    ) : (
                      <table className="w-full text-left text-[10px] whitespace-nowrap">
                        <thead>
                          <tr className="text-[9px] text-tertiary uppercase border-b border-divider">
                            <th className="pb-1 font-medium">Type</th>
                            <th className="pb-1 font-medium">Date</th>
                            <th className="pb-1 font-medium">Qty</th>
                            <th className="pb-1 font-medium">Price</th>
                            <th className="pb-1 font-medium">Value</th>
                            <th className="pb-1 font-medium">Brokerage</th>
                            <th className="pb-1 font-medium">Govt Tax</th>
                            <th className="pb-1 font-medium">Realized PnL</th>
                            <th className="pb-1 text-right font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {lot.matchedSells.map((sellAlloc: FifoMatchedSell) => {
                            const realPnlPct = lot.entryPrice > 0 ? ((sellAlloc.exit_price - lot.entryPrice) / lot.entryPrice) * 100 : 0;
                            const isDividend = sellAlloc.type === 'DIVIDEND';
                            return (
                              <tr key={`alloc-${sellAlloc.sellId}`} className="hover:bg-danger/10/40 transition-colors">
                                <td className="py-1">
                                  {isDividend ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/20 text-blue-300">DIVIDEND</span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-danger/20 text-danger">SELL</span>
                                  )}
                                </td>
                                <td className="py-1 text-secondary">{new Date(sellAlloc.exit_date).toLocaleDateString()}</td>
                                <td className="py-1 font-medium text-primary">{sellAlloc.quantity.toLocaleString()}</td>
                                <td className="py-1 text-secondary">{fmtCurrency(sellAlloc.exit_price, group.liveData?.currency)}</td>
                                <td className="py-1 text-secondary font-medium">{fmtCurrency(sellAlloc.proceeds, group.liveData?.currency)}</td>
                                <td className="py-1 text-secondary text-[10px]">{sellAlloc.brokerage ? `${currencySymbol}${fmtPlain(sellAlloc.brokerage)}` : '—'}</td>
                                <td className="py-1 text-secondary text-[10px]">{sellAlloc.govtTax ? `${currencySymbol}${fmtPlain(sellAlloc.govtTax)}` : '—'}</td>
                                <td className="py-1 font-medium">
                                  <span className={sellAlloc.realizedPnL >= 0 ? 'text-success' : 'text-danger'}>
                                    {sellAlloc.realizedPnL >= 0 ? '+' : ''}{fmtCurrency(sellAlloc.realizedPnL, group.liveData?.currency)}
                                  </span>
                                  {!isDividend && (
                                    <span className="text-[9px] ml-1 text-tertiary">({realPnlPct >= 0 ? '+' : ''}{realPnlPct.toFixed(2)}%)</span>
                                  )}
                                </td>
                                <td className="py-1 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        if (isDividend) onEditStock(sellAlloc.sellId);
                                        else onEditSoldStock(sellAlloc.sellId);
                                      }}
                                      className="p-1 text-secondary hover:text-primary rounded hover:bg-surface-hover transition-colors"
                                      title={isDividend ? 'Edit Dividend' : 'Edit Sell'}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        if (isDividend) onDeleteStock(sellAlloc.sellId);
                                        else onDeleteSoldStock(sellAlloc.sellId);
                                      }}
                                      className="p-1 text-secondary hover:text-danger rounded hover:bg-danger/10 transition-colors"
                                      title={isDividend ? 'Delete Dividend' : 'Delete Sell'}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </td>
    </tr>
  );
};

