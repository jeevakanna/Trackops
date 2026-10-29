import { SaleRecord, FinanceRecord, DateRange, DatePreset } from '../types';

export interface AccountingSummary {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: number;
  operatingExpensesByCategory: Record<string, number>;
  netProfit: number;
  netMarginPct: number;
  stockPurchases: number;
  moneyIn: number;
  moneyOut: number;
  salesCount: number;
  itemsSold: number;
}

export interface MetricComparison {
  current: number;
  previous: number;
  diff: number;
  pctChange: number | null; // null if previous is 0
}

export interface PnLComparison {
  revenue: MetricComparison;
  cogs: MetricComparison;
  grossProfit: MetricComparison;
  operatingExpenses: MetricComparison;
  netProfit: MetricComparison;
}

/**
 * Checks if a given ISO timestamp falls within the date range in local timezone
 */
export function isDateInRange(isoTimestamp: string, range: DateRange): boolean {
  try {
    const d = new Date(isoTimestamp);
    const time = d.getTime();
    return time >= range.startDate.getTime() && time <= range.endDate.getTime();
  } catch {
    return false;
  }
}

/**
 * Gets DateRange for a preset using real current date
 */
export function getDateRangeForPreset(
  preset: DatePreset,
  customStart?: string,
  customEnd?: string,
  now: Date = new Date()
): DateRange {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  if (preset === 'this-month') {
    const startDate = new Date(year, month, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const label = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return { startDate, endDate, label };
  }

  if (preset === 'last-month') {
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const label = startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return { startDate, endDate, label };
  }

  if (preset === 'this-quarter') {
    const quarterIndex = Math.floor(month / 3);
    const startMonth = quarterIndex * 3;
    const startDate = new Date(year, startMonth, 1, 0, 0, 0, 0);
    const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    const label = `Q${quarterIndex + 1} ${year}`;
    return { startDate, endDate, label };
  }

  if (preset === 'this-year') {
    const startDate = new Date(year, 0, 1, 0, 0, 0, 0);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    const label = `Year ${year}`;
    return { startDate, endDate, label };
  }

  // Custom range
  if (customStart && customEnd) {
    const [sY, sM, sD] = customStart.split('-').map(Number);
    const [eY, eM, eD] = customEnd.split('-').map(Number);
    const startDate = new Date(sY, sM - 1, sD, 0, 0, 0, 0);
    const endDate = new Date(eY, eM - 1, eD, 23, 59, 59, 999);
    const label = `${startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} – ${endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    return { startDate, endDate, label };
  }

  // Fallback to this month
  const startDate = new Date(year, month, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { startDate, endDate, label: now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
}

/**
 * Gets ISO YYYY-MM-DD from/to strings and display label for a preset in Asia/Kolkata
 */
export function getDateStringsForPreset(
  preset: DatePreset,
  customStart?: string,
  customEnd?: string,
  now: Date = new Date()
): { from: string; to: string; label: string } {
  const kolkataDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [year, month] = kolkataDateStr.split('-').map(Number);

  if (preset === 'this-month') {
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
    const d = new Date(year, month - 1, 1);
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return { from, to, label };
  }

  if (preset === 'last-month') {
    let prevY = year;
    let prevM = month - 1;
    if (prevM === 0) {
      prevM = 12;
      prevY--;
    }
    const lastDay = new Date(prevY, prevM, 0).getDate();
    const from = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
    const to = `${prevY}-${String(prevM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const d = new Date(prevY, prevM - 1, 1);
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return { from, to, label };
  }

  if (preset === 'this-quarter') {
    const qIndex = Math.floor((month - 1) / 3);
    const startM = qIndex * 3 + 1;
    const endM = startM + 2;
    const lastDay = new Date(year, endM, 0).getDate();
    const from = `${year}-${String(startM).padStart(2, '0')}-01`;
    const to = `${year}-${String(endM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const label = `Q${qIndex + 1} ${year}`;
    return { from, to, label };
  }

  if (preset === 'this-year') {
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const label = `Year ${year}`;
    return { from, to, label };
  }

  if (customStart && customEnd) {
    const [sY, sM, sD] = customStart.split('-').map(Number);
    const [eY, eM, eD] = customEnd.split('-').map(Number);
    const d1 = new Date(sY, sM - 1, sD);
    const d2 = new Date(eY, eM - 1, eD);
    const label = `${d1.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} – ${d2.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    return { from: customStart, to: customEnd, label };
  }

  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
  return { from, to, label: 'This Month' };
}


/**
 * Returns previous period of the exact same duration immediately preceding range.startDate
 */
export function getPreviousPeriod(range: DateRange): DateRange {
  const durationMs = range.endDate.getTime() - range.startDate.getTime();
  const prevEndDate = new Date(range.startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - durationMs);
  return {
    startDate: prevStartDate,
    endDate: prevEndDate,
    label: `Prior period (${prevStartDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${prevEndDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`
  };
}

/**
 * Gets a DateRange for a specific month index (offset from current or specific year/month)
 */
export function getMonthDateRange(year: number, monthIndex: number): DateRange {
  const startDate = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  const label = startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return { startDate, endDate, label };
}

/**
 * Unified calculation function for all financial metrics
 * Profit = Sales revenue − Cost of goods sold (COGS) − Operating expenses.
 * Operating expenses = finances of type 'expense' that are NOT 'Stock Purchase'.
 */
export function calculateAccounting(params: {
  sales: SaleRecord[];
  finances: FinanceRecord[];
  range?: DateRange;
}): AccountingSummary {
  const { sales, finances, range } = params;

  const filteredSales = range
    ? sales.filter(s => isDateInRange(s.timestamp, range))
    : sales;

  const filteredFinances = range
    ? finances.filter(f => isDateInRange(f.timestamp, range))
    : finances;

  // Revenue = sum of grandTotal of sales in the period
  const revenue = filteredSales.reduce((acc, s) => acc + s.grandTotal, 0);

  // COGS = sum of (qty * cost) for all sold items
  let cogs = 0;
  let itemsSold = 0;
  for (const sale of filteredSales) {
    for (const item of sale.items) {
      cogs += (item.qty * (item.cost || 0));
      itemsSold += item.qty;
    }
  }

  // Gross profit
  const grossProfit = revenue - cogs;
  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  // Operating expenses (type === 'expense' and NOT 'Stock Purchase')
  const operatingExpensesByCategory: Record<string, number> = {};
  let operatingExpenses = 0;
  let stockPurchases = 0;

  for (const f of filteredFinances) {
    if (f.type === 'expense') {
      if (f.category === 'Stock Purchase') {
        stockPurchases += f.amount;
      } else {
        operatingExpenses += f.amount;
        operatingExpensesByCategory[f.category] = (operatingExpensesByCategory[f.category] || 0) + f.amount;
      }
    }
  }

  // Net Profit
  const netProfit = grossProfit - operatingExpenses;
  const netMarginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  // Money in = all income records in finances
  const moneyIn = filteredFinances
    .filter(f => f.type === 'income')
    .reduce((acc, f) => acc + f.amount, 0);

  // Money out = all expense records in finances (operating expenses + stock purchases)
  const moneyOut = filteredFinances
    .filter(f => f.type === 'expense')
    .reduce((acc, f) => acc + f.amount, 0);

  return {
    revenue,
    cogs,
    grossProfit,
    grossMarginPct,
    operatingExpenses,
    operatingExpensesByCategory,
    netProfit,
    netMarginPct,
    stockPurchases,
    moneyIn,
    moneyOut,
    salesCount: filteredSales.length,
    itemsSold
  };
}

/**
 * Compare two accounting summaries (current vs previous period)
 */
export function comparePeriods(
  current: AccountingSummary,
  previous: AccountingSummary
): PnLComparison {
  const calcMetric = (currVal: number, prevVal: number): MetricComparison => {
    const diff = currVal - prevVal;
    const pctChange = prevVal !== 0 ? (diff / Math.abs(prevVal)) * 100 : null;
    return {
      current: currVal,
      previous: prevVal,
      diff,
      pctChange
    };
  };

  return {
    revenue: calcMetric(current.revenue, previous.revenue),
    cogs: calcMetric(current.cogs, previous.cogs),
    grossProfit: calcMetric(current.grossProfit, previous.grossProfit),
    operatingExpenses: calcMetric(current.operatingExpenses, previous.operatingExpenses),
    netProfit: calcMetric(current.netProfit, previous.netProfit)
  };
}
