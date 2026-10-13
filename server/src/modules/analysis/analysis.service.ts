import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

export async function getStockAnalysis(symbol: string) {
  try {
    const today = new Date();
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(today.getFullYear() - 3);

    const [quoteSummary, searchResult, fundamentals] = await Promise.all([
      (async () => {
        try {
          return await yahooFinance.quoteSummary(symbol, {
            modules: [
              'assetProfile',
              'defaultKeyStatistics',
              'financialData',
              'price',
              'summaryDetail',
              'majorHoldersBreakdown',
              'institutionOwnership',
              'fundOwnership',
              'calendarEvents',
              'earningsHistory'
            ]
          } as any);
        } catch { return null; }
      })(),
      (async () => {
        try { return await yahooFinance.search(symbol, { newsCount: 5 }); } catch { return { news: [] }; }
      })(),
      (async () => {
        try {
          return await yahooFinance.fundamentalsTimeSeries(symbol, {
            module: 'all',
            type: 'quarterly',
            period1: threeYearsAgo.toISOString().split('T')[0],
            period2: today.toISOString().split('T')[0]
          } as any);
        } catch { return []; }
      })()
    ]);

    return {
      symbol,
      profile: quoteSummary?.assetProfile || null,
      statistics: quoteSummary?.defaultKeyStatistics || null,
      financials: quoteSummary?.financialData || null,
      price: quoteSummary?.price || null,
      summaryDetail: quoteSummary?.summaryDetail || null,
      news: searchResult?.news || [],
      fundamentals: fundamentals || [],
      ownership: {
        majorHoldersBreakdown: quoteSummary?.majorHoldersBreakdown || null,
        institutionOwnership: quoteSummary?.institutionOwnership || null,
        fundOwnership: quoteSummary?.fundOwnership || null
      },
      calendar: quoteSummary?.calendarEvents || null,
      earningsHistory: quoteSummary?.earningsHistory?.history || []
    };
  } catch (error: any) {
    console.error(`Error fetching analysis for ${symbol}:`, error.message);
    throw new Error('Failed to fetch stock analysis data');
  }
}

export async function getStockChart(symbol: string, range: string) {
  try {
    const today = new Date();
    let period1 = new Date();
    let interval = '1d';
    let useChartModule = false;

    switch (range) {
      case '1D':
        period1.setDate(today.getDate() - 1);
        interval = '5m';
        useChartModule = true;
        break;
      case '5D':
        period1.setDate(today.getDate() - 5);
        interval = '15m';
        useChartModule = true;
        break;
      case '1M':
        period1.setMonth(today.getMonth() - 1);
        interval = '1d';
        break;
      case '6M':
        period1.setMonth(today.getMonth() - 6);
        interval = '1d';
        break;
      case '1Y':
        period1.setFullYear(today.getFullYear() - 1);
        interval = '1d';
        break;
      case '5Y':
        period1.setFullYear(today.getFullYear() - 5);
        interval = '1wk';
        break;
      default:
        period1.setMonth(today.getMonth() - 6);
        interval = '1d';
    }

    if (useChartModule) {
      const result = await yahooFinance.chart(symbol, {
        period1: period1.toISOString(),
        interval: interval as any
      });
      return result.quotes || [];
    } else {
      const result = await yahooFinance.historical(symbol, {
        period1: period1.toISOString().split('T')[0],
        period2: today.toISOString().split('T')[0],
        interval: interval as any
      });
      return result || [];
    }
  } catch (error: any) {
    console.error(`Error fetching chart for ${symbol}:`, error.message);
    return [];
  }
}
