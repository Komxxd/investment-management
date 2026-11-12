import type { DashboardOption } from '../dashboard/dashboardConfig';
import type { Portfolio, Stock } from '../../hooks/usePortfolioData';

export interface HomeStatsSummary {
  totalStocks: number;
  maxNetInvested: number;
  totalInvestment: number;
  totalCurrentValue: number;
  totalUnrealizedPnL: number;
  unrealizedPnLPercent: number;
  totalRealizedPnL: number;
  totalPnL: number;
  totalPnLPercent: number;
  totalDayGain: number;
  totalDayGainPercent: number;
  totalDividend: number;
  totalBrokerage: number;
  totalGovtTax: number;
  xirr: number;
}

export type PortfolioSummaryMap = Record<string, HomeStatsSummary>;

export const SUMMARY_STATS: DashboardOption[] = [
  { id: 'totalStocks', label: 'Total Stocks' },
  { id: 'totalPnL', label: 'Total P&L' },
  { id: 'netInvested', label: 'Net Invested' },
  { id: 'maxNetInvested', label: 'Max Invested' },
  { id: 'dayGain', label: 'Day Gain' },
  { id: 'unrealizedPnL', label: 'Unrealized P&L' },
  { id: 'realizedPnL', label: 'Realized P&L' },
  { id: 'currentValue', label: 'Current Value' },
  { id: 'xirr', label: 'XIRR' },
  { id: 'totalDividend', label: 'Total Dividend' },
  { id: 'brokerage', label: 'Total Brokerage & Tax' },
];

export const DEFAULT_EMPTY_STATS: HomeStatsSummary = {
  totalStocks: 0,
  maxNetInvested: 0,
  totalInvestment: 0,
  totalCurrentValue: 0,
  totalUnrealizedPnL: 0,
  unrealizedPnLPercent: 0,
  totalRealizedPnL: 0,
  totalPnL: 0,
  totalPnLPercent: 0,
  totalDayGain: 0,
  totalDayGainPercent: 0,
  totalDividend: 0,
  totalBrokerage: 0,
  totalGovtTax: 0,
  xirr: 0,
};

/**
 * Sorts portfolio IDs by a selected summary metric or falls back to custom DnD order.
 */
export function sortHomePortfolioOrder(
  portfolioOrder: string[],
  sortField: string | null,
  sortDirection: 'asc' | 'desc',
  portfolios: Portfolio[],
  portfolioSummaries: PortfolioSummaryMap,
  stocks: Stock[]
): string[] {
  if (!sortField) return portfolioOrder;

  const sorted = [...portfolioOrder];
  sorted.sort((a, b) => {
    const pA = portfolios.find(p => p.id === a);
    const pB = portfolios.find(p => p.id === b);
    const psA = portfolioSummaries[a];
    const psB = portfolioSummaries[b];

    let valA: string | number = 0;
    let valB: string | number = 0;

    if (sortField === 'name') {
      valA = pA?.name || '';
      valB = pB?.name || '';
    } else if (sortField === 'totalStocks') {
      const pStocksA = stocks.filter(s => s.portfolio_id === a && Number(s.entry_price) > 0);
      valA = new Set(pStocksA.map(s => s.symbol)).size;
      const pStocksB = stocks.filter(s => s.portfolio_id === b && Number(s.entry_price) > 0);
      valB = new Set(pStocksB.map(s => s.symbol)).size;
    } else if (sortField === 'maxNetInvested') {
      valA = psA?.maxNetInvested || 0;
      valB = psB?.maxNetInvested || 0;
    } else if (sortField === 'netInvested') {
      valA = psA?.totalInvestment || 0;
      valB = psB?.totalInvestment || 0;
    } else if (sortField === 'unrealizedPnL') {
      valA = psA?.totalUnrealizedPnL || 0;
      valB = psB?.totalUnrealizedPnL || 0;
    } else if (sortField === 'realizedPnL') {
      valA = psA?.totalRealizedPnL || 0;
      valB = psB?.totalRealizedPnL || 0;
    } else if (sortField === 'totalDividend') {
      valA = psA?.totalDividend || 0;
      valB = psB?.totalDividend || 0;
    } else if (sortField === 'dayGain') {
      valA = psA?.totalDayGain || 0;
      valB = psB?.totalDayGain || 0;
    } else if (sortField === 'totalPnL') {
      valA = psA?.totalPnL || 0;
      valB = psB?.totalPnL || 0;
    } else if (sortField === 'currentValue') {
      valA = psA?.totalCurrentValue || 0;
      valB = psB?.totalCurrentValue || 0;
    } else if (sortField === 'brokerage') {
      valA = (psA?.totalBrokerage || 0) + (psA?.totalGovtTax || 0);
      valB = (psB?.totalBrokerage || 0) + (psB?.totalGovtTax || 0);
    } else if (sortField === 'xirr') {
      valA = psA?.xirr || 0;
      valB = psB?.xirr || 0;
    }

    valA = valA ?? 0;
    valB = valB ?? 0;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

