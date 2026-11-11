import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { BrandMark } from '../../../components/BrandMark';

const NAV_LINKS = [
  { label: 'Overview', href: '#overview', visibility: 'hidden sm:inline-flex' },
  { label: 'Ledger', href: '#features', visibility: 'inline-flex' },
  { label: 'Backtest', href: '#backtesting', visibility: 'inline-flex' },
  { label: 'Research', href: '#research', visibility: 'hidden sm:inline-flex' },
];

export function LandingNavbar() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const scrollToSection = (href: string) => {
    const id = href.replace('#', '');
    if (id === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="sticky top-3 sm:top-5 z-50 px-2.5 sm:px-6 flex justify-center pointer-events-none">
      <nav
        aria-label="Primary Navigation"
        className="pointer-events-auto inline-flex items-center justify-between gap-1 sm:gap-5 px-1.5 py-1.5 rounded-full bg-[#111827] dark:bg-[#09090b]/95 border border-zinc-800/90 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.18)] dark:shadow-[0_14px_40px_rgba(0,0,0,0.75)] max-w-full"
      >
        {/* Circular Left Logo Emblem */}
        <button
          type="button"
          onClick={() => scrollToSection('#overview')}
          aria-label="Prism — Scroll to top"
          title="Prism"
          className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white flex items-center justify-center shrink-0 hover:bg-zinc-100 transition-colors cursor-pointer shadow-xs text-[#111827]"
        >
          <BrandMark variant="glyph" className="w-4 h-4 sm:w-[18px] sm:h-[18px]" label="Prism P" />
        </button>

        {/* Minimal Essential Links */}
        <div className="flex items-center gap-0.5 sm:gap-2 px-0.5 sm:px-2 min-w-0">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              type="button"
              onClick={() => scrollToSection(link.href)}
              className={`${link.visibility} px-2 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap cursor-pointer`}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Rightmost Sign In / Sign Up Pill CTA */}
        <button
          type="button"
          onClick={() => navigate(session ? '/portfolios' : '/login')}
          className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-full bg-white text-[#111827] hover:bg-zinc-200 font-semibold text-[10px] sm:text-xs whitespace-nowrap transition-colors shrink-0 cursor-pointer shadow-xs"
        >
          {session ? 'Open Workspace' : 'Sign In / Sign Up'}
        </button>
      </nav>
    </div>
  );
}
