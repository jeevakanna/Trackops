import React, { useState, useEffect, useCallback } from 'react';
import {
  DatePreset,
  PnlReport,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ExpenseRegisterItem,
  ExpenseRegisterTotals,
  IncomeRegisterItem,
  IncomeRegisterTotals
} from '../types';
import { formatINR, formatDate } from '../utils/formatters';
import {
  createFinanceRecord,
  getPnlReport,
  deleteFinanceRecord,
  getExpenseRegister,
  getIncomeRegister
} from '../services/api';
import {
  exportPnlReportToExcel,
  exportPnlReportToPDF,
  exportExpenseRegisterToExcel,
  exportExpenseRegisterToPDF,
  exportIncomeRegisterToExcel,
  exportIncomeRegisterToPDF
} from '../services/exportService';
import { getDateStringsForPreset } from '../utils/accounting';

interface FinancesPageProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

interface DeletableEntry {
  id: number;
  source: string;
  category: string;
  amount: number;
  date: string;
}

export const FinancesPage: React.FC<FinancesPageProps> = ({ onShowToast }) => {
  // Preset & Date Range (single range controls everything on the page)
  const [datePreset, setDatePreset] = useState<DatePreset>('this-month');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  // Registers Tab: Expense register or Income register
  const [activeRegisterTab, setActiveRegisterTab] = useState<'expense' | 'income'>('expense');

  // Filter chips and search for Expense Register
  const [expenseSourceFilter, setExpenseSourceFilter] = useState<'all' | 'expense' | 'purchase'>('all');
  const [expenseSearch, setExpenseSearch] = useState('');

  // Filter chips and search for Income Register
  const [incomeSourceFilter, setIncomeSourceFilter] = useState<'all' | 'sale' | 'other'>('all');
  const [incomeSearch, setIncomeSearch] = useState('');

  // Data states
  const [pnlReport, setPnlReport] = useState<PnlReport | null>(null);
  const [expenseItems, setExpenseItems] = useState<ExpenseRegisterItem[]>([]);
  const [expenseTotals, setExpenseTotals] = useState<ExpenseRegisterTotals>({
    expensesTotal: 0,
    purchasesTotal: 0,
    moneyOutTotal: 0,
    count: 0
  });

  const [incomeItems, setIncomeItems] = useState<IncomeRegisterItem[]>([]);
  const [incomeTotals, setIncomeTotals] = useState<IncomeRegisterTotals>({
    salesTotal: 0,
    otherIncomeTotal: 0,
    moneyInTotal: 0,
    count: 0
  });

  // Loading & error states
  const [isLoadingPnl, setIsLoadingPnl] = useState(true);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
  const [isLoadingIncome, setIsLoadingIncome] = useState(true);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [pnlError, setPnlError] = useState<string | null>(null);

  // Modal State for Add Expense / Add Income
  const [modalType, setModalType] = useState<'expense' | 'income' | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Printing');
  const [recordDate, setRecordDate] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  );
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI'>('Cash');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation Modal (for manual entries only)
  const [entryToDelete, setEntryToDelete] = useState<DeletableEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Compute active date range in Asia/Kolkata
  const dateRange = getDateStringsForPreset(datePreset, customStart, customEnd);

  // Load P&L summary report
  const loadPnl = useCallback(async () => {
    setIsLoadingPnl(true);
    setPnlError(null);
    try {
      const pnl = await getPnlReport(dateRange.from, dateRange.to);
      setPnlReport(pnl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load P&L statement';
      setPnlError(msg);
    } finally {
      setIsLoadingPnl(false);
    }
  }, [dateRange.from, dateRange.to]);

  // Load Expense Register
  const loadExpenses = useCallback(async () => {
    setIsLoadingExpenses(true);
    setExpenseError(null);
    try {
      const res = await getExpenseRegister({
        from: dateRange.from,
        to: dateRange.to,
        source: expenseSourceFilter !== 'all' ? expenseSourceFilter : undefined,
        search: expenseSearch.trim() || undefined
      });
      setExpenseItems(res.entries);
      setExpenseTotals(res.totals);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load expense register';
      setExpenseError(msg);
    } finally {
      setIsLoadingExpenses(false);
    }
  }, [dateRange.from, dateRange.to, expenseSourceFilter, expenseSearch]);

  // Load Income Register
  const loadIncome = useCallback(async () => {
    setIsLoadingIncome(true);
    setIncomeError(null);
    try {
      const res = await getIncomeRegister({
        from: dateRange.from,
        to: dateRange.to,
        source: incomeSourceFilter !== 'all' ? incomeSourceFilter : undefined,
        search: incomeSearch.trim() || undefined
      });
      setIncomeItems(res.entries);
      setIncomeTotals(res.totals);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load income register';
      setIncomeError(msg);
    } finally {
      setIsLoadingIncome(false);
    }
  }, [dateRange.from, dateRange.to, incomeSourceFilter, incomeSearch]);

  // Refresh all sections
  const refreshAll = useCallback(() => {
    loadPnl();
    loadExpenses();
    loadIncome();
  }, [loadPnl, loadExpenses, loadIncome]);

  useEffect(() => {
    loadPnl();
  }, [loadPnl]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    loadIncome();
  }, [loadIncome]);

  // Cross-page sync listener
  useEffect(() => {
    const handleUpdate = () => refreshAll();
    window.addEventListener('trackops:data_updated', handleUpdate);
    return () => window.removeEventListener('trackops:data_updated', handleUpdate);
  }, [refreshAll]);

  // Open modal handler
  const handleOpenModal = (type: 'expense' | 'income') => {
    setModalType(type);
    setAmount('');
    setCategory(type === 'expense' ? 'Printing' : 'Other income');
    setRecordDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
    setPaymentMethod('Cash');
    setNote('');
    setFormError(null);
  };

  const handleCloseModal = () => {
    setModalType(null);
    setFormError(null);
  };

  // Submit Add Expense / Add Income
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid amount greater than 0');
      return;
    }

    if (note.length > 200) {
      setFormError('Note must be at most 200 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      await createFinanceRecord({
        type: modalType!,
        category,
        amount: numAmount,
        recordDate,
        paymentMethod,
        note: note.trim() || undefined
      });

      onShowToast(
        modalType === 'expense' ? 'Expense Saved' : 'Income Saved',
        `Added ${formatINR(numAmount)} under ${category}`,
        'success'
      );
      handleCloseModal();
      refreshAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save record';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Entry
  const confirmDeleteEntry = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    try {
      await deleteFinanceRecord(entryToDelete.id);
      onShowToast(
        entryToDelete.source === 'other' ? 'Income Deleted' : 'Expense Deleted',
        `Removed ${formatINR(entryToDelete.amount)} (${entryToDelete.category})`,
        'info'
      );
      setEntryToDelete(null);
      refreshAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not delete entry';
      onShowToast('Delete failed', msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export handlers
  const handleExportRegisterExcel = () => {
    if (activeRegisterTab === 'expense') {
      exportExpenseRegisterToExcel(expenseItems, expenseTotals, dateRange.label);
      onShowToast('Excel Exported', 'Expense register spreadsheet downloaded', 'success');
    } else {
      exportIncomeRegisterToExcel(incomeItems, incomeTotals, dateRange.label);
      onShowToast('Excel Exported', 'Income register spreadsheet downloaded', 'success');
    }
  };

  const handleExportRegisterPDF = () => {
    if (activeRegisterTab === 'expense') {
      exportExpenseRegisterToPDF(expenseItems, expenseTotals, dateRange.label);
      onShowToast('PDF Exported', 'Expense register document downloaded', 'success');
    } else {
      exportIncomeRegisterToPDF(incomeItems, incomeTotals, dateRange.label);
      onShowToast('PDF Exported', 'Income register document downloaded', 'success');
    }
  };

  const handleExportPnlExcel = () => {
    if (pnlReport) {
      exportPnlReportToExcel(pnlReport, dateRange.label);
      onShowToast('Excel Exported', 'Profit & Loss Statement spreadsheet downloaded', 'success');
    }
  };

  const handleExportPnlPDF = () => {
    if (pnlReport) {
      exportPnlReportToPDF(pnlReport, dateRange.label);
      onShowToast('PDF Exported', 'Profit & Loss Statement document downloaded', 'success');
    }
  };

  // Format metric change with direction text & arrow for accessibility
  const renderComparisonPill = (
    changeAmount: number | undefined,
    changePercent: number | null | undefined,
    isExpenseOrCost = false
  ) => {
    if (changeAmount === undefined || changeAmount === null) {
      return <span className="text-xs text-on-surface-variant font-medium">—</span>;
    }

    if (changeAmount === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant font-medium">
          <span>—</span>
          <span>No change</span>
        </span>
      );
    }

    const isPositive = changeAmount > 0;
    const isGood = isExpenseOrCost ? !isPositive : isPositive;
    const arrow = isPositive ? '▲' : '▼';
    const directionWord = isPositive ? 'Up' : 'Down';
    const sign = isPositive ? '+' : '';
    const pctStr = changePercent !== null && changePercent !== undefined
      ? ` (${sign}${changePercent.toFixed(1)}%)`
      : '';

    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
          isGood
            ? 'bg-secondary/15 text-secondary border border-secondary/25'
            : 'bg-error/15 text-error border border-error/25'
        }`}
        title={`Difference vs prior period of equal length: ${sign}${formatINR(changeAmount)}${pctStr}`}
      >
        <span aria-hidden="true">{arrow}</span>
        <span>
          {directionWord} {sign}{formatINR(changeAmount)}{pctStr}
        </span>
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-space-lg pb-16">
      {/* ==================================================================== */}
      {/* 1. TOP HEADER & PRIMARY ACTIONS (Keep Add Expense, Add Income as-is)  */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-container-low">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Finances</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
            Record operational outflows, miscellaneous income, and track cashflow registers &amp; financial performance.
          </p>
        </div>

        {/* Action Buttons: Add Expense & Add Income */}
        <div className="flex items-center gap-3">
          <button
            id="btn-add-expense"
            type="button"
            onClick={() => handleOpenModal('expense')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-error hover:bg-error/90 active:scale-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">remove_circle</span>
            <span>Add Expense</span>
          </button>

          <button
            id="btn-add-income"
            type="button"
            onClick={() => handleOpenModal('income')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-secondary hover:bg-secondary/90 active:scale-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Add Income</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. SHARED DATE RANGE SELECTOR                                        */}
      {/* ==================================================================== */}
      <div className="bg-surface-container-lowest p-4 rounded-xl shadow-xs border border-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(['this-month', 'last-month', 'this-quarter', 'this-year', 'custom'] as DatePreset[]).map((p) => {
            const labels: Record<DatePreset, string> = {
              'this-month': 'This Month',
              'last-month': 'Last Month',
              'this-quarter': 'This Quarter',
              'this-year': 'This Year',
              'custom': 'Custom Range'
            };
            const isSelected = datePreset === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setDatePreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>

        {/* Custom Date Pickers */}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-on-surface-variant">
              <span>From:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1 bg-surface border border-surface-container rounded text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-1 text-xs text-on-surface-variant">
              <span>To:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1 bg-surface border border-surface-container rounded text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {/* Selected Period Label Display */}
        <div className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-primary">calendar_today</span>
          <span>{dateRange.label}</span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. TOTALS CARDS (Money In, Money Out, Net Profit)                    */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Money In */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-low shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-semibold mb-2">
            <span>Money In</span>
            <div className="w-7 h-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-on-surface">
            {isLoadingPnl ? (
              <div className="h-8 bg-surface-container-low animate-pulse rounded w-24"></div>
            ) : (
              formatINR(pnlReport?.moneyIn || 0)
            )}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1.5 flex items-center justify-between">
            <span>Sales Revenue + Other Income</span>
            {pnlReport && renderComparisonPill(pnlReport.changes?.moneyIn?.changeAmount, pnlReport.changes?.moneyIn?.changePercent)}
          </div>
        </div>

        {/* Money Out */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-low shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-semibold mb-2">
            <span>Money Out</span>
            <div className="w-7 h-7 rounded-lg bg-error/10 text-error flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">trending_down</span>
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-on-surface">
            {isLoadingPnl ? (
              <div className="h-8 bg-surface-container-low animate-pulse rounded w-24"></div>
            ) : (
              formatINR(pnlReport?.moneyOut || 0)
            )}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1.5 flex items-center justify-between">
            <span>Operating Exp. + Purchases</span>
            {pnlReport && renderComparisonPill(pnlReport.changes?.moneyOut?.changeAmount, pnlReport.changes?.moneyOut?.changePercent, true)}
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-low shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-semibold mb-2">
            <span>Net Profit</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              (pnlReport?.netProfit || 0) >= 0 ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'
            }`}>
              <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            </div>
          </div>
          <div className={`text-2xl font-bold tracking-tight ${
            (pnlReport?.netProfit || 0) >= 0 ? 'text-secondary' : 'text-error'
          }`}>
            {isLoadingPnl ? (
              <div className="h-8 bg-surface-container-low animate-pulse rounded w-24"></div>
            ) : (
              formatINR(pnlReport?.netProfit || 0)
            )}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1.5 flex items-center justify-between">
            <span>Margin: {pnlReport ? `${pnlReport.marginPercent.toFixed(1)}%` : '0%'}</span>
            {pnlReport && renderComparisonPill(pnlReport.changes?.netProfit?.changeAmount, pnlReport.changes?.netProfit?.changePercent)}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. TWO REGISTERS SECTION (Expense register & Income register tabs)   */}
      {/* ==================================================================== */}
      <div className="bg-surface-container-lowest rounded-xl border border-surface-container-low shadow-xs overflow-hidden">
        {/* Navigation Tabs & Export Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-container-low px-4 pt-3 pb-2 gap-3 bg-surface-container-low/30">
          <div className="flex items-center gap-2">
            <button
              id="tab-expense-register"
              type="button"
              onClick={() => setActiveRegisterTab('expense')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeRegisterTab === 'expense'
                  ? 'bg-surface-container-lowest text-primary shadow-xs font-bold border border-surface-container-low'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">outbox</span>
              <span>Expense register</span>
              <span className="ml-1 px-1.5 py-0.2 bg-surface-container text-on-surface text-[10px] rounded-full">
                {expenseTotals.count}
              </span>
            </button>

            <button
              id="tab-income-register"
              type="button"
              onClick={() => setActiveRegisterTab('income')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeRegisterTab === 'income'
                  ? 'bg-surface-container-lowest text-primary shadow-xs font-bold border border-surface-container-low'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">move_to_inbox</span>
              <span>Income register</span>
              <span className="ml-1 px-1.5 py-0.2 bg-surface-container text-on-surface text-[10px] rounded-full">
                {incomeTotals.count}
              </span>
            </button>
          </div>

          {/* Export Actions for Active Register */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleExportRegisterPDF}
              disabled={activeRegisterTab === 'expense' ? (isLoadingExpenses || expenseItems.length === 0) : (isLoadingIncome || incomeItems.length === 0)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded text-xs font-medium text-on-surface transition-colors disabled:opacity-50"
              title="Export Register to PDF document"
            >
              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportRegisterExcel}
              disabled={activeRegisterTab === 'expense' ? (isLoadingExpenses || expenseItems.length === 0) : (isLoadingIncome || incomeItems.length === 0)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded text-xs font-medium text-on-surface transition-colors disabled:opacity-50"
              title="Export Register to Excel spreadsheet"
            >
              <span className="material-symbols-outlined text-[16px]">table_view</span>
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 flex flex-col gap-5">
          {/* ---------------------------------------------------------------- */}
          {/* TAB 1: EXPENSE REGISTER                                         */}
          {/* ---------------------------------------------------------------- */}
          {activeRegisterTab === 'expense' && (
            <div className="flex flex-col gap-4">
              {/* Controls: Filter chips + Search input */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Source Filter Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['all', 'expense', 'purchase'] as const).map((source) => {
                    const labels = {
                      all: 'All',
                      expense: 'Expenses',
                      purchase: 'Purchases'
                    };
                    const isSelected = expenseSourceFilter === source;
                    return (
                      <button
                        key={source}
                        type="button"
                        onClick={() => setExpenseSourceFilter(source)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-error text-white shadow-xs'
                            : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        {labels[source]}
                      </button>
                    );
                  })}
                </div>

                {/* Search Box */}
                <div className="relative w-full sm:w-64">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search category, note, voucher #..."
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-7 bg-surface border border-surface-container text-on-surface text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {expenseSearch && (
                    <button
                      type="button"
                      onClick={() => setExpenseSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Totals Summary Row / Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-surface-container-low/60 rounded-xl border border-surface-container-low text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant font-medium">Expenses:</span>
                  <span className="font-bold text-error">{formatINR(expenseTotals.expensesTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant font-medium">Purchases:</span>
                  <span className="font-bold text-error">{formatINR(expenseTotals.purchasesTotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t sm:border-t-0 sm:border-l sm:pl-3 border-surface-container">
                  <span className="text-on-surface font-semibold">Money out:</span>
                  <span className="font-extrabold text-error text-sm">{formatINR(expenseTotals.moneyOutTotal)}</span>
                </div>
              </div>

              {/* Data State: Loading Skeleton */}
              {isLoadingExpenses ? (
                <div className="flex flex-col gap-3 py-6">
                  <div className="h-8 bg-surface-container-low animate-pulse rounded w-full"></div>
                  <div className="h-10 bg-surface-container-low animate-pulse rounded w-full"></div>
                  <div className="h-10 bg-surface-container-low animate-pulse rounded w-full"></div>
                </div>
              ) : expenseError ? (
                <div className="text-center py-10 text-error flex flex-col items-center">
                  <span className="material-symbols-outlined text-4xl mb-2">error</span>
                  <p className="font-semibold text-sm">{expenseError}</p>
                  <button
                    type="button"
                    onClick={loadExpenses}
                    className="mt-3 px-3.5 py-1.5 bg-primary text-on-primary text-xs rounded-lg font-semibold"
                  >
                    Retry
                  </button>
                </div>
              ) : expenseItems.length === 0 ? (
                /* Empty state with one clear action */
                <div className="text-center py-12 flex flex-col items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-50">receipt_long</span>
                  <p className="font-semibold text-sm">No expenses in this period</p>
                  <p className="text-xs text-on-surface-variant/80 mt-1 max-w-sm">
                    {expenseSearch
                      ? 'No matching expenses or purchases found for your search.'
                      : 'Operating expenses and stock purchases recorded in this range will appear here.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenModal('expense')}
                    className="mt-4 px-4 py-2 bg-error text-white text-xs font-semibold rounded-lg hover:bg-error/90 shadow-sm transition-all"
                  >
                    Add expense
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-surface-container-low text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Reference</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3">Payment</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-low">
                        {expenseItems.map((entry) => (
                          <tr key={`${entry.source}-${entry.id}`} className="hover:bg-surface-container-low/40 transition-colors">
                            <td className="py-3 px-3 font-medium text-on-surface whitespace-nowrap">
                              {formatDate(entry.date)}
                            </td>
                            <td className="py-3 px-3">
                              {/* Source shown as a text label, not by color alone */}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                                entry.source === 'expense'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25'
                                  : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25'
                              }`}>
                                <span className="material-symbols-outlined text-[13px]">
                                  {entry.source === 'expense' ? 'receipt' : 'shopping_bag'}
                                </span>
                                <span>{entry.source === 'expense' ? 'Expense' : 'Purchase'}</span>
                              </span>
                            </td>
                            <td className="py-3 px-3 text-xs font-mono text-on-surface-variant">
                              {entry.reference ? (
                                <span className="font-semibold text-on-surface">{entry.reference}</span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-container text-on-surface">
                                {entry.category}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-on-surface-variant text-xs max-w-xs truncate" title={entry.description}>
                              {entry.description || '—'}
                            </td>
                            <td className="py-3 px-3 text-xs text-on-surface-variant">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                                <span>{entry.paymentMethod}</span>
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-error whitespace-nowrap">
                              {formatINR(entry.amount)}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {entry.deletable ? (
                                <button
                                  type="button"
                                  onClick={() => setEntryToDelete({
                                    id: entry.id,
                                    source: entry.source,
                                    category: entry.category,
                                    amount: entry.amount,
                                    date: entry.date
                                  })}
                                  className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                                  title={`Delete expense (${entry.category})`}
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              ) : (
                                <a
                                  href="#purchases"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 hover:underline"
                                  title={`Open ${entry.reference} on Purchases page`}
                                >
                                  <span>View purchase</span>
                                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-surface-container-low/40 border-t-2 border-surface-container font-semibold text-xs text-on-surface">
                          <td colSpan={6} className="py-3 px-3">
                            Totals: Expenses {formatINR(expenseTotals.expensesTotal)}, Purchases {formatINR(expenseTotals.purchasesTotal)}
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold text-error whitespace-nowrap">
                            {formatINR(expenseTotals.moneyOutTotal)}
                          </td>
                          <td className="py-3 px-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Mobile Cards View (no horizontal scroll at 375px) */}
                  <div className="md:hidden flex flex-col gap-3">
                    {expenseItems.map((entry) => (
                      <div
                        key={`${entry.source}-${entry.id}`}
                        className="bg-surface p-3.5 rounded-xl border border-surface-container-low shadow-2xs flex flex-col gap-2.5"
                      >
                        {/* Top row: Date, Type, Reference */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-on-surface">{formatDate(entry.date)}</span>
                            {entry.reference && (
                              <span className="font-mono font-bold text-xs bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
                                #{entry.reference}
                              </span>
                            )}
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            entry.source === 'expense'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25'
                              : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25'
                          }`}>
                            <span className="material-symbols-outlined text-[12px]">
                              {entry.source === 'expense' ? 'receipt' : 'shopping_bag'}
                            </span>
                            <span>{entry.source === 'expense' ? 'Expense' : 'Purchase'}</span>
                          </span>
                        </div>

                        {/* Middle row: Category & Description */}
                        <div>
                          <div className="text-xs font-semibold text-on-surface">
                            {entry.category}
                          </div>
                          {entry.description && (
                            <div className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">
                              {entry.description}
                            </div>
                          )}
                        </div>

                        {/* Bottom row: Payment, Amount & Action */}
                        <div className="flex items-center justify-between pt-2 border-t border-surface-container-low">
                          <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                            <span>{entry.paymentMethod}</span>
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-error text-sm">
                              {formatINR(entry.amount)}
                            </span>
                            {entry.deletable ? (
                              <button
                                type="button"
                                onClick={() => setEntryToDelete({
                                  id: entry.id,
                                  source: entry.source,
                                  category: entry.category,
                                  amount: entry.amount,
                                  date: entry.date
                                })}
                                className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error/10"
                                title="Delete expense"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            ) : (
                              <a
                                href="#purchases"
                                className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary"
                              >
                                <span>View</span>
                                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 2: INCOME REGISTER                                          */}
          {/* ---------------------------------------------------------------- */}
          {activeRegisterTab === 'income' && (
            <div className="flex flex-col gap-4">
              {/* Controls: Filter chips + Search input */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Source Filter Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['all', 'sale', 'other'] as const).map((source) => {
                    const labels = {
                      all: 'All',
                      sale: 'Sales',
                      other: 'Other income'
                    };
                    const isSelected = incomeSourceFilter === source;
                    return (
                      <button
                        key={source}
                        type="button"
                        onClick={() => setIncomeSourceFilter(source)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-secondary text-white shadow-xs'
                            : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        {labels[source]}
                      </button>
                    );
                  })}
                </div>

                {/* Search Box */}
                <div className="relative w-full sm:w-64">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search category, note, bill #..."
                    value={incomeSearch}
                    onChange={(e) => setIncomeSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-7 bg-surface border border-surface-container text-on-surface text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {incomeSearch && (
                    <button
                      type="button"
                      onClick={() => setIncomeSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Totals Summary Row / Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-surface-container-low/60 rounded-xl border border-surface-container-low text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant font-medium">Sales:</span>
                  <span className="font-bold text-secondary">{formatINR(incomeTotals.salesTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant font-medium">Other income:</span>
                  <span className="font-bold text-secondary">{formatINR(incomeTotals.otherIncomeTotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t sm:border-t-0 sm:border-l sm:pl-3 border-surface-container">
                  <span className="text-on-surface font-semibold">Money in:</span>
                  <span className="font-extrabold text-secondary text-sm">{formatINR(incomeTotals.moneyInTotal)}</span>
                </div>
              </div>

              {/* Data State: Loading Skeleton */}
              {isLoadingIncome ? (
                <div className="flex flex-col gap-3 py-6">
                  <div className="h-8 bg-surface-container-low animate-pulse rounded w-full"></div>
                  <div className="h-10 bg-surface-container-low animate-pulse rounded w-full"></div>
                  <div className="h-10 bg-surface-container-low animate-pulse rounded w-full"></div>
                </div>
              ) : incomeError ? (
                <div className="text-center py-10 text-error flex flex-col items-center">
                  <span className="material-symbols-outlined text-4xl mb-2">error</span>
                  <p className="font-semibold text-sm">{incomeError}</p>
                  <button
                    type="button"
                    onClick={loadIncome}
                    className="mt-3 px-3.5 py-1.5 bg-primary text-on-primary text-xs rounded-lg font-semibold"
                  >
                    Retry
                  </button>
                </div>
              ) : incomeItems.length === 0 ? (
                /* Empty state with one clear action */
                <div className="text-center py-12 flex flex-col items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-50">move_to_inbox</span>
                  <p className="font-semibold text-sm">No income in this period</p>
                  <p className="text-xs text-on-surface-variant/80 mt-1 max-w-sm">
                    {incomeSearch
                      ? 'No matching sales or other income entries found for your search.'
                      : 'Sales revenue and miscellaneous income recorded in this range will appear here.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenModal('income')}
                    className="mt-4 px-4 py-2 bg-secondary text-white text-xs font-semibold rounded-lg hover:bg-secondary/90 shadow-sm transition-all"
                  >
                    Add income
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-surface-container-low text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Reference</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3">Payment</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-low">
                        {incomeItems.map((entry) => (
                          <tr key={`${entry.source}-${entry.id}`} className="hover:bg-surface-container-low/40 transition-colors">
                            <td className="py-3 px-3 font-medium text-on-surface whitespace-nowrap">
                              {formatDate(entry.date)}
                            </td>
                            <td className="py-3 px-3">
                              {/* Source shown as a text label, not by color alone */}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                                entry.source === 'sale'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25'
                                  : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/25'
                              }`}>
                                <span className="material-symbols-outlined text-[13px]">
                                  {entry.source === 'sale' ? 'point_of_sale' : 'savings'}
                                </span>
                                <span>{entry.source === 'sale' ? 'Sale' : 'Other income'}</span>
                              </span>
                            </td>
                            <td className="py-3 px-3 text-xs font-mono text-on-surface-variant">
                              {entry.reference ? (
                                <span className="font-semibold text-on-surface">{entry.reference}</span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-container text-on-surface">
                                {entry.category}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-on-surface-variant text-xs max-w-xs truncate" title={entry.description}>
                              {entry.description || '—'}
                            </td>
                            <td className="py-3 px-3 text-xs text-on-surface-variant">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                                <span>{entry.paymentMethod}</span>
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-secondary whitespace-nowrap">
                              {formatINR(entry.amount)}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {entry.deletable ? (
                                <button
                                  type="button"
                                  onClick={() => setEntryToDelete({
                                    id: entry.id,
                                    source: entry.source,
                                    category: entry.category,
                                    amount: entry.amount,
                                    date: entry.date
                                  })}
                                  className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                                  title={`Delete other income (${entry.category})`}
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              ) : (
                                <a
                                  href="#sales"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 hover:underline"
                                  title={`Open ${entry.reference} on Sales page`}
                                >
                                  <span>View sale</span>
                                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-surface-container-low/40 border-t-2 border-surface-container font-semibold text-xs text-on-surface">
                          <td colSpan={6} className="py-3 px-3">
                            Totals: Sales {formatINR(incomeTotals.salesTotal)}, Other income {formatINR(incomeTotals.otherIncomeTotal)}
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold text-secondary whitespace-nowrap">
                            {formatINR(incomeTotals.moneyInTotal)}
                          </td>
                          <td className="py-3 px-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Mobile Cards View (no horizontal scroll at 375px) */}
                  <div className="md:hidden flex flex-col gap-3">
                    {incomeItems.map((entry) => (
                      <div
                        key={`${entry.source}-${entry.id}`}
                        className="bg-surface p-3.5 rounded-xl border border-surface-container-low shadow-2xs flex flex-col gap-2.5"
                      >
                        {/* Top row: Date, Type, Reference */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-on-surface">{formatDate(entry.date)}</span>
                            {entry.reference && (
                              <span className="font-mono font-bold text-xs bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
                                #{entry.reference}
                              </span>
                            )}
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            entry.source === 'sale'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25'
                              : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/25'
                          }`}>
                            <span className="material-symbols-outlined text-[12px]">
                              {entry.source === 'sale' ? 'point_of_sale' : 'savings'}
                            </span>
                            <span>{entry.source === 'sale' ? 'Sale' : 'Other income'}</span>
                          </span>
                        </div>

                        {/* Middle row: Category & Description */}
                        <div>
                          <div className="text-xs font-semibold text-on-surface">
                            {entry.category}
                          </div>
                          {entry.description && (
                            <div className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">
                              {entry.description}
                            </div>
                          )}
                        </div>

                        {/* Bottom row: Payment, Amount & Action */}
                        <div className="flex items-center justify-between pt-2 border-t border-surface-container-low">
                          <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                            <span>{entry.paymentMethod}</span>
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-secondary text-sm">
                              {formatINR(entry.amount)}
                            </span>
                            {entry.deletable ? (
                              <button
                                type="button"
                                onClick={() => setEntryToDelete({
                                  id: entry.id,
                                  source: entry.source,
                                  category: entry.category,
                                  amount: entry.amount,
                                  date: entry.date
                                })}
                                className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error/10"
                                title="Delete income"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            ) : (
                              <a
                                href="#sales"
                                className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary"
                              >
                                <span>View</span>
                                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 5. REPORT SECTION: PROFIT & LOSS STATEMENT (Kept as it is)           */}
      {/* ==================================================================== */}
      <div className="bg-surface-container-lowest rounded-xl border border-surface-container-low shadow-xs overflow-hidden">
        {/* Section Header with Export Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-container-low px-4 pt-3.5 pb-3 gap-3 bg-surface-container-low/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">stacked_line_chart</span>
            <div>
              <h2 className="text-sm font-bold text-on-surface">Profit &amp; Loss Statement</h2>
              <p className="text-[11px] text-on-surface-variant">
                Full statement showing Gross Revenue, Cost of Goods Sold, and Operating Expenses.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleExportPnlPDF}
              disabled={isLoadingPnl || !pnlReport}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded text-xs font-medium text-on-surface transition-colors disabled:opacity-50"
              title="Export P&L Report to PDF"
            >
              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportPnlExcel}
              disabled={isLoadingPnl || !pnlReport}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded text-xs font-medium text-on-surface transition-colors disabled:opacity-50"
              title="Export P&L Report to Excel Spreadsheet"
            >
              <span className="material-symbols-outlined text-[16px]">table_view</span>
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6">
          {isLoadingPnl ? (
            <div className="flex flex-col gap-3 py-6">
              <div className="h-6 bg-surface-container-low animate-pulse rounded w-1/3"></div>
              <div className="h-10 bg-surface-container-low animate-pulse rounded"></div>
              <div className="h-10 bg-surface-container-low animate-pulse rounded"></div>
            </div>
          ) : pnlError ? (
            <div className="text-center py-8 text-error flex flex-col items-center">
              <span className="material-symbols-outlined text-4xl mb-2">error</span>
              <p className="font-semibold text-sm">{pnlError}</p>
              <button
                type="button"
                onClick={loadPnl}
                className="mt-3 px-3 py-1.5 bg-primary text-on-primary text-xs rounded-lg font-semibold"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-surface-container-low text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    <th className="py-3 px-3">Line Item</th>
                    <th className="py-3 px-3 text-right">Current Period</th>
                    <th className="py-3 px-3 text-right">Prior Period</th>
                    <th className="py-3 px-3 text-right">Period Comparison</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {/* Revenue */}
                  <tr className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-on-surface flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-secondary"></span>
                      <span>Sales Revenue</span>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-on-surface">
                      {formatINR(pnlReport?.salesRevenue || 0)}
                    </td>
                    <td className="py-3 px-3 text-right text-on-surface-variant">
                      {formatINR(pnlReport?.previousSummary?.salesRevenue || 0)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {renderComparisonPill(
                        pnlReport?.changes?.salesRevenue?.changeAmount,
                        pnlReport?.changes?.salesRevenue?.changePercent
                      )}
                    </td>
                  </tr>

                  {/* COGS */}
                  <tr className="hover:bg-surface-container-low/40 transition-colors text-on-surface-variant">
                    <td className="py-3 px-3 pl-6">
                      Less: Cost of Goods Sold (COGS)
                      <span className="text-[11px] text-on-surface-variant/75 block">
                        Direct stock cost of items sold in this period
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-error">
                      -{formatINR(pnlReport?.cogs || 0)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      -{formatINR(pnlReport?.previousSummary?.cogs || 0)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {renderComparisonPill(
                        pnlReport?.changes?.cogs?.changeAmount,
                        pnlReport?.changes?.cogs?.changePercent,
                        true
                      )}
                    </td>
                  </tr>

                  {/* Gross Profit */}
                  <tr className="bg-surface-container-low/20 font-semibold text-on-surface">
                    <td className="py-3 px-3">Gross Profit</td>
                    <td className="py-3 px-3 text-right">
                      {formatINR(pnlReport?.grossProfit || 0)}
                    </td>
                    <td className="py-3 px-3 text-right text-on-surface-variant font-normal">
                      {formatINR(pnlReport?.previousSummary?.grossProfit || 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-normal">
                      {renderComparisonPill(
                        pnlReport?.changes?.grossProfit?.changeAmount,
                        pnlReport?.changes?.grossProfit?.changePercent
                      )}
                    </td>
                  </tr>

                  {/* Other Income */}
                  <tr className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-on-surface flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-secondary"></span>
                      <span>Other Income</span>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-on-surface">
                      {formatINR(pnlReport?.otherIncome || 0)}
                    </td>
                    <td className="py-3 px-3 text-right text-on-surface-variant">
                      {formatINR(pnlReport?.previousSummary?.otherIncome || 0)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {renderComparisonPill(
                        pnlReport?.changes?.otherIncome?.changeAmount,
                        pnlReport?.changes?.otherIncome?.changePercent
                      )}
                    </td>
                  </tr>

                  {/* Operating Expenses Section Header */}
                  <tr className="bg-surface-container-low/10 text-xs font-semibold text-on-surface-variant">
                    <td colSpan={4} className="py-2.5 px-3 uppercase tracking-wider">
                      Operating Expenses by Category
                    </td>
                  </tr>

                  {/* Expense categories */}
                  {pnlReport?.expensesByCategory.map((cat) => (
                    <tr key={cat.category} className="hover:bg-surface-container-low/40 transition-colors text-xs">
                      <td className="py-2.5 px-3 pl-8 text-on-surface-variant">
                        • {cat.category}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-error">
                        {cat.amount > 0 ? `-${formatINR(cat.amount)}` : '₹0'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-on-surface-variant">
                        {cat.previousAmount && cat.previousAmount > 0 ? `-${formatINR(cat.previousAmount)}` : '₹0'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {renderComparisonPill(cat.changeAmount, cat.changePercent, true)}
                      </td>
                    </tr>
                  ))}

                  {/* Total Operating Expenses */}
                  <tr className="bg-surface-container-low/20 font-semibold text-on-surface">
                    <td className="py-3 px-3">Total Operating Expenses</td>
                    <td className="py-3 px-3 text-right text-error font-semibold">
                      -{formatINR(pnlReport?.expenses || 0)}
                    </td>
                    <td className="py-3 px-3 text-right text-on-surface-variant font-normal">
                      -{formatINR(pnlReport?.previousSummary?.expenses || 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-normal">
                      {renderComparisonPill(
                        pnlReport?.changes?.expenses?.changeAmount,
                        pnlReport?.changes?.expenses?.changePercent,
                        true
                      )}
                    </td>
                  </tr>

                  {/* Net Profit Summary Row */}
                  <tr className="border-t-2 border-primary/20 bg-primary/5 font-bold text-base text-on-surface">
                    <td className="py-4 px-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">verified</span>
                      <span>Net Profit</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant ml-2">
                        Margin: {pnlReport ? `${pnlReport.marginPercent.toFixed(1)}%` : '0%'}
                      </span>
                    </td>
                    <td className={`py-4 px-3 text-right ${
                      (pnlReport?.netProfit || 0) >= 0 ? 'text-secondary font-extrabold' : 'text-error font-extrabold'
                    }`}>
                      {formatINR(pnlReport?.netProfit || 0)}
                    </td>
                    <td className="py-4 px-3 text-right text-on-surface-variant font-normal text-sm">
                      {formatINR(pnlReport?.previousSummary?.netProfit || 0)}
                    </td>
                    <td className="py-4 px-3 text-right font-normal">
                      {renderComparisonPill(
                        pnlReport?.changes?.netProfit?.changeAmount,
                        pnlReport?.changes?.netProfit?.changePercent
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-4 p-3 bg-surface-container-low/50 rounded-lg text-xs text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">info</span>
                <span>
                  <strong>Accounting Rule:</strong> Purchases of stock are not an operating expense. They represent cash outflow for inventory; their cost reaches Net Profit solely through Cost of Goods Sold (COGS) when items are sold.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 6. ADD EXPENSE / ADD INCOME MODAL DIALOG                             */}
      {/* ==================================================================== */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container w-full max-w-md overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className={`px-6 py-4 flex items-center justify-between border-b ${
              modalType === 'expense'
                ? 'bg-error/10 border-error/20 text-error'
                : 'bg-secondary/10 border-secondary/20 text-secondary'
            }`}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px]">
                  {modalType === 'expense' ? 'receipt' : 'savings'}
                </span>
                <h2 className="font-bold text-base text-on-surface">
                  {modalType === 'expense' ? 'Add Operating Expense' : 'Add Other Income'}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-6 flex flex-col gap-5">
              {/* Error Notice */}
              {formError && (
                <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-error text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. AMOUNT FIRST */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Amount (₹) <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-on-surface-variant">
                    ₹
                  </span>
                  <input
                    id="input-finance-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    autoFocus
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 text-2xl font-bold text-on-surface bg-surface border border-surface-container rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                    required
                  />
                </div>
              </div>

              {/* 2. CATEGORY CHIPS */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Category <span className="text-error">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {modalType === 'expense'
                    ? EXPENSE_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            category === cat
                              ? 'bg-error text-white shadow-xs'
                              : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                          }`}
                        >
                          {cat}
                        </button>
                      ))
                    : INCOME_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-white shadow-xs"
                        >
                          {cat}
                        </button>
                      ))}
                </div>
              </div>

              {/* 3. DATE & PAYMENT METHOD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                    Date (default today) <span className="text-error">*</span>
                  </label>
                  <input
                    type="date"
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs text-on-surface bg-surface border border-surface-container rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                    Payment Method <span className="text-error">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {(['Cash', 'UPI'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                          paymentMethod === method
                            ? 'bg-primary text-on-primary border-primary shadow-xs'
                            : 'bg-surface border-surface-container text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4. OPTIONAL NOTE */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Note / Description (Optional)
                  </label>
                  <span className="text-[10px] text-on-surface-variant">
                    {note.length} / 200
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="e.g. Paper rolls, bubble wrap, stall electricity..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-on-surface bg-surface border border-surface-container rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-low">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-finance"
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-lg transition-all shadow-sm flex items-center gap-1.5 ${
                    modalType === 'expense'
                      ? 'bg-error hover:bg-error/90'
                      : 'bg-secondary hover:bg-secondary/90'
                  } disabled:opacity-50`}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save {modalType === 'expense' ? 'Expense' : 'Income'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. DELETE CONFIRMATION DIALOG (Naming the Entry)                     */}
      {/* ==================================================================== */}
      {entryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container w-full max-w-sm p-6 flex flex-col gap-4 animate-scale-up">
            <div className="w-10 h-10 rounded-full bg-error/10 text-error flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">delete</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">
                Confirm {entryToDelete.source === 'other' ? 'Income' : 'Expense'} Deletion
              </h3>
              <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                Are you sure you want to delete the entry of{' '}
                <strong className="text-on-surface">{formatINR(entryToDelete.amount)}</strong> for{' '}
                <strong className="text-on-surface">{entryToDelete.category}</strong> recorded on{' '}
                <strong className="text-on-surface">{formatDate(entryToDelete.date)}</strong>?
              </p>
              <p className="text-[11px] text-error font-medium mt-1">
                This will immediately remove it from all registers and financial statements.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEntryToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteEntry}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-bold text-white bg-error hover:bg-error/90 rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
              >
                {isDeleting ? 'Deleting...' : `Delete ${entryToDelete.source === 'other' ? 'Income' : 'Expense'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancesPage;
