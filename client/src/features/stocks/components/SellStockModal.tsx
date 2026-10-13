import React, { useState, useEffect, useRef } from 'react';
import { useCurrency } from '../../../app/providers/CurrencyProvider';
import { X, ChevronDown, AlertCircle, Search } from 'lucide-react';
import { api } from '../../../services/api/client';

interface SellStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
  portfolioId: string | null;
  initialSymbol?: string;
  initialPrice?: number;
}

interface OwnedStock {
  symbol: string;
  totalBought: number;   // total qty bought
  totalSold: number;     // qty already sold
  available: number;     // totalBought - totalSold
  entryPrice: number;    // for reference display
}

export function SellStockModal({ isOpen, onClose, onAdded, portfolioId, initialSymbol, initialPrice }: SellStockModalProps) {
  const { currencySymbol, formatCurrency: fmtCurrency } = useCurrency();
  const [ownedStocks, setOwnedStocks] = useState<OwnedStock[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(false);

  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol || '');
  const [searchQuery, setSearchQuery] = useState(initialSymbol || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [value, setValue] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [brokerage, setBrokerage] = useState('0');
  const [govtTax, setGovtTax] = useState('0');
  const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedStock = ownedStocks.find(s => s.symbol === selectedSymbol) ?? null;
  const isFractionalAllowed = selectedSymbol ? !(selectedSymbol.toUpperCase().endsWith('.NS') || selectedSymbol.toUpperCase().endsWith('.BO')) : true;
  const filteredStocks = ownedStocks.filter(s =>
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Quantity validation
  const parsedQty = parseFloat(quantity);
  const qtyExceedsHolding =
    selectedStock !== null &&
    !isNaN(parsedQty) &&
    parsedQty > selectedStock.available;

  // Fetch owned stocks whenever the modal opens
  useEffect(() => {
    if (!isOpen || !portfolioId) return;

    const fetchOwnedStocks = async () => {
      setLoadingStocks(true);
      setOwnedStocks([]);
      setSelectedSymbol(initialSymbol || '');
      setSearchQuery(initialSymbol || '');
      setShowDropdown(false);
      setQuantity('');
      setValue('');
      setExitPrice(initialPrice ? initialPrice.toString() : '');
      setBrokerage('0');
      setGovtTax('0');
      setExitDate(new Date().toISOString().split('T')[0]);
      setError('');

      try {
        // Use the server's FIFO-aware portfolio summary for consistent quantities
        // This accounts for corporate actions (bonus, splits, dividends) properly
        const result = await api.get(`/api/calculations/portfolio/${portfolioId}/summary`);
        const symbolGroups = result?.symbolGroups || [];

        if (symbolGroups.length === 0) {
          setOwnedStocks([]);
          setLoadingStocks(false);
          return;
        }

        // Build list from server-calculated FIFO data
        const list: OwnedStock[] = symbolGroups
          .filter((g: any) => g.netQty > 0)
          .map((g: any) => ({
            symbol: g.symbol,
            totalBought: g.totalBoughtQty,
            entryPrice: g.avgBuyPrice,
            totalSold: g.totalSoldQty,
            available: g.netQty,
          }))
          .sort((a: OwnedStock, b: OwnedStock) => a.symbol.localeCompare(b.symbol));

        setOwnedStocks(list);
      } catch (err: any) {
        setError('Failed to load portfolio holdings: ' + err.message);
      } finally {
        setLoadingStocks(false);
      }
    };

    fetchOwnedStocks();
  }, [isOpen, portfolioId]);

  if (!isOpen || !portfolioId) return null;

  const handleQuantityChange = (val: string) => {
    const sanitizedVal = isFractionalAllowed ? val : val.replace(/[^0-9]/g, '');
    setQuantity(sanitizedVal);
    if (exitPrice && sanitizedVal && !isNaN(parseFloat(sanitizedVal)) && !isNaN(parseFloat(exitPrice))) {
      setValue((parseFloat(sanitizedVal) * parseFloat(exitPrice)).toFixed(2));
    } else if (!sanitizedVal) {
      setValue('');
    }
  };

  const handleValueChange = (val: string) => {
    setValue(val);
    if (exitPrice && val && !isNaN(parseFloat(val)) && !isNaN(parseFloat(exitPrice)) && parseFloat(exitPrice) !== 0) {
      const calculatedQty = parseFloat(val) / parseFloat(exitPrice);
      setQuantity(isFractionalAllowed ? String(Number(calculatedQty.toFixed(6))) : Math.floor(calculatedQty).toString());
    } else if (!val) {
      setQuantity('');
    }
  };

  const handlePriceChange = (val: string) => {
    setExitPrice(val);
    if (quantity && val && !isNaN(parseFloat(quantity)) && !isNaN(parseFloat(val))) {
      setValue((parseFloat(quantity) * parseFloat(val)).toFixed(2));
    } else if (value && val && !isNaN(parseFloat(value)) && !isNaN(parseFloat(val)) && parseFloat(val) !== 0) {
      const calculatedQty = parseFloat(value) / parseFloat(val);
      setQuantity(isFractionalAllowed ? String(Number(calculatedQty.toFixed(6))) : Math.floor(calculatedQty).toString());
    }
  };

  const handleSelectStock = async (stockSymbol: string) => {
    setSelectedSymbol(stockSymbol);
    setSearchQuery(stockSymbol);
    setQuantity('');
    setValue('');
    setShowDropdown(false);

    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiBase}/api/prices?symbols=${encodeURIComponent(stockSymbol)}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data[stockSymbol]) {
          const priceStr = data[stockSymbol].price.toString();
          setExitPrice(priceStr);
          if (quantity && !isNaN(parseFloat(quantity))) {
            setValue((parseFloat(quantity) * parseFloat(priceStr)).toFixed(2));
          } else if (value && !isNaN(parseFloat(value))) {
            const calculatedQty = parseFloat(value) / parseFloat(priceStr);
            setQuantity(isFractionalAllowed ? String(Number(calculatedQty.toFixed(6))) : Math.floor(calculatedQty).toString());
          }
        }
      }
    } catch (err) {
      console.error('Error fetching live price:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSymbol || !quantity || !exitPrice || !exitDate) return;
    if (qtyExceedsHolding) return;

    setLoading(true);
    setError('');

    let dbError: any = null;
    try {
      await api.post('/api/sold-stocks', {
        portfolio_id: portfolioId,
        symbol: selectedSymbol,
        quantity: parseFloat(quantity),
        exit_price: parseFloat(exitPrice),
        brokerage: parseFloat(brokerage || '0'),
        govt_tax: parseFloat(govtTax || '0'),
        exit_date: exitDate
      });
    } catch (e: any) {
      dbError = e;
    }

    setLoading(false);
    if (dbError) {
      setError(dbError.message);
    } else {
      onAdded();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay">
      <div className="bg-surface w-full max-w-md rounded-lg p-6 relative shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-tertiary hover:text-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-xl font-semibold mb-1 text-primary tracking-tight">Sell Asset</h2>
        <p className="text-sm text-secondary mb-6">Select from your holdings and enter exit details.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">

            {/* Owned Stocks Dropdown */}
            <div>
              <label htmlFor="sell-symbol" className="block text-sm font-medium text-secondary mb-1">
                Select Asset to Sell
              </label>

              {loadingStocks ? (
                <div className="flex items-center gap-2 py-2 text-sm text-tertiary">
                  <div className="w-4 h-4 border-2 border-divider border-t-zinc-900 rounded-full animate-spin" />
                  Loading your holdings…
                </div>
              ) : ownedStocks.length === 0 ? (
                <div className="flex items-center gap-2 py-3 px-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  No assets available to sell in this portfolio.
                </div>
              ) : (
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 w-4 h-4 text-tertiary" />
                    <input
                      type="text"
                      id="sell-symbol"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedSymbol('');
                        setQuantity('');
                        setValue('');
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      className="w-full bg-surface border border-divider rounded-lg pl-9 pr-8 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow placeholder-gray-400"
                      placeholder="Search or select asset to sell"
                      autoComplete="off"
                    />
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 w-4 h-4 text-tertiary" />
                  </div>
                  
                  {showDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-surface border border-divider rounded-lg shadow-2xl shadow-black/50 shadow-black/40 max-h-60 overflow-auto divide-y divide-divider">
                      {filteredStocks.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-secondary text-center">No matching assets found</div>
                      ) : (
                        filteredStocks.map((s) => (
                          <button
                            key={s.symbol}
                            type="button"
                            onClick={() => handleSelectStock(s.symbol)}
                            className="w-full text-left px-4 py-2 hover:bg-background flex items-center justify-between group transition-colors"
                          >
                            <div className="font-semibold text-sm text-primary group-hover:text-orange-600 transition-colors">
                              {s.symbol}
                            </div>
                            <div className="text-[10px] text-secondary bg-surface-hover px-2 py-1 rounded uppercase tracking-wider">
                              Available: {s.available.toLocaleString()}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Holding hint */}
              {selectedStock && (
                <p className="mt-1.5 text-[11px] text-tertiary">
                  Bought: <span className="font-medium text-secondary">{selectedStock.totalBought.toLocaleString()}</span>
                  &nbsp;·&nbsp; Sold: <span className="font-medium text-secondary">{selectedStock.totalSold.toLocaleString()}</span>
                  &nbsp;·&nbsp; Available: <span className="font-medium text-success">{selectedStock.available.toLocaleString()}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="exitDate" className="block text-sm font-medium text-secondary mb-1">
                  Exit Date
                </label>
                <input
                  type="date"
                  id="exitDate"
                  value={exitDate}
                  onChange={(e) => setExitDate(e.target.value)}
                  className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                />
              </div>

              <div>
                <label htmlFor="exitPrice" className="block text-sm font-medium text-secondary mb-1">
                  Exit Price ({currencySymbol})
                </label>
                <input
                  type="number"
                  id="exitPrice"
                  value={exitPrice}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                  placeholder="150.00"
                  step="any"
                  min="0"
                  disabled={!selectedSymbol}
                />
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sell-quantity" className="block text-sm font-medium text-secondary mb-1">
                    Quantity
                    {selectedStock && (
                      <span className="ml-1 text-[10px] font-normal text-tertiary">
                        (max {selectedStock.available.toLocaleString()})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    id="sell-quantity"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    max={selectedStock?.available}
                    className={`w-full bg-surface border rounded-lg px-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 transition-shadow ${
                      qtyExceedsHolding
                        ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
                        : 'border-divider focus:ring-zinc-900 focus:border-zinc-900'
                    }`}
                    placeholder="0"
                    step={isFractionalAllowed ? "any" : "1"}
                    min="0"
                    disabled={!selectedSymbol}
                  />
                  {qtyExceedsHolding && (
                    <p className="mt-1 text-[11px] text-danger flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Exceeds available holding of {selectedStock!.available.toLocaleString()}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="sell-value" className="block text-sm font-medium text-secondary mb-1">
                    Value ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    id="sell-value"
                    value={value}
                    onChange={(e) => handleValueChange(e.target.value)}
                    className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                    placeholder="0.00"
                    step="any"
                    min="0"
                    disabled={!selectedSymbol}
                  />
                </div>
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="brokerage" className="block text-sm font-medium text-secondary mb-1">
                    Brokerage ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    id="brokerage"
                    value={brokerage}
                    onChange={(e) => setBrokerage(e.target.value)}
                    className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                    placeholder="0.00"
                    step="any"
                    min="0"
                    disabled={!selectedSymbol}
                  />
                </div>

                <div>
                  <label htmlFor="govtTax" className="block text-sm font-medium text-secondary mb-1">
                    Govt Tax ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    id="govtTax"
                    value={govtTax}
                    onChange={(e) => setGovtTax(e.target.value)}
                    className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                    placeholder="0.00"
                    step="any"
                    min="0"
                    disabled={!selectedSymbol}
                  />
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <div className="pt-4 flex justify-end gap-2 border-t border-divider mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-secondary hover:bg-background border border-transparent rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                !selectedSymbol ||
                !quantity ||
                !exitPrice ||
                !exitDate ||
                qtyExceedsHolding ||
                ownedStocks.length === 0
              }
              className="bg-danger hover:bg-danger/80 text-primary text-sm font-medium py-2 px-4 rounded-lg  transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Sell Asset'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
