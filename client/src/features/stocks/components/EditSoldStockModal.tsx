import React, { useState, useEffect } from 'react';
import { useCurrency } from '../../../app/providers/CurrencyProvider';
import { X } from 'lucide-react';
import { api } from '../../../services/api/client';

interface SoldStock {
  id: string;
  portfolio_id: string;
  symbol: string;
  quantity: number;
  exit_price: number;
  brokerage?: number;
  govt_tax?: number;
  exit_date: string;
}

interface EditSoldStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdited: () => void;
  soldStock: SoldStock | null;
}

export function EditSoldStockModal({ isOpen, onClose, onEdited, soldStock }: EditSoldStockModalProps) {
  const { currencySymbol, formatCurrency: fmtCurrency } = useCurrency();
  const [quantity, setQuantity] = useState('');
  const [value, setValue] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [brokerage, setBrokerage] = useState('0');
  const [govtTax, setGovtTax] = useState('0');
  const [exitDate, setExitDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (soldStock) {
      setQuantity(soldStock.quantity.toString());
      setExitPrice(soldStock.exit_price.toString());
      if (soldStock.quantity && soldStock.exit_price > 0) {
        setValue((soldStock.quantity * soldStock.exit_price).toFixed(2));
      } else {
        setValue('');
      }
      setBrokerage((soldStock.brokerage || 0).toString());
      setGovtTax((soldStock.govt_tax || 0).toString());
      setExitDate(soldStock.exit_date);
    }
  }, [soldStock]);

  if (!isOpen || !soldStock) return null;

  const isFractionalAllowed = soldStock.symbol ? !(soldStock.symbol.toUpperCase().endsWith('.NS') || soldStock.symbol.toUpperCase().endsWith('.BO')) : true;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || !exitPrice || !exitDate) return;

    setLoading(true);
    setError('');

    let dbError: any = null;
    try {
      await api.put(`/api/sold-stocks/${soldStock.id}`, { 
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
      onEdited();
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
        
        <h2 className="text-xl font-semibold mb-1 text-primary tracking-tight">Edit Sell Transaction: {soldStock.symbol}</h2>
        <p className="text-sm text-secondary mb-6">Update the sell details for this asset.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-secondary mb-1">
                Asset Symbol
              </label>
              <input
                type="text"
                value={soldStock.symbol}
                disabled
                className="w-full bg-background border border-divider rounded-lg px-3 py-2 text-sm text-secondary cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="editExitDate" className="block text-sm font-medium text-secondary mb-1">
                Exit Date
              </label>
              <input
                type="date"
                id="editExitDate"
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
                className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
              />
            </div>
            
            <div>
              <label htmlFor="editExitPrice" className="block text-sm font-medium text-secondary mb-1">
                Exit Price ({currencySymbol})
              </label>
              <input
                type="number"
                id="editExitPrice"
                value={exitPrice}
                onChange={(e) => handlePriceChange(e.target.value)}
                className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                step="any"
                min="0"
              />
            </div>

            <div className="col-span-2 grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="editSellQuantity" className="block text-sm font-medium text-secondary mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  id="editSellQuantity"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                  step={isFractionalAllowed ? "any" : "1"}
                  min="0"
                />
              </div>

              <div>
                <label htmlFor="editValue" className="block text-sm font-medium text-secondary mb-1">
                  Value ({currencySymbol})
                </label>
                <input
                  type="number"
                  id="editValue"
                  value={value}
                  onChange={(e) => handleValueChange(e.target.value)}
                  className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                  placeholder="0.00"
                  step="any"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label htmlFor="editBrokerage" className="block text-sm font-medium text-secondary mb-1">
                Brokerage ({currencySymbol})
              </label>
              <input
                type="number"
                id="editBrokerage"
                value={brokerage}
                onChange={(e) => setBrokerage(e.target.value)}
                className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                step="any"
                min="0"
              />
            </div>

            <div>
              <label htmlFor="editGovtTax" className="block text-sm font-medium text-secondary mb-1">
                Govt Tax ({currencySymbol})
              </label>
              <input
                type="number"
                id="editGovtTax"
                value={govtTax}
                onChange={(e) => setGovtTax(e.target.value)}
                className="w-full bg-surface border border-divider rounded-lg px-3 py-2 text-sm text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                step="any"
                min="0"
              />
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
              disabled={loading || !quantity || !exitPrice || !exitDate}
              className="bg-danger hover:bg-danger/80 text-primary text-sm font-medium py-2 px-4 rounded-lg  transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
