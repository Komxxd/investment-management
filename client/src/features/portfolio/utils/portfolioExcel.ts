import type { IndicatorData } from '../components/dashboard/dashboardConfig';
import type { LivePricesMap, SymbolGroup } from '../components/dashboard/dashboardTypes';

type ExcelDetailRow = Record<string, string | number | undefined>;

export async function exportPortfolioToExcel({
  portfolioName,
  filteredSymbolGroups,
  livePrices,
  indicators,
}: {
  portfolioName: string;
  filteredSymbolGroups: SymbolGroup[];
  livePrices: LivePricesMap;
  indicators: Record<string, IndicatorData>;
}) {
  if (filteredSymbolGroups.length === 0) return;

  const summaryData = filteredSymbolGroups.map((group) => {
    const currentPrice = livePrices[group.symbol]?.price || 0;
    const currentValue = group.netQty * currentPrice;
    const pnl = currentValue - group.netCostBasis;
    const pnlPct = group.netCostBasis > 0 ? (pnl / group.netCostBasis) * 100 : 0;

    return {
      Ticker: group.symbol,
      'Total Quantity': group.netQty,
      'Avg Buy Price': group.avgBuyPrice,
      'Current Price': currentPrice,
      'Invested Value': group.netCostBasis,
      'Current Value': currentValue,
      'P&L': pnl,
      'P&L %': pnlPct,
      'Total Dividend': group.totalDividend,
      '50 DMA': group.liveData?.dma50 ?? indicators[group.symbol]?.dma50 ?? '—',
      '200 DMA': group.liveData?.dma200 ?? indicators[group.symbol]?.dma200 ?? '—',
      'RSI (14)': indicators[group.symbol]?.rsi ?? '—',
    };
  });

  const detailsData: ExcelDetailRow[] = [];
  filteredSymbolGroups.forEach((group) => {
    group.events.forEach((ev) => {
      if (ev.type === 'BUY') {
        detailsData.push({
          Type: 'BUY',
          Date: ev.raw.entry_date,
          Ticker: group.symbol,
          Quantity: ev.raw.quantity,
          Price: ev.raw.entry_price,
          'Total Amount': ev.raw.quantity * (ev.raw.entry_price || 0),
        });
      } else if (ev.type === 'SELL') {
        detailsData.push({
          Type: 'SELL',
          Date: ev.raw.exit_date,
          Ticker: group.symbol,
          Quantity: ev.raw.quantity,
          Price: ev.raw.exit_price,
          'Total Amount': ev.raw.quantity * (ev.raw.exit_price || 0),
        });
      } else if (ev.type === 'DIVIDEND') {
        detailsData.push({
          Type: 'DIVIDEND',
          Date: ev.raw.entry_date,
          Ticker: group.symbol,
          Quantity: ev.totalShares ?? '-',
          Price: ev.raw.quantity,
          'Total Amount': ev.totalAmount ?? '-',
        });
      } else if (ev.type === 'SPLIT') {
        detailsData.push({
          Type: 'SPLIT',
          Date: ev.raw.entry_date,
          Ticker: group.symbol,
          Quantity: ev.totalShares ?? '-',
          Price: ev.raw.quantity,
          'Total Amount': '-',
        });
      } else if (ev.type === 'BONUS') {
        detailsData.push({
          Type: 'BONUS',
          Date: ev.raw.entry_date,
          Ticker: group.symbol,
          Quantity: ev.totalShares ?? '-',
          Price: ev.raw.quantity,
          'Total Amount': '-',
        });
      }
    });
  });

  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  const wsDetails = XLSX.utils.json_to_sheet(detailsData);

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Details');

  XLSX.writeFile(wb, `${portfolioName || 'Portfolio'}_Export.xlsx`);
}
