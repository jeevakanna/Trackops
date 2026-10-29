export interface Product {
  id: number;
  sku: string;
  name: string;
  unit: string;
  qty: number;
  cost: number;
  sell: number;
  reorder: number;
  category?: string;
}

export interface ApiProduct {
  id: number;
  name: string;
  unitType: string;
  stockQty: number;
  costPrice: number;
  sellPrice: number;
  imagePath: string | null;
}

export interface SaleLineItem {
  productId: number;
  name: string;
  unit: string;
  qty: number;
  cost: number; // Cost per unit at time of sale (for COGS calculation)
  price: number;
  total: number;
}

export interface SaleRecord {
  id: string; // e.g. "S-1042"
  timestamp: string; // ISO string
  items: SaleLineItem[];
  subtotal: number;
  discount: number;
  grandTotal: number;
  paymentMethod: 'Cash' | 'UPI';
}

export interface ApiSaleItem {
  id: number;
  saleId: number;
  productId: number | null;
  productName: string;
  unitType: string;
  qty: number;
  price: number;
  unitPrice?: number;
  cost: number;
  unitCost?: number;
  lineTotal: number;
}

export interface ApiSale {
  id: number;
  saleNo?: string;
  number: string;
  paymentMethod: 'Cash' | 'UPI';
  totalAmount?: number;
  total: number;
  soldAt?: string;
  createdAt: string;
  items: ApiSaleItem[];
}

export interface ApiSaleSummary {
  id: number;
  saleNo?: string;
  number: string;
  paymentMethod: 'Cash' | 'UPI';
  totalAmount?: number;
  total: number;
  date?: string;
  soldAt?: string;
  createdAt: string;
  itemCount: number;
}

export interface PurchaseLineItem {
  productId: number;
  name: string;
  unit: string;
  qty: number;
  cost: number;
  total: number;
}

export interface PurchaseRecord {
  id: string; // e.g. "P-109"
  timestamp: string; // ISO string
  items: PurchaseLineItem[];
  grandTotal: number;
  paymentMethod: 'Cash' | 'UPI';
  note?: string;
}

export interface ApiPurchaseItem {
  id: number;
  purchaseId: number;
  productId: number | null;
  productName: string;
  unitType: string;
  qty: number;
  unitCost?: number;
  cost: number;
  totalCost?: number;
  lineTotal: number;
}

export interface ApiPurchase {
  id: number;
  purchaseNo?: string;
  number: string;
  paymentMethod: 'Cash' | 'UPI';
  note?: string | null;
  totalCost?: number;
  total: number;
  purchasedAt?: string;
  createdAt: string;
  items: ApiPurchaseItem[];
}

export interface ApiPurchaseSummary {
  id: number;
  purchaseNo?: string;
  number: string;
  paymentMethod: 'Cash' | 'UPI';
  note?: string | null;
  totalCost?: number;
  total: number;
  date?: string;
  purchasedAt?: string;
  createdAt: string;
  itemCount: number;
}

export type FinanceType = 'income' | 'expense';

export const EXPENSE_CATEGORIES = [
  'Printing',
  'Packaging',
  'Transport',
  'Rent',
  'Utilities',
  'Marketing',
  'Other'
] as const;

export const INCOME_CATEGORIES = [
  'Other income'
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
export type IncomeCategory = typeof INCOME_CATEGORIES[number];

export interface ApiFinanceRecord {
  id: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  recordDate: string; // YYYY-MM-DD
  date?: string;
  paymentMethod: 'Cash' | 'UPI';
  note?: string;
  createdAt: string;
}

export interface FinanceRecord {
  id: string; // e.g. "FIN-1001" or numeric
  timestamp: string;
  type: FinanceType;
  category: string;
  description: string;
  amount: number;
  paymentMethod: 'Cash' | 'UPI';
  referenceType?: 'sale' | 'purchase' | 'manual';
  referenceId?: string;
}

export interface ReportSummary {
  salesRevenue: number;
  otherIncome: number;
  moneyIn: number;
  expenses: number;
  purchases: number;
  moneyOut: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
}

export interface ExpenseCategoryTotal {
  category: string;
  amount: number;
  previousAmount?: number;
  changeAmount?: number;
  changePercent?: number | null;
}

export interface MetricChange {
  current: number;
  previous: number;
  changeAmount: number;
  changePercent: number | null;
}

export interface PnlReport extends ReportSummary {
  summary: ReportSummary;
  previousSummary: ReportSummary;
  expensesByCategory: ExpenseCategoryTotal[];
  marginPercent: number;
  previousMarginPercent: number;
  changes: Record<string, MetricChange>;
  currentRange: { from: string; to: string };
  previousRange: { from: string; to: string };
}

export interface ExpensesReport {
  totalExpenses: number;
  totalsByCategory: Array<{ category: string; amount: number }>;
  entries: ApiFinanceRecord[];
}

export interface TopSellingItem {
  name: string;
  unitType: string;
  qty: number;
  revenue: number;
}

export interface StockLevelItem {
  name: string;
  unitType: string;
  qty: number;
  status: 'out' | 'low' | 'ok';
}

export interface ChartsReport {
  group: 'day' | 'month';
  incomeVsExpenses: Array<{ period: string; moneyIn: number; expenses: number }>;
  salesOverTime: Array<{ period: string; amount: number }>;
  purchasesOverTime: Array<{ period: string; amount: number }>;
  profitTrend: Array<{ period: string; netProfit: number }>;
  topSelling: TopSellingItem[];
  stockLevels: StockLevelItem[];
}

export interface StockMovement {
  id: string;
  timestamp: string;
  productId: number;
  productName: string;
  type: 'sale' | 'purchase' | 'adjustment';
  changeQty: number; // e.g. -2 or +10
  balanceAfter: number;
  referenceId?: string;
  note?: string;
  reason?: 'Correction' | 'Wastage' | 'Miscellaneous' | string;
}

export type PageId = 'inventory' | 'sales' | 'purchases' | 'finances';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

export type DatePreset = 'this-month' | 'last-month' | 'this-quarter' | 'this-year' | 'custom';

// Registers types (CR-002)
export type ExpenseRegisterSource = 'expense' | 'purchase';
export type IncomeRegisterSource = 'sale' | 'other';

export interface ExpenseRegisterItem {
  id: number;
  source: ExpenseRegisterSource;
  date: string;
  reference: string | null;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  deletable: boolean;
}

export interface ExpenseRegisterTotals {
  expensesTotal: number;
  purchasesTotal: number;
  moneyOutTotal: number;
  count: number;
}

export interface ExpenseRegisterResponse extends ExpenseRegisterTotals {
  entries: ExpenseRegisterItem[];
  totals: ExpenseRegisterTotals;
}

export interface IncomeRegisterItem {
  id: number;
  source: IncomeRegisterSource;
  date: string;
  reference: string | null;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  deletable: boolean;
}

export interface IncomeRegisterTotals {
  salesTotal: number;
  otherIncomeTotal: number;
  moneyInTotal: number;
  count: number;
}

export interface IncomeRegisterResponse extends IncomeRegisterTotals {
  entries: IncomeRegisterItem[];
  totals: IncomeRegisterTotals;
}

