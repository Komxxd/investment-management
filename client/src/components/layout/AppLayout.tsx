import React, { useState, useEffect, useRef } from 'react'
import { Plus, Briefcase, Trash2, Pencil, ChevronRight, ChevronDown, Info, User, LogOut, Folder, Home, Sun, Moon, Check, Settings } from 'lucide-react'
import { api } from '../../services/api/client'
import { usePortfolioContext } from '../../features/portfolio/hooks/PortfolioContext'
import { useTheme } from '../../app/providers/ThemeProvider'
import { useCurrency } from '../../app/providers/CurrencyProvider'
import { useAuth } from '../../app/providers/AuthProvider'
import { useNavigate, useLocation, useParams, Outlet } from 'react-router-dom'
import { GlobalSearch } from './GlobalSearch'
import { MarketTicker } from './MarketTicker'

import { CreatePortfolioModal } from '../../features/portfolio/components/CreatePortfolioModal'
import { ConfirmationModal } from '../ui/ConfirmationModal'
import { RecycleBinModal } from '../../features/portfolio/components/RecycleBinModal'
import { SettingsModal } from '../../features/settings/components/SettingsModal'

export function AppLayout() {
  const { session, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { displayCurrency, setDisplayCurrency, currencySymbol } = useCurrency();

  const {
    portfolios,
    setPortfolios,
    stocks,
    soldStocks,
    pricesLoading,
    isCreateModalOpen,
    setIsCreateModalOpen,
    fetchData
  } = usePortfolioContext();

  const location = useLocation();
  const navigate = useNavigate();

  const isPortfolioPage = location.pathname.startsWith('/portfolio/');
  const portfolioId = isPortfolioPage ? location.pathname.split('/')[2] : null;
  const portfolioName = portfolioId ? portfolios.find(p => p.id === portfolioId)?.name : null;

  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [isPortfolioMenuOpen, setIsPortfolioMenuOpen] = useState(false);
  const portfolioMenuRef = useRef<HTMLDivElement>(null);
  const [isRecycleBinModalOpen, setIsRecycleBinModalOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
      if (portfolioMenuRef.current && !portfolioMenuRef.current.contains(event.target as Node)) {
        setIsPortfolioMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!loading && !session) {
      navigate('/login');
    }
  }, [session, loading, navigate]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-divider border-t-zinc-900 rounded-full animate-spin" /></div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className={`flex flex-col bg-background text-primary font-sans ${isPortfolioPage ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <MarketTicker />
      {/* Unified Top Header */}
      <header className="h-14 sm:h-16 bg-surface border-b border-divider px-2 sm:px-4 flex items-center justify-between gap-3 sm:gap-4 shrink-0 z-10 w-full">
          <div className="flex items-center gap-2 sm:gap-4 flex-1">
            <div className="hidden md:flex items-center shrink-0 cursor-pointer" onClick={() => navigate('/portfolios')}>
              <img src="/favicon.svg" alt="Logo" className="w-8 h-8" />
            </div>

            {isPortfolioPage && (
              <div className="relative flex items-center" ref={portfolioMenuRef}>
                <button 
                  onClick={() => setIsPortfolioMenuOpen(!isPortfolioMenuOpen)}
                  className="flex items-center justify-between gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold text-primary hover:opacity-80 transition-opacity bg-surface py-1 sm:py-1.5 px-1.5 sm:px-3 rounded border border-divider w-[110px] sm:w-[140px]"
                >
                  <span className="truncate text-left">{portfolioName || 'Select Portfolio'}</span>
                  <ChevronDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 text-secondary transition-transform ${isPortfolioMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isPortfolioMenuOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-56 bg-surface border border-divider rounded-lg py-1 z-50 shadow-2xl shadow-black/50">
                    <button
                      onClick={() => {
                        setIsPortfolioMenuOpen(false);
                        navigate('/portfolios');
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-secondary hover:text-primary hover:bg-surface-hover transition-colors flex items-center gap-2"
                    >
                      <Briefcase className="w-3.5 h-3.5 text-tertiary" />
                      View All Portfolios
                    </button>
                    <div className="border-b border-divider my-1" />
                    {portfolios.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setIsPortfolioMenuOpen(false);
                          navigate(`/portfolio/${p.id}`);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 truncate ${
                          p.id === portfolioId 
                            ? 'bg-primary/10 text-primary font-medium' 
                            : 'text-secondary hover:bg-surface-hover hover:text-primary'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 shrink-0 rounded-sm border ${p.id === portfolioId ? 'bg-primary border-primary flex items-center justify-center' : 'border-secondary'}`}>
                          {p.id === portfolioId && <Check className="w-2.5 h-2.5 text-background" />}
                        </div>
                        <span className="truncate">{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div id="navbar-left-portal" className="flex items-center"></div>

            <div className="flex-1 max-w-md">
              <GlobalSearch />
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <div id="navbar-actions-portal" className="flex items-center gap-1 sm:gap-2"></div>

            <div className="relative group" ref={accountMenuRef}>
              <button
                onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
                title="Account Settings"
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-colors border ${isAccountMenuOpen
                  ? 'bg-surface text-primary border-zinc-900'
                  : 'bg-surface-hover text-secondary border-divider hover:bg-divider'
                  }`}
              >
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>



              {isAccountMenuOpen && (
                <div className="absolute right-0 mt-2 min-w-[240px] max-w-sm bg-surface border border-divider rounded-lg py-1 z-50 shadow-xl shadow-black/50">
                  <div className="px-4 py-3 border-b border-divider">
                    <p className="text-[10px] text-secondary mb-0.5 uppercase tracking-wide">Signed in as</p>
                    <p className="text-xs font-medium text-primary truncate">
                      {session?.user?.email}
                    </p>
                  </div>
                  <div className="py-1 border-b border-divider">
                    <button
                      onClick={toggleTheme}
                      className="w-full text-left px-4 py-2 text-xs text-secondary hover:bg-background hover:text-primary flex items-center gap-2"
                    >
                      {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                      {theme === 'dark' ? "Light Mode" : "Dark Mode"}
                    </button>
                    <button
                      onClick={() => setDisplayCurrency(displayCurrency === 'INR' ? 'USD' : 'INR')}
                      className="w-full text-left px-4 py-2 text-xs text-secondary hover:bg-background hover:text-primary flex items-center gap-2"
                    >
                      <span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[10px] bg-surface-hover rounded-sm border border-divider">
                        {displayCurrency === 'INR' ? '$' : '₹'}
                      </span>
                      Switch to {displayCurrency === 'INR' ? 'USD' : 'INR'}
                    </button>
                  </div>
                  <div className="py-1 border-b border-divider">
                    <button
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        setIsRecycleBinModalOpen(true);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-secondary hover:bg-background hover:text-primary flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Recycle Bin
                    </button>
                    <button
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        setIsSettingsModalOpen(true);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-secondary hover:bg-background hover:text-primary flex items-center gap-2"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Indices Setting
                    </button>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={async () => {
                        await api.post('/api/auth/logout', {});
                        localStorage.removeItem('auth_token');
                        window.location.href = '/';
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-secondary hover:bg-background hover:text-primary flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

      {/* Full-width scrollable container */}
      <div className={`flex-1 w-full flex flex-col ${isPortfolioPage ? 'min-h-0' : ''}`}>
        {/* Main Content constraints */}
        <div className={`flex flex-col flex-1 w-full max-w-[1600px] mx-auto bg-background ${isPortfolioPage ? 'min-h-0' : ''}`}>
          <main className={`flex-1 flex flex-col min-w-0 bg-background relative z-0 ${isPortfolioPage ? 'min-h-0' : ''}`}>
            <div className={`flex-1 px-2 md:px-4 pt-2 md:pt-3 pb-2 md:pb-4 flex flex-col ${isPortfolioPage ? 'min-h-0' : ''}`}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      
      <RecycleBinModal
        isOpen={isRecycleBinModalOpen}
        onClose={() => setIsRecycleBinModalOpen(false)}
        onRestore={() => fetchData()}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  );
}
