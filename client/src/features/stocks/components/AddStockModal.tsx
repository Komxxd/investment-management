import React, { useState, useEffect, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { api } from '../../../services/api/client';
import { useCurrency } from '../../../app/providers/CurrencyProvider';

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
  portfolioId: string | null;
  initialSymbol?: string;
  initialPrice?: number;
  existingSymbols?: string[];
}

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

export function AddStockModal({ isOpen, onClose, onAdded, portfolioId, initialSymbol, initialPrice, existingSymbols = [] }: AddStockModalProps) {
  const { currencySymbol, formatCurrency: fmtCurrency } = useCurrency();
  const [ticker, setTicker] = useState(initialSymbol || '');
  const [searchQuery, setSearchQuery] = useState(initialSymbol || '');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [quantity, setQuantity] = useState('');
  const [value, setValue] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [brokerage, setBrokerage] = useState('0');
  const [govtTax, setGovtTax] = useState('0');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isFractionalAllowed = ticker ? !(ticker.toUpperCase().endsWith('.NS') || ticker.toUpperCase().endsWith('.BO')) : true;

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery(initialSymbol || '');
      setTicker(initialSymbol || '');
      setSearchResults([]);
      setQuantity('');
      setValue('');
      setEntryPrice(initialPrice ? initialPrice.toString() : '');
      setBrokerage('0');
      setGovtTax('0');
      setEntryDate(new Date().toISOString().split('T')[0]);
      setError('');
      setLoading(false);
    }
  }, [isOpen, initialSymbol, initialPrice]);

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

  // Debounced search
  useEffect(() => {
    const fetchResults = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      
      // If the query perfectly matches the selected ticker, don't search again
      if (searchQuery === ticker) return;

      setIsSearching(true);
      try {
        const apiBase = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiBase}/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        setSearchResults(data);
        setShowDropdown(true);
      } catch (err) {
        console.error('Error searching stocks:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(() => {
      fetchResults();
    }, 300); // 300ms delay

    return () => clearTimeout(debounce);
  }, [searchQuery, ticker]);

  if (!isOpen || !portfolioId) return null;

  const handleQuantityChange = (val: string) => {
    const sanitizedVal = isFractionalAllowed ? val : val.replace(/[^0-9]/g, '');
    setQuantity(sanitizedVal);
    if (entryPrice && sanitizedVal && !isNaN(parseFloat(sanitizedVal)) && !isNaN(parseFloat(entryPrice))) {
      setValue((parseFloat(sanitizedVal) * parseFloat(entryPrice)).toFixed(2));
    } else if (!sanitizedVal) {
      setValue('');
    }
  };

  const handleValueChange = (val: string) => {
    setValue(val);
    if (entryPrice && val && !isNaN(parseFloat(val)) && !isNaN(parseFloat(entryPrice)) && parseFloat(entryPrice) !== 0) {
      const calculatedQty = parseFloat(val) / parseFloat(entryPrice);
      setQuantity(isFractionalAllowed ? String(Number(calculatedQty.toFixed(6))) : Math.floor(calculatedQty).toString());
    } else if (!val) {
      setQuantity('');
    }
  };

  const handlePriceChange = (val: string) => {
    setEntryPrice(val);
    if (quantity && val && !isNaN(parseFloat(quantity)) && !isNaN(parseFloat(val))) {
      setValue((parseFloat(quantity) * parseFloat(val)).toFixed(2));
    } else if (value && val && !isNaN(parseFloat(value)) && !isNaN(parseFloat(val)) && parseFloat(val) !== 0) {
      const calculatedQty = parseFloat(value) / parseFloat(val);
      setQuantity(isFractionalAllowed ? String(Number(calculatedQty.toFixed(6))) : Math.floor(calculatedQty).toString());
    }
  };

  const handleSelectStock = async (result: SearchResult) => {
    setTicker(result.symbol);
    setSearchQuery(result.symbol);
    setShowDropdown(false);

    // Check if stock already exists
    if (existingSymbols.includes(result.symbol)) {
      setError('This stock is already in the portfolio. Use the row action to add more lots.');
      return;
    } else {
      setError('');
    }

    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiBase}/api/prices?symbols=${encodeURIComponent(result.symbol)}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data[result.symbol]) {
          const priceStr = data[result.symbol].price.toString();
          setEntryPrice(priceStr);
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
    if (!ticker.trim() || !quantity || !entryPrice || !entryDate) return;

    if (existingSymbols.includes(ticker.toUpperCase().trim())) {
      setError('This stock is already in the portfolio. Use the row action to add more lots.');
      return;
    }

    setLoading(true);
    setError('');

    let dbError: any = null;
    try {
      await api.post('/api/stocks', {
        portfolio_id: portfolioId, 
        symbol: ticker.toUpperCase().trim(),
        quantity: parseFloat(quantity),
        entry_price: parseFloat(entryPrice),
        brokerage: parseFloat(brokerage || '0'),
        govt_tax: parseFloat(govtTax || '0'),
        entry_date: entryDate
      });
    } catch (e: any) {
      dbError = e;
    }

    setLoading(false);

    if (dbError) {
      setError(dbError.message);
    } else {
      setTicker('');
      setSearchQuery('');
      setQuantity('');
      setValue('');
      setEntryPrice('');
      setBrokerage('0');
      setGovtTax('0');
      setEntryDate(new Date().toISOString().split('T')[0]);
      onAdded();
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
        
        <h2 className="text-xl font-semibold mb-1 text-primary tracking-tight">Buy New Asset</h2>
        <p className="text-sm text-secondary mb-6">Search and enter the asset buy details.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            
            {/* Search Bar */}
            <div className="relative" ref={dropdownRef}>
              <label htmlFor="search" className="block text-sm font-medium text-secondary mb-1">
                Search Asset Symbol
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-tertiary" />
                <input
                  type="text"
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                  className="w-full bg-surface border border-divider rounded-lg pl-9 pr-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow uppercase"
                  placeholder="e.g. RELIANCE.NS, AAPL"
                  autoComplete="off"
                  autoFocus
                />
                {isSearching && (
                  <div className="absolute right-3 top-2.5 w-4 h-4 border-2 border-divider border-t-zinc-900 rounded-full animate-spin" />
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-surface border border-divider rounded-lg shadow-2xl shadow-black/50 shadow-black/40 max-h-60 overflow-auto divide-y divide-divider">
                  {searchResults.map((result) => (
                    <button
                      key={result.symbol}
                      type="button"
                      onClick={() => handleSelectStock(result)}
                      className="w-full text-left px-4 py-2 hover:bg-background flex items-center justify-between group transition-colors"
                    >
                      <div className="overflow-hidden">
                        <div className="font-semibold text-sm text-primary group-hover:text-orange-600 transition-colors">
                          {result.symbol}
                        </div>
                        <div className="text-xs text-secondary truncate">
                          {result.name}
                        </div>
                      </div>
                      <div className="text-[10px] bg-surface-hover text-secondary px-2 py-1 rounded shrink-0 ml-2 uppercase">
                        {result.exchange}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="entryDate" className="block text-sm font-medium text-secondary mb-1">
                  Entry Date
                </label>
                <input
                  type="date"
                  id="entryDate"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                />
              </div>
              
              <div>
                <label htmlFor="entryPrice" className="block text-sm font-medium text-secondary mb-1">
                  Entry Price ({currencySymbol})
                </label>
                <input
                  type="number"
                  id="entryPrice"
                  value={entryPrice}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                  placeholder="150.00"
                  step="any"
                  min="0"
                />
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="quantity" className="block text-sm font-medium text-secondary mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    id="quantity"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                    placeholder="0"
                    step={isFractionalAllowed ? "any" : "1"}
                    min="0"
                  />
                </div>

                <div>
                  <label htmlFor="value" className="block text-sm font-medium text-secondary mb-1">
                    Value ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    id="value"
                    value={value}
                    onChange={(e) => handleValueChange(e.target.value)}
                    className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                    placeholder="0.00"
                    step="any"
                    min="0"
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
              disabled={loading || !ticker.trim() || !quantity || !entryPrice || !entryDate}
              className="bg-surface hover:bg-zinc-800 text-primary text-sm font-medium py-2 px-4 rounded-lg  transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Add Asset'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
