import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api/client';

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await api.get(`/api/prices/search?q=${encodeURIComponent(query)}`);
        setResults(data);
        setIsOpen(true);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (symbol: string) => {
    setIsOpen(false);
    setQuery('');
    navigate(`/stocks/${symbol}`);
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <div className="relative flex items-center w-full h-8 sm:h-9 rounded-md bg-background border border-divider overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
        <div className="grid place-items-center h-full w-8 sm:w-10 text-tertiary">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <input
          className="peer h-full w-full outline-none text-xs sm:text-sm bg-transparent text-primary placeholder-tertiary"
          type="text"
          id="search"
          placeholder="Search stocks by symbol or name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        />
        {isLoading && (
          <div className="grid place-items-center h-full w-8 sm:w-10 text-tertiary">
            <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-divider rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.map((result, idx) => (
            <button
              key={`${result.symbol}-${idx}`}
              onClick={() => handleSelect(result.symbol)}
              className="w-full text-left px-4 py-2 hover:bg-hover flex flex-col items-start focus:outline-none focus:bg-hover transition-colors border-b border-divider last:border-0"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-semibold text-primary text-sm">{result.symbol}</span>
                <span className="text-xs text-tertiary">{result.exchange}</span>
              </div>
              <span className="text-xs text-secondary truncate w-full">{result.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
