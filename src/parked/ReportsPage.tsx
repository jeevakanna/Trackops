// Parked for the next version
import React, { useState, useEffect } from 'react';
import { DatePreset, ChartsReport, Product, SaleRecord, PurchaseRecord, FinanceRecord } from '../types';
import * as api from '../services/api';
import { getDateStringsForPreset, AccountingSummary, PnLComparison } from '../utils/accounting';
import { formatINR, formatDateTime } from '../utils/formatters';
import { exportReportToExcel, exportReportToPDF } from '../services/exportService';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';

interface ReportsPageProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

function computeGroup(from: string, to: string): 'day' | 'month' {
  const d1 = new Date(from);
  const d2 = new Date(to);
  const diffDays = Math.round(Math.abs((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
  return diffDays <= 31 ? 'day' : 'month';
}

function formatPeriodLabel(period: string, group: 'day' | 'month'): string {
  if (!period) return '';
  if (group === 'month') {
    const parts = period.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const month = parts[1];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(month, 10) - 1;
      return `${monthNames[mIdx] || month} '${year.slice(-2)}`;
    }
    return period;
  }
  const parts = period.split('-');
  if (parts.length === 3) {
    const [, month, day] = parts;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(month, 10) - 1;
    return `${parseInt(day, 10)} ${monthNames[mIdx] || month}`;
  }
  return period;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onShowToast }) => {
  const [datePreset, setDatePreset] = useState<DatePreset>('this-month');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  const [chartsData, setChartsData] = useState<ChartsReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Derive date strings based on preset
  const dateRange = getDateStringsForPreset(datePreset, customStart, customEnd);
  const currentGroup = computeGroup(dateRange.from, dateRange.to);

  const fetchCharts = async () => {
    setIsLoading(true);
    try {
      const data = await api.getChartsReport(dateRange.from, dateRange.to, currentGroup);
      setChartsData(data);
    } catch (err) {
      onShowToast('Error', err instanceof Error ? err.message : 'Failed to load charts data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCharts();
  }, [datePreset, dateRange.from, dateRange.to]);

  useEffect(() => {
    const handleUpdate = () => fetchCharts();
    window.addEventListener('trackops:data_updated', handleUpdate);
    return () => window.removeEventListener('trackops:data_updated', handleUpdate);
  }, [datePreset, dateRange.from, dateRange.to]);

  // Chart 1: Income vs Expenses
  const incomeVsExpensesList = (chartsData?.incomeVsExpenses || []).map((d) => ({
    ...d,
    displayPeriod: formatPeriodLabel(d.period, chartsData?.group || currentGroup)
  }));
  const hasIncomeVsExpenses = incomeVsExpensesList.some((d) => (d.moneyIn || 0) > 0 || (d.expenses || 0) > 0);

  // Chart 2: Sales Over Time
  const salesList = (chartsData?.salesOverTime || []).map((d) => ({
    ...d,
    displayPeriod: formatPeriodLabel(d.period, chartsData?.group || currentGroup)
  }));
  const hasSalesData = salesList.some((d) => (d.amount || 0) > 0);

  // Chart 3: Purchases Over Time
  const purchasesList = (chartsData?.purchasesOverTime || []).map((d) => ({
    ...d,
    displayPeriod: formatPeriodLabel(d.period, chartsData?.group || currentGroup)
  }));
  const hasPurchasesData = purchasesList.some((d) => (d.amount || 0) > 0);

  // Chart 4: Profit Trend
  const profitList = (chartsData?.profitTrend || []).map((d) => ({
    ...d,
    displayPeriod: formatPeriodLabel(d.period, chartsData?.group || currentGroup)
  }));
  const hasProfitData = profitList.some((d) => (d.netProfit || 0) !== 0);

  // Chart 5: Top Selling Posters
  const topSellingList = (chartsData?.topSelling || []).map((d) => ({
    ...d,
    displayName: `${d.name} (${d.unitType})`
  }));
  const hasTopSellingData = topSellingList.length > 0 && topSellingList.some((d) => (d.qty || 0) > 0);

  // Chart 6: Stock Levels
  const stockList = (chartsData?.stockLevels || []).map((d) => ({
    ...d,
    displayName: `${d.name} (${d.unitType})`,
    statusLabel: d.status === 'out' ? 'Out of stock' : d.status === 'low' ? 'Low stock (≤10)' : 'OK'
  }));
  const hasStockData = stockList.length > 0;

  const getStockStatusColor = (status: 'out' | 'low' | 'ok') => {
    switch (status) {
      case 'out':
        return '#dc2626'; // Red
      case 'low':
        return '#f59e0b'; // Amber
      case 'ok':
      default:
        return '#10b981'; // Green
    }
  };

  return (
    <div className="flex flex-col w-full pb-20">
      {/* Header Context & Date Range Presets */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-lg">
        <div>
          <span className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
            Visual Analytics (Parked)
          </span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            Reports & Charts
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Showing performance for <span className="font-semibold text-on-surface">{dateRange.label}</span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-surface-container text-[11px] font-medium">
              Grouped by {chartsData?.group || currentGroup}
            </span>
          </p>
        </div>

        {/* Date Preset Selector */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-surface-container-low shadow-xs">
            <button
              type="button"
              onClick={() => setDatePreset('this-month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                datePreset === 'this-month'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('last-month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                datePreset === 'last-month'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('this-quarter')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                datePreset === 'this-quarter'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              This Quarter
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('this-year')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                datePreset === 'this-year'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              This Year
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                datePreset === 'custom'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">date_range</span>
              <span>Custom</span>
            </button>
          </div>

          {/* Custom Date Pickers */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 bg-surface-container-lowest p-2 rounded-xl border border-surface-container-low shadow-xs text-xs animate-in fade-in">
              <span className="text-on-surface-variant font-medium">From:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1 rounded bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-on-surface-variant font-medium">To:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1 rounded bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-on-surface-variant font-medium">Loading charts...</p>
        </div>
      ) : (
        /* Charts Grid: 1 column on mobile, 2 columns on desktop */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
          {/* 1. Income vs Expenses Over Time */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-low shadow-xs flex flex-col">
            <div className="mb-4">
              <h2 className="text-base font-bold text-on-surface">Income vs Expenses</h2>
              <p className="text-xs text-on-surface-variant">Money in (sales + other income) compared with operating expenses</p>
            </div>
            <div className="sr-only">
              Chart showing comparison of total money received versus operating overhead expenses over {dateRange.label}.
            </div>
            {!hasIncomeVsExpenses ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-surface-container-low/20 rounded-xl border border-dashed border-outline/30 my-auto">
                <span className="material-symbols-outlined text-3xl text-outline mb-2">query_stats</span>
                <p className="text-sm font-semibold text-on-surface">No data for this period</p>
                <p className="text-xs text-on-surface-variant mt-0.5">No revenue or expenses logged during this period.</p>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeVsExpensesList} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eaeff4" />
                    <XAxis dataKey="displayPeriod" tick={{ fontSize: 11, fill: '#71787d' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#71787d' }}
                      tickFormatter={(val: number) => `₹${val}`}
                    />
                    <Tooltip
                      formatter={(val: unknown, name?: unknown) => [formatINR(Number(val) || 0), String(name || '')]}
                      labelFormatter={(label) => `Period: ${label}`}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #eaeff4', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="moneyIn" name="Money In" fill="#006782" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#ba1a1a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 2. Sales Over Time */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-low shadow-xs flex flex-col">
            <div className="mb-4">
              <h2 className="text-base font-bold text-on-surface">Sales Over Time</h2>
              <p className="text-xs text-on-surface-variant">Daily or monthly gross revenue generated from billing</p>
            </div>
            <div className="sr-only">
              Chart showing gross sales revenue trends over {dateRange.label}.
            </div>
            {!hasSalesData ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-surface-container-low/20 rounded-xl border border-dashed border-outline/30 my-auto">
                <span className="material-symbols-outlined text-3xl text-outline mb-2">point_of_sale</span>
                <p className="text-sm font-semibold text-on-surface">No data for this period</p>
                <p className="text-xs text-on-surface-variant mt-0.5">No sales recorded during this selected period.</p>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesList} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#006782" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#006782" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eaeff4" />
                    <XAxis dataKey="displayPeriod" tick={{ fontSize: 11, fill: '#71787d' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#71787d' }}
                      tickFormatter={(val: number) => `₹${val}`}
                    />
                    <Tooltip
                      formatter={(val: unknown) => [formatINR(Number(val) || 0), 'Sales Revenue']}
                      labelFormatter={(label) => `Period: ${label}`}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #eaeff4', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="amount" name="Sales Revenue" stroke="#006782" strokeWidth={2} fillOpacity={1} fill="url(#salesGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 3. Purchases Over Time */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-low shadow-xs flex flex-col">
            <div className="mb-4">
              <h2 className="text-base font-bold text-on-surface">Purchases Over Time</h2>
              <p className="text-xs text-on-surface-variant">Procurement outflow for inventory stock additions</p>
            </div>
            <div className="sr-only">
              Chart showing inventory purchase outflow trends over {dateRange.label}.
            </div>
            {!hasPurchasesData ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-surface-container-low/20 rounded-xl border border-dashed border-outline/30 my-auto">
                <span className="material-symbols-outlined text-3xl text-outline mb-2">shopping_bag</span>
                <p className="text-sm font-semibold text-on-surface">No data for this period</p>
                <p className="text-xs text-on-surface-variant mt-0.5">No stock purchases recorded during this selected period.</p>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={purchasesList} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eaeff4" />
                    <XAxis dataKey="displayPeriod" tick={{ fontSize: 11, fill: '#71787d' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#71787d' }}
                      tickFormatter={(val: number) => `₹${val}`}
                    />
                    <Tooltip
                      formatter={(val: unknown) => [formatINR(Number(val) || 0), 'Purchases']}
                      labelFormatter={(label) => `Period: ${label}`}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #eaeff4', fontSize: '12px' }}
                    />
                    <Bar dataKey="amount" name="Stock Purchases" fill="#006874" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 4. Profit Trend */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-low shadow-xs flex flex-col">
            <div className="mb-4">
              <h2 className="text-base font-bold text-on-surface">Profit Trend</h2>
              <p className="text-xs text-on-surface-variant">Net retained profit (Sales + Other Income - COGS - Expenses)</p>
            </div>
            <div className="sr-only">
              Chart illustrating net retained profit trends across {dateRange.label}.
            </div>
            {!hasProfitData ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-surface-container-low/20 rounded-xl border border-dashed border-outline/30 my-auto">
                <span className="material-symbols-outlined text-3xl text-outline mb-2">trending_up</span>
                <p className="text-sm font-semibold text-on-surface">No data for this period</p>
                <p className="text-xs text-on-surface-variant mt-0.5">No net profit transactions recorded in this period.</p>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={profitList} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eaeff4" />
                    <XAxis dataKey="displayPeriod" tick={{ fontSize: 11, fill: '#71787d' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#71787d' }}
                      tickFormatter={(val: number) => `₹${val}`}
                    />
                    <Tooltip
                      formatter={(val: unknown) => [formatINR(Number(val) || 0), 'Net Profit']}
                      labelFormatter={(label) => `Period: ${label}`}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #eaeff4', fontSize: '12px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="netProfit"
                      name="Net Profit"
                      stroke="#059669"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#059669' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 5. Top-Selling Posters */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-low shadow-xs flex flex-col">
            <div className="mb-4">
              <h2 className="text-base font-bold text-on-surface">Top-Selling Posters</h2>
              <p className="text-xs text-on-surface-variant">Top 10 products by quantity sold with unit size</p>
            </div>
            <div className="sr-only">
              Chart ranking the top selling products by units sold and generated revenue for {dateRange.label}.
            </div>
            {!hasTopSellingData ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-surface-container-low/20 rounded-xl border border-dashed border-outline/30 my-auto">
                <span className="material-symbols-outlined text-3xl text-outline mb-2">leaderboard</span>
                <p className="text-sm font-semibold text-on-surface">No data for this period</p>
                <p className="text-xs text-on-surface-variant mt-0.5">No products sold during this selected period.</p>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={topSellingList}
                    margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#eaeff4" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#71787d' }} />
                    <YAxis
                      dataKey="displayName"
                      type="category"
                      width={130}
                      tick={{ fontSize: 11, fill: '#191c1e' }}
                    />
                    <Tooltip
                      formatter={(val: unknown, _name?: unknown, item?: { payload?: { revenue?: number } }) => [
                        `${Number(val) || 0} units (${formatINR(item?.payload?.revenue || 0)})`,
                        'Sold'
                      ]}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #eaeff4', fontSize: '12px' }}
                    />
                    <Bar dataKey="qty" name="Units Sold" fill="#006782" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 6. Stock Levels */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-low shadow-xs flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-on-surface">Stock Levels & Status</h2>
                <p className="text-xs text-on-surface-variant">Current inventory units held with stock status</p>
              </div>
              {/* Status Badges Legend */}
              <div className="flex items-center gap-3 text-[11px] font-medium text-on-surface-variant">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                  <span>Out (0)</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span>Low (≤10)</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>OK</span>
                </span>
              </div>
            </div>
            <div className="sr-only">
              Chart showing inventory stock quantities with out of stock and low stock warnings.
            </div>
            {!hasStockData ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-surface-container-low/20 rounded-xl border border-dashed border-outline/30 my-auto">
                <span className="material-symbols-outlined text-3xl text-outline mb-2">inventory_2</span>
                <p className="text-sm font-semibold text-on-surface">No data for this period</p>
                <p className="text-xs text-on-surface-variant mt-0.5">No inventory catalog items registered.</p>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stockList} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eaeff4" />
                    <XAxis
                      dataKey="displayName"
                      tick={{ fontSize: 10, fill: '#71787d' }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#71787d' }} />
                    <Tooltip
                      formatter={(val: unknown, _name?: unknown, item?: { payload?: { statusLabel?: string } }) => [
                        `${Number(val) || 0} units - Status: ${item?.payload?.statusLabel || 'OK'}`,
                        'Stock Available'
                      ]}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #eaeff4', fontSize: '12px' }}
                    />
                    <Bar dataKey="qty" name="Stock Qty" radius={[4, 4, 0, 0]}>
                      {stockList.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getStockStatusColor(entry.status)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// =======================================================================
// PARKED REPORTS (CR-001)
// The Sales, Purchases, and Stock table reports and their export helpers
// below are preserved per CR-001 specification pending future product decision.
// They are not rendered in the main ReportsPage UI.
// =======================================================================

export interface ParkedTableReportsProps {
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  finances: FinanceRecord[];
  products: Product[];
  currentRangeLabel: string;
  accounting: AccountingSummary;
  pnlComparison: PnLComparison;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const ParkedTableReports: React.FC<ParkedTableReportsProps> = ({
  sales,
  purchases,
  finances,
  products,
  currentRangeLabel,
  accounting,
  pnlComparison,
  onShowToast
}) => {
  const handleExport = (reportType: 'sales' | 'purchases' | 'stock', format: 'excel' | 'pdf') => {
    try {
      const opts = {
        reportType,
        periodLabel: currentRangeLabel,
        products,
        sales,
        purchases,
        finances,
        accounting,
        pnlComparison
      };
      if (format === 'excel') {
        exportReportToExcel(opts);
        onShowToast('Excel Generated', `Downloaded ${reportType} report`, 'success');
      } else {
        exportReportToPDF(opts);
        onShowToast('PDF Generated', `Downloaded ${reportType} report`, 'success');
      }
    } catch (err) {
      onShowToast('Export Error', err instanceof Error ? err.message : 'Export failed', 'error');
    }
  };

  return (
    <div style={{ display: 'none' }} aria-hidden="true" data-testid="parked-reports-container">
      {/* Sales Table Report */}
      <div id="parked-sales-report">
        <button onClick={() => handleExport('sales', 'excel')}>Export Sales Excel</button>
        <button onClick={() => handleExport('sales', 'pdf')}>Export Sales PDF</button>
        <table>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>#{s.id}</td>
                <td>{formatDateTime(s.timestamp)}</td>
                <td>{s.items.map((i) => `${i.name} (x${i.qty})`).join(', ')}</td>
                <td>{s.paymentMethod}</td>
                <td>{formatINR(s.grandTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Purchases Table Report */}
      <div id="parked-purchases-report">
        <button onClick={() => handleExport('purchases', 'excel')}>Export Purchases Excel</button>
        <button onClick={() => handleExport('purchases', 'pdf')}>Export Purchases PDF</button>
        <table>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id}>
                <td>#{p.id}</td>
                <td>{formatDateTime(p.timestamp)}</td>
                <td>{p.items.map((i) => `${i.name} (x${i.qty})`).join(', ')}</td>
                <td>{p.paymentMethod}</td>
                <td>{formatINR(p.grandTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stock Valuation Table Report */}
      <div id="parked-stock-report">
        <button onClick={() => handleExport('stock', 'excel')}>Export Stock Excel</button>
        <button onClick={() => handleExport('stock', 'pdf')}>Export Stock PDF</button>
        <table>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td>{p.qty}</td>
                <td>{formatINR(p.cost)}</td>
                <td>{formatINR(p.sell)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
