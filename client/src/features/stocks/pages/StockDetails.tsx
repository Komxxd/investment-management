import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { api } from '../../../services/api/client';
import { useCurrency } from '../../../app/providers/CurrencyProvider';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';

const TIME_RANGES = ['1D', '5D', '1M', '6M', '1Y', '5Y'];

export function StockDetails() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [timeRange, setTimeRange] = useState('6M');
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  const [statementType, setStatementType] = useState('Income Statement');

  // Fetch static data (profile, news, stats)
  useEffect(() => {
    async function fetchData() {
      if (!symbol) return;
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/api/analysis/${symbol}`);
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [symbol]);

  // Fetch chart data when timeframe changes
  useEffect(() => {
    async function fetchChart() {
      if (!symbol) return;
      try {
        setChartLoading(true);
        const res = await api.get(`/api/analysis/${symbol}/chart?range=${timeRange}`);
        
        const formattedChart = res.map((point: any) => {
          const d = new Date(point.date);
          let dateStr = '';
          if (timeRange === '1D') {
            dateStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
          } else if (timeRange === '5Y' || timeRange === '1Y') {
            dateStr = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
          } else {
            dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          }
          return {
            date: dateStr,
            price: point.close
          };
        }).filter((point: any) => point.price != null); // filter out empty values

        setChartData(formattedChart);
      } catch (err: any) {
        console.error('Failed to fetch chart:', err);
      } finally {
        setChartLoading(false);
      }
    }
    fetchChart();
  }, [symbol, timeRange]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-tertiary mt-20">
          <RefreshCw className="w-8 h-8 animate-spin mb-4" />
          <p>Fetching latest data for {symbol}...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center p-8 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 mt-10">
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!data) return null;

    const { profile, statistics, financials, price, summaryDetail, news, fundamentals, ownership, calendar, earningsHistory } = data;

    const currentPrice = price?.regularMarketPrice || financials?.currentPrice;
    const previousClose = price?.regularMarketPreviousClose || summaryDetail?.previousClose;
    const priceChange = currentPrice && previousClose ? currentPrice - previousClose : 0;
    const priceChangePct = previousClose ? (priceChange / previousClose) * 100 : 0;
    const isPositive = priceChange >= 0;

    const formatNumber = (num: number) => {
      if (!num) return '-';
      if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
      if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
      if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
      return num.toLocaleString();
    };

    const recentFundamentals = [...(fundamentals || [])]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4);

    const formattedEarnings = (earningsHistory || []).map((e: any) => ({
      quarter: new Date(e.quarter).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
      Actual: e.epsActual,
      Estimate: e.epsEstimate,
      surprise: e.surprisePercent
    }));

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">{symbol}</h1>
            <p className="text-base text-secondary mt-1">{profile?.longName || price?.shortName || symbol}</p>
            <p className="text-sm text-tertiary mt-1">
              {profile?.sector && <span>{profile.sector} &bull; </span>}
              {profile?.industry && <span>{profile.industry}</span>}
            </p>
          </div>
          <div className="text-left md:text-right">
            <div className="text-2xl font-bold text-primary">
              {currentPrice ? formatCurrency(currentPrice, price?.currency) : '-'}
            </div>
            <div className={`flex items-center md:justify-end gap-1 font-medium mt-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              <span>
                {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-surface border border-divider rounded-xl p-4 sm:p-6 h-[450px] flex flex-col">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <h2 className="text-lg font-semibold text-primary">Price History</h2>
            <div className="flex items-center bg-surface border border-divider rounded overflow-hidden shadow-sm text-xs w-full sm:w-auto">
              {TIME_RANGES.map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`flex-1 sm:flex-none px-3 py-1 font-medium transition-colors ${
                    timeRange === range 
                      ? 'bg-primary text-background' 
                      : 'text-secondary hover:bg-surface-hover hover:text-primary'
                  } ${range !== '5Y' ? 'border-r border-divider' : ''}`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 relative">
            {chartLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-surface/50 z-10 backdrop-blur-sm rounded-lg">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-tertiary">
                No chart data available for this timeframe.
              </div>
            ) : null}

            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="rgba(255,255,255,0.3)" 
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
                  minTickGap={30}
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  stroke="rgba(255,255,255,0.3)" 
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                  tickFormatter={(val) => val.toFixed(2)}
                  width={60}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e1e24', borderColor: '#3f3f46', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                  isAnimationActive={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke={isPositive ? '#22c55e' : '#ef4444'} 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Basic Stats */}
        <div className="flex items-center justify-between gap-6 overflow-x-auto pb-4 scrollbar-hide">
          <StatCard label="Market Cap" value={formatNumber(summaryDetail?.marketCap || price?.marketCap)} />
          <StatCard label="P/E Ratio" value={summaryDetail?.trailingPE?.toFixed(2) || '-'} />
          <StatCard label="Forward P/E" value={summaryDetail?.forwardPE?.toFixed(2) || '-'} />
          <StatCard label="Beta (5Y)" value={summaryDetail?.beta?.toFixed(2) || '-'} />
          <StatCard label="52W High" value={summaryDetail?.fiftyTwoWeekHigh?.toFixed(2) || '-'} />
          <StatCard label="52W Low" value={summaryDetail?.fiftyTwoWeekLow?.toFixed(2) || '-'} />
          <StatCard label="Div Yield" value={summaryDetail?.dividendYield ? (summaryDetail.dividendYield * 100).toFixed(2) + '%' : '-'} />
          <StatCard label="Volume" value={formatNumber(summaryDetail?.volume)} />
        </div>

        <div className="h-px w-full bg-divider my-2"></div>

        {/* Advanced Metrics */}
        <div>
          <h2 className="text-sm font-semibold text-primary mb-3">Advanced Metrics</h2>
          <div className="flex items-center justify-between gap-6 overflow-x-auto pb-4 scrollbar-hide">
            <StatCard label="EBITDA" value={formatNumber(financials?.ebitda)} />
            <StatCard label="Operating Margin" value={financials?.operatingMargins ? (financials.operatingMargins * 100).toFixed(2) + '%' : '-'} />
            <StatCard label="ROE" value={financials?.returnOnEquity ? (financials.returnOnEquity * 100).toFixed(2) + '%' : '-'} />
            <StatCard label="ROA" value={financials?.returnOnAssets ? (financials.returnOnAssets * 100).toFixed(2) + '%' : '-'} />
            <StatCard label="Total Debt" value={formatNumber(financials?.totalDebt)} />
            <StatCard label="Total Cash" value={formatNumber(financials?.totalCash)} />
            <StatCard label="Operating Cash Flow" value={formatNumber(financials?.operatingCashflow)} />
            <StatCard label="Free Cash Flow" value={formatNumber(financials?.freeCashflow)} />
          </div>
        </div>

        {/* Earnings & Dividends Calendar */}
        {(calendar || formattedEarnings.length > 0) && (
          <div className="bg-surface border border-divider rounded-xl p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-primary mb-6">Earnings & Dividends Calendar</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Next Earnings Date" value={calendar?.earnings?.earningsDate?.[0] ? new Date(calendar.earnings.earningsDate[0]).toLocaleDateString() : '-'} />
              <StatCard label="Expected EPS" value={calendar?.earnings?.earningsAverage ? calendar.earnings.earningsAverage.toFixed(2) : '-'} />
              <StatCard label="Ex-Dividend Date" value={calendar?.exDividendDate ? new Date(calendar.exDividendDate).toLocaleDateString() : '-'} />
              <StatCard label="Dividend Date" value={calendar?.dividendDate ? new Date(calendar.dividendDate).toLocaleDateString() : '-'} />
            </div>

            {formattedEarnings.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Historical EPS Surprise</h3>
                <div className="h-64 mt-4 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={formattedEarnings} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="quarter" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                      <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e1e24', borderColor: '#3f3f46', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
                      <Bar dataKey="Estimate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Actual" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Financial Statements */}
        {recentFundamentals.length > 0 && (
          <div className="bg-surface border border-divider rounded-xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <h2 className="text-lg font-semibold text-primary">Financial Statements (Quarterly)</h2>
              <div className="flex items-center bg-surface border border-divider rounded overflow-hidden shadow-sm text-xs w-full sm:w-auto">
                {['Income Statement', 'Balance Sheet', 'Cash Flow'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setStatementType(type)}
                    className={`flex-1 sm:flex-none px-3 py-1 font-medium transition-colors ${
                      statementType === type 
                        ? 'bg-primary text-background' 
                        : 'text-secondary hover:bg-surface-hover hover:text-primary'
                    } ${type !== 'Cash Flow' ? 'border-r border-divider' : ''}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-tertiary uppercase bg-surface-hover border-b border-divider">
                  <tr>
                    <th className="px-4 py-3 font-medium rounded-tl-lg">Metric</th>
                    {recentFundamentals.map((f: any, i: number) => (
                      <th key={i} className={`px-4 py-3 font-medium text-right ${i === recentFundamentals.length - 1 ? 'rounded-tr-lg' : ''}`}>
                        {new Date(f.date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {statementType === 'Income Statement' && (
                    <>
                      <TableRow label="Total Revenue" dataKey="totalRevenue" data={recentFundamentals} formatNumber={formatNumber} />
                      <TableRow label="Gross Profit" dataKey="grossProfit" data={recentFundamentals} formatNumber={formatNumber} />
                      <TableRow label="Operating Income" dataKey="operatingIncome" data={recentFundamentals} formatNumber={formatNumber} />
                      <TableRow label="Net Income" dataKey="netIncome" data={recentFundamentals} formatNumber={formatNumber} />
                      <TableRow label="EBITDA" dataKey="EBITDA" data={recentFundamentals} formatNumber={formatNumber} />
                    </>
                  )}
                  {statementType === 'Balance Sheet' && (
                    <>
                      <TableRow label="Total Assets" dataKey="totalAssets" data={recentFundamentals} formatNumber={formatNumber} />
                      <TableRow label="Total Liabilities" dataKey="totalLiabilitiesNetMinorityInterest" data={recentFundamentals} formatNumber={formatNumber} />
                      <TableRow label="Total Debt" dataKey="totalDebt" data={recentFundamentals} formatNumber={formatNumber} />
                      <TableRow label="Cash & Equivalents" dataKey="cashAndCashEquivalents" data={recentFundamentals} formatNumber={formatNumber} />
                      <TableRow label="Working Capital" dataKey="workingCapital" data={recentFundamentals} formatNumber={formatNumber} />
                    </>
                  )}
                  {statementType === 'Cash Flow' && (
                    <>
                      <TableRow label="Operating Cash Flow" dataKey="operatingCashFlow" data={recentFundamentals} formatNumber={formatNumber} />
                      <TableRow label="Investing Cash Flow" dataKey="investingCashFlow" data={recentFundamentals} formatNumber={formatNumber} />
                      <TableRow label="Financing Cash Flow" dataKey="financingCashFlow" data={recentFundamentals} formatNumber={formatNumber} />
                      <TableRow label="Free Cash Flow" dataKey="freeCashFlow" data={recentFundamentals} formatNumber={formatNumber} />
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ownership & Institutional Data */}
        {ownership?.majorHoldersBreakdown && (
          <div className="bg-surface border border-divider rounded-xl p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-primary mb-6">Ownership & Institutional Data</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="% Held by Insiders" value={ownership.majorHoldersBreakdown.insidersPercentHeld ? (ownership.majorHoldersBreakdown.insidersPercentHeld * 100).toFixed(2) + '%' : '-'} />
              <StatCard label="% Held by Institutions" value={ownership.majorHoldersBreakdown.institutionsPercentHeld ? (ownership.majorHoldersBreakdown.institutionsPercentHeld * 100).toFixed(2) + '%' : '-'} />
              <StatCard label="% of Float Held by Inst." value={ownership.majorHoldersBreakdown.institutionsFloatPercentHeld ? (ownership.majorHoldersBreakdown.institutionsFloatPercentHeld * 100).toFixed(2) + '%' : '-'} />
              <StatCard label="Number of Institutions" value={ownership.majorHoldersBreakdown.institutionsCount || '-'} />
            </div>

            {ownership.institutionOwnership?.ownershipList && ownership.institutionOwnership.ownershipList.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Top Institutional Holders</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-tertiary uppercase bg-surface-hover border-b border-divider">
                      <tr>
                        <th className="px-4 py-3 font-medium rounded-tl-lg">Holder</th>
                        <th className="px-4 py-3 font-medium text-right">Shares</th>
                        <th className="px-4 py-3 font-medium text-right">Value</th>
                        <th className="px-4 py-3 font-medium text-right rounded-tr-lg">% Out</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                      {ownership.institutionOwnership.ownershipList.slice(0, 10).map((holder: any, i: number) => (
                        <tr key={i} className="hover:bg-surface-hover/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-secondary">{holder.organization}</td>
                          <td className="px-4 py-3 text-right text-primary">{formatNumber(holder.position)}</td>
                          <td className="px-4 py-3 text-right text-primary">{formatCurrency(holder.value, price?.currency)}</td>
                          <td className="px-4 py-3 text-right text-primary">{(holder.pctHeld * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profile & News */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface border border-divider rounded-xl p-6">
              <h2 className="text-lg font-semibold text-primary mb-4">About</h2>
              <p className="text-secondary text-sm leading-relaxed whitespace-pre-line">
                {profile?.longBusinessSummary || 'No company description available.'}
              </p>
              {profile?.website && (
                <a 
                  href={profile.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Visit Website
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-surface border border-divider rounded-xl p-6">
              <h2 className="text-lg font-semibold text-primary mb-4">Latest News</h2>
              <div className="space-y-4">
                {news.length > 0 ? news.map((item: any, i: number) => (
                  <a 
                    key={i} 
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <p className="text-sm font-medium text-primary group-hover:text-blue-400 transition-colors line-clamp-2">
                      {item.title}
                    </p>
                    <p className="text-xs text-tertiary mt-1">
                      {item.publisher} &bull; {new Date(item.providerPublishTime * 1000).toLocaleDateString()}
                    </p>
                  </a>
                )) : (
                  <p className="text-sm text-tertiary">No recent news available.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 h-full w-full bg-background overflow-y-auto">
      <div className="w-full max-w-full space-y-6 pb-20">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-secondary hover:text-primary transition-colors focus:outline-none w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        {renderContent()}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="flex flex-col justify-center whitespace-nowrap min-w-max">
      <span className="text-[10px] font-medium text-tertiary uppercase tracking-wider">{label}</span>
      <span className="text-sm font-semibold text-primary mt-0.5">{value}</span>
    </div>
  );
}

function TableRow({ label, dataKey, data, formatNumber }: { label: string, dataKey: string, data: any[], formatNumber: (n: number) => string }) {
  return (
    <tr className="hover:bg-surface-hover/50 transition-colors">
      <td className="px-4 py-3 font-medium text-secondary">{label}</td>
      {data.map((item, i) => {
        const val = item[dataKey];
        const isNegative = val < 0;
        return (
          <td key={i} className={`px-4 py-3 text-right ${isNegative ? 'text-red-400' : 'text-primary'}`}>
            {val ? formatNumber(val) : '-'}
          </td>
        );
      })}
    </tr>
  );
}
