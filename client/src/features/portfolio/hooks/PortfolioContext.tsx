import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { usePortfolioData } from './usePortfolioData';

type PortfolioData = ReturnType<typeof usePortfolioData>;

const PortfolioContext = createContext<PortfolioData | undefined>(undefined);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const data = usePortfolioData();

  return (
    <PortfolioContext.Provider value={data}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolioContext() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolioContext must be used within a PortfolioProvider');
  }
  return context;
}
