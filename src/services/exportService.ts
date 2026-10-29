import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  Product,
  SaleRecord,
  PurchaseRecord,
  FinanceRecord,
  PnlReport,
  ExpensesReport,
  ExpenseRegisterItem,
  ExpenseRegisterTotals,
  IncomeRegisterItem,
  IncomeRegisterTotals
} from '../types';
import { formatDate, formatRs, formatINR } from '../utils/formatters';
import { AccountingSummary, PnLComparison } from '../utils/accounting';

export interface ExportReportData {
  reportType: 'pnl' | 'sales' | 'purchases' | 'expenses' | 'stock';
  periodLabel: string;
  products: Product[];
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  finances: FinanceRecord[];
  accounting: AccountingSummary;
  pnlComparison?: PnLComparison;
}

export function exportReportToExcel(params: ExportReportData) {
  const wb = XLSX.utils.book_new();
  const safePeriod = params.periodLabel.replace(/[^\w\s-]/g, '').trim();

  if (params.reportType === 'pnl') {
    const pnlRows: any[][] = [
      ['TrackOps — Profit & Loss Statement'],
      ['Period:', params.periodLabel],
      ['Generated On:', new Date().toLocaleString('en-IN')],
      [],
      ['Metric', 'Current Period (₹)', 'Margin / Notes']
    ];

    pnlRows.push(['Gross Sales Revenue', params.accounting.revenue, '100%']);
    pnlRows.push(['Cost of Goods Sold (COGS)', -params.accounting.cogs, `${((params.accounting.cogs / (params.accounting.revenue || 1)) * 100).toFixed(1)}% of Revenue`]);
    pnlRows.push(['Gross Profit', params.accounting.grossProfit, `${params.accounting.grossMarginPct.toFixed(1)}% Gross Margin`]);
    pnlRows.push([]);
    pnlRows.push(['Operating Expenses Breakdown', '', '']);

    const catKeys = Object.keys(params.accounting.operatingExpensesByCategory);
    if (catKeys.length === 0) {
      pnlRows.push(['  (No operating expenses recorded)', 0, '']);
    } else {
      catKeys.forEach(cat => {
        const amt = params.accounting.operatingExpensesByCategory[cat];
        pnlRows.push([`  ${cat}`, -amt, `${((amt / (params.accounting.revenue || 1)) * 100).toFixed(1)}%`]);
      });
    }

    pnlRows.push(['Total Operating Expenses', -params.accounting.operatingExpenses, '']);
    pnlRows.push([]);
    pnlRows.push(['Net Profit', params.accounting.netProfit, `${params.accounting.netMarginPct.toFixed(1)}% Net Margin`]);

    if (params.pnlComparison) {
      pnlRows.push([]);
      pnlRows.push(['Prior Period Comparison', 'Current', 'Previous', 'Change (₹)', 'Change (%)']);
      pnlRows.push([
        'Revenue',
        params.pnlComparison.revenue.current,
        params.pnlComparison.revenue.previous,
        params.pnlComparison.revenue.diff,
        params.pnlComparison.revenue.pctChange !== null ? `${params.pnlComparison.revenue.pctChange.toFixed(1)}%` : 'N/A'
      ]);
      pnlRows.push([
        'COGS',
        params.pnlComparison.cogs.current,
        params.pnlComparison.cogs.previous,
        params.pnlComparison.cogs.diff,
        params.pnlComparison.cogs.pctChange !== null ? `${params.pnlComparison.cogs.pctChange.toFixed(1)}%` : 'N/A'
      ]);
      pnlRows.push([
        'Gross Profit',
        params.pnlComparison.grossProfit.current,
        params.pnlComparison.grossProfit.previous,
        params.pnlComparison.grossProfit.diff,
        params.pnlComparison.grossProfit.pctChange !== null ? `${params.pnlComparison.grossProfit.pctChange.toFixed(1)}%` : 'N/A'
      ]);
      pnlRows.push([
        'Operating Expenses',
        params.pnlComparison.operatingExpenses.current,
        params.pnlComparison.operatingExpenses.previous,
        params.pnlComparison.operatingExpenses.diff,
        params.pnlComparison.operatingExpenses.pctChange !== null ? `${params.pnlComparison.operatingExpenses.pctChange.toFixed(1)}%` : 'N/A'
      ]);
      pnlRows.push([
        'Net Profit',
        params.pnlComparison.netProfit.current,
        params.pnlComparison.netProfit.previous,
        params.pnlComparison.netProfit.diff,
        params.pnlComparison.netProfit.pctChange !== null ? `${params.pnlComparison.netProfit.pctChange.toFixed(1)}%` : 'N/A'
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(pnlRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Profit & Loss');
  } else if (params.reportType === 'sales') {
    const rows = [
      ['TrackOps — Sales Report'],
      ['Period:', params.periodLabel],
      ['Total Sales Bills:', params.sales.length],
      ['Total Revenue (₹):', params.accounting.revenue],
      [],
      ['Bill ID', 'Date & Time', 'Items', 'Quantity', 'Payment Method', 'Discount (₹)', 'Grand Total (₹)']
    ];

    params.sales.forEach(s => {
      const itemDesc = s.items.map(i => `${i.name} (x${i.qty})`).join(', ');
      const totalQty = s.items.reduce((acc, i) => acc + i.qty, 0);
      rows.push([
        s.id,
        formatDate(s.timestamp),
        itemDesc,
        totalQty,
        s.paymentMethod,
        s.discount || 0,
        s.grandTotal
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
  } else if (params.reportType === 'purchases') {
    const rows = [
      ['TrackOps — Purchases Report'],
      ['Period:', params.periodLabel],
      ['Total Purchases:', params.purchases.length],
      ['Total Procurement Outflow (₹):', params.purchases.reduce((acc, p) => acc + p.grandTotal, 0)],
      [],
      ['Voucher ID', 'Date & Time', 'Items Purchased', 'Total Qty', 'Payment Method', 'Note', 'Grand Total (₹)']
    ];

    params.purchases.forEach(p => {
      const itemDesc = p.items.map(i => `${i.name} (x${i.qty} @ ₹${i.cost})`).join(', ');
      const totalQty = p.items.reduce((acc, i) => acc + i.qty, 0);
      rows.push([
        p.id,
        formatDate(p.timestamp),
        itemDesc,
        totalQty,
        p.paymentMethod,
        p.note || '',
        p.grandTotal
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases');
  } else if (params.reportType === 'expenses') {
    const operatingOnly = params.finances.filter(f => f.type === 'expense' && f.category !== 'Stock Purchase');
    const totalExp = operatingOnly.reduce((acc, f) => acc + f.amount, 0);

    const rows = [
      ['TrackOps — Operating Expenses Report'],
      ['Period:', params.periodLabel],
      ['Total Operating Expenses (₹):', totalExp],
      [],
      ['Voucher ID', 'Date', 'Category', 'Description', 'Payment Method', 'Amount (₹)']
    ];

    operatingOnly.forEach(f => {
      rows.push([
        f.id,
        formatDate(f.timestamp),
        f.category,
        f.description,
        f.paymentMethod,
        f.amount
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
  } else if (params.reportType === 'stock') {
    const totalUnits = params.products.reduce((acc, p) => acc + p.qty, 0);
    const totalCostVal = params.products.reduce((acc, p) => acc + (p.qty * p.cost), 0);
    const totalRetailVal = params.products.reduce((acc, p) => acc + (p.qty * p.sell), 0);

    const rows = [
      ['TrackOps — Stock & Inventory Valuation Report'],
      ['As of:', new Date().toLocaleString('en-IN')],
      ['Total Cataloged Items:', params.products.length],
      ['Total Units In Stock:', totalUnits],
      ['Total Cost Valuation (₹):', totalCostVal],
      ['Total Retail Valuation (₹):', totalRetailVal],
      [],
      ['SKU', 'Product Name', 'Unit', 'In Stock', 'Cost Price (₹)', 'Selling Price (₹)', 'Cost Valuation (₹)', 'Status']
    ];

    params.products.forEach(p => {
      rows.push([
        p.sku,
        p.name,
        p.unit,
        p.qty,
        p.cost,
        p.sell,
        p.qty * p.cost,
        p.qty <= p.reorder ? 'Low Stock' : 'Adequate'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
  }

  XLSX.writeFile(wb, `TrackOps_${params.reportType.toUpperCase()}_${safePeriod.replace(/\s+/g, '_')}.xlsx`);
}

export function exportReportToPDF(params: ExportReportData) {
  const doc = new jsPDF();
  const safePeriod = params.periodLabel.replace(/[^\w\s-]/g, '').trim();

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate 900
  const reportTitles: Record<string, string> = {
    pnl: 'Profit & Loss Statement',
    sales: 'Sales Register Report',
    purchases: 'Procurement & Purchases Report',
    expenses: 'Operating Expenses Report',
    stock: 'Stock Valuation & Inventory Report'
  };

  doc.text(`TrackOps — ${reportTitles[params.reportType] || 'Financial Report'}`, 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Period: ${params.periodLabel}  |  Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 25);

  if (params.reportType === 'pnl') {
    // P&L summary table
    const catKeys = Object.keys(params.accounting.operatingExpensesByCategory);
    const bodyRows: any[][] = [
      ['Gross Sales Revenue', formatRs(params.accounting.revenue), '100%'],
      ['Cost of Goods Sold (COGS)', formatRs(params.accounting.cogs), `${((params.accounting.cogs / (params.accounting.revenue || 1)) * 100).toFixed(1)}%`],
      ['Gross Profit', formatRs(params.accounting.grossProfit), `${params.accounting.grossMarginPct.toFixed(1)}% Gross Margin`]
    ];

    if (catKeys.length > 0) {
      catKeys.forEach(cat => {
        bodyRows.push([`  • Operating: ${cat}`, formatRs(params.accounting.operatingExpensesByCategory[cat]), 'Expense']);
      });
    }
    bodyRows.push(['Total Operating Expenses', formatRs(params.accounting.operatingExpenses), 'Operating Outflow']);
    bodyRows.push(['Net Retained Profit', formatRs(params.accounting.netProfit), `${params.accounting.netMarginPct.toFixed(1)}% Net Margin`]);

    autoTable(doc, {
      startY: 30,
      head: [['Line Item', 'Amount (INR)', 'Performance / Margin']],
      body: bodyRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    if (params.pnlComparison) {
      const lastY = (doc as any).lastAutoTable?.finalY || 100;
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('Period-over-Period Performance Comparison', 14, lastY + 12);

      autoTable(doc, {
        startY: lastY + 16,
        head: [['Financial Metric', 'Current Period', 'Previous Period', 'Difference', 'Change %']],
        body: [
          [
            'Sales Revenue',
            formatRs(params.pnlComparison.revenue.current),
            formatRs(params.pnlComparison.revenue.previous),
            formatRs(params.pnlComparison.revenue.diff),
            params.pnlComparison.revenue.pctChange !== null ? `${params.pnlComparison.revenue.pctChange > 0 ? '+' : ''}${params.pnlComparison.revenue.pctChange.toFixed(1)}%` : 'N/A'
          ],
          [
            'Cost of Goods Sold (COGS)',
            formatRs(params.pnlComparison.cogs.current),
            formatRs(params.pnlComparison.cogs.previous),
            formatRs(params.pnlComparison.cogs.diff),
            params.pnlComparison.cogs.pctChange !== null ? `${params.pnlComparison.cogs.pctChange > 0 ? '+' : ''}${params.pnlComparison.cogs.pctChange.toFixed(1)}%` : 'N/A'
          ],
          [
            'Gross Profit',
            formatRs(params.pnlComparison.grossProfit.current),
            formatRs(params.pnlComparison.grossProfit.previous),
            formatRs(params.pnlComparison.grossProfit.diff),
            params.pnlComparison.grossProfit.pctChange !== null ? `${params.pnlComparison.grossProfit.pctChange > 0 ? '+' : ''}${params.pnlComparison.grossProfit.pctChange.toFixed(1)}%` : 'N/A'
          ],
          [
            'Operating Expenses',
            formatRs(params.pnlComparison.operatingExpenses.current),
            formatRs(params.pnlComparison.operatingExpenses.previous),
            formatRs(params.pnlComparison.operatingExpenses.diff),
            params.pnlComparison.operatingExpenses.pctChange !== null ? `${params.pnlComparison.operatingExpenses.pctChange > 0 ? '+' : ''}${params.pnlComparison.operatingExpenses.pctChange.toFixed(1)}%` : 'N/A'
          ],
          [
            'Net Profit',
            formatRs(params.pnlComparison.netProfit.current),
            formatRs(params.pnlComparison.netProfit.previous),
            formatRs(params.pnlComparison.netProfit.diff),
            params.pnlComparison.netProfit.pctChange !== null ? `${params.pnlComparison.netProfit.pctChange > 0 ? '+' : ''}${params.pnlComparison.netProfit.pctChange.toFixed(1)}%` : 'N/A'
          ]
        ],
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8.5 },
        bodyStyles: { fontSize: 8 }
      });
    }
  } else if (params.reportType === 'sales') {
    autoTable(doc, {
      startY: 30,
      head: [['Bill ID', 'Date', 'Items Summary', 'Total Qty', 'Mode', 'Grand Total']],
      body: params.sales.map(s => [
        s.id,
        formatDate(s.timestamp),
        s.items.map(i => `${i.name} (x${i.qty})`).join(', '),
        s.items.reduce((acc, i) => acc + i.qty, 0),
        s.paymentMethod,
        formatRs(s.grandTotal)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 }
    });
  } else if (params.reportType === 'purchases') {
    autoTable(doc, {
      startY: 30,
      head: [['Voucher ID', 'Date', 'Items Purchased', 'Mode', 'Note', 'Grand Total']],
      body: params.purchases.map(p => [
        p.id,
        formatDate(p.timestamp),
        p.items.map(i => `${i.name} (x${i.qty})`).join(', '),
        p.paymentMethod,
        p.note || '—',
        formatRs(p.grandTotal)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 }
    });
  } else if (params.reportType === 'expenses') {
    const operatingOnly = params.finances.filter(f => f.type === 'expense' && f.category !== 'Stock Purchase');
    autoTable(doc, {
      startY: 30,
      head: [['Voucher ID', 'Date', 'Category', 'Description', 'Mode', 'Amount']],
      body: operatingOnly.map(f => [
        f.id,
        formatDate(f.timestamp),
        f.category,
        f.description,
        f.paymentMethod,
        formatRs(f.amount)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 }
    });
  } else if (params.reportType === 'stock') {
    autoTable(doc, {
      startY: 30,
      head: [['SKU', 'Product Name', 'Stock', 'Unit Cost', 'Selling', 'Valuation', 'Status']],
      body: params.products.map(p => [
        p.sku,
        p.name,
        `${p.qty} ${p.unit}`,
        formatRs(p.cost),
        formatRs(p.sell),
        formatRs(p.qty * p.cost),
        p.qty <= p.reorder ? 'LOW STOCK' : 'Adequate'
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 }
    });
  }

  doc.save(`TrackOps_${params.reportType.toUpperCase()}_${safePeriod.replace(/\s+/g, '_')}.pdf`);
}

// ============================================================================
// CR-001 SPECIFIC REPORT EXPORTERS
// ============================================================================

export function exportPnlReportToExcel(pnl: PnlReport, periodLabel: string) {
  const wb = XLSX.utils.book_new();
  const safePeriod = periodLabel.replace(/[^\w\s-]/g, '').trim();

  const rows: (string | number)[][] = [
    ['TrackOps — Profit & Loss Statement'],
    ['Period:', periodLabel],
    ['Generated On:', new Date().toLocaleString('en-IN')],
    [],
    ['Financial Metric', 'Current Period (₹)', 'Prior Period (₹)', 'Change Amount (₹)', 'Change (%)']
  ];

  const formatPct = (pct: number | null | undefined) => {
    if (pct === null || pct === undefined) return 'N/A';
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  rows.push([
    'Sales Revenue',
    pnl.salesRevenue,
    pnl.previousSummary?.salesRevenue ?? 0,
    pnl.changes?.salesRevenue?.changeAmount ?? 0,
    formatPct(pnl.changes?.salesRevenue?.changePercent)
  ]);
  rows.push([
    'Cost of Goods Sold (COGS)',
    -pnl.cogs,
    -(pnl.previousSummary?.cogs ?? 0),
    -(pnl.changes?.cogs?.changeAmount ?? 0),
    formatPct(pnl.changes?.cogs?.changePercent)
  ]);
  rows.push([
    'Gross Profit',
    pnl.grossProfit,
    pnl.previousSummary?.grossProfit ?? 0,
    pnl.changes?.grossProfit?.changeAmount ?? 0,
    formatPct(pnl.changes?.grossProfit?.changePercent)
  ]);
  rows.push([
    'Other Income',
    pnl.otherIncome,
    pnl.previousSummary?.otherIncome ?? 0,
    pnl.changes?.otherIncome?.changeAmount ?? 0,
    formatPct(pnl.changes?.otherIncome?.changePercent)
  ]);

  rows.push([]);
  rows.push(['Operating Expenses Breakdown', '', '', '', '']);
  for (const cat of pnl.expensesByCategory) {
    rows.push([
      `  ${cat.category}`,
      cat.amount,
      cat.previousAmount ?? 0,
      cat.changeAmount ?? 0,
      formatPct(cat.changePercent)
    ]);
  }
  rows.push([
    'Total Operating Expenses',
    pnl.expenses,
    pnl.previousSummary?.expenses ?? 0,
    pnl.changes?.expenses?.changeAmount ?? 0,
    formatPct(pnl.changes?.expenses?.changePercent)
  ]);

  rows.push([]);
  rows.push([
    'Net Profit',
    pnl.netProfit,
    pnl.previousSummary?.netProfit ?? 0,
    pnl.changes?.netProfit?.changeAmount ?? 0,
    formatPct(pnl.changes?.netProfit?.changePercent)
  ]);
  rows.push([
    'Net Margin (%)',
    `${pnl.marginPercent.toFixed(1)}%`,
    `${(pnl.previousMarginPercent ?? 0).toFixed(1)}%`,
    `${(pnl.marginPercent - (pnl.previousMarginPercent ?? 0)).toFixed(1)}%`,
    ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Profit & Loss');
  XLSX.writeFile(wb, `TrackOps_PNL_${safePeriod.replace(/\s+/g, '_')}.xlsx`);
}

export function exportPnlReportToPDF(pnl: PnlReport, periodLabel: string) {
  const doc = new jsPDF();
  const safePeriod = periodLabel.replace(/[^\w\s-]/g, '').trim();

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('TrackOps — Profit & Loss Statement', 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Period: ${periodLabel}  |  Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 25);

  const formatPct = (pct: number | null | undefined) => {
    if (pct === null || pct === undefined) return 'N/A';
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  const bodyRows: any[][] = [
    [
      'Sales Revenue',
      formatRs(pnl.salesRevenue),
      formatRs(pnl.previousSummary?.salesRevenue ?? 0),
      formatRs(pnl.changes?.salesRevenue?.changeAmount ?? 0),
      formatPct(pnl.changes?.salesRevenue?.changePercent)
    ],
    [
      'Cost of Goods Sold (COGS)',
      formatRs(pnl.cogs),
      formatRs(pnl.previousSummary?.cogs ?? 0),
      formatRs(pnl.changes?.cogs?.changeAmount ?? 0),
      formatPct(pnl.changes?.cogs?.changePercent)
    ],
    [
      'Gross Profit',
      formatRs(pnl.grossProfit),
      formatRs(pnl.previousSummary?.grossProfit ?? 0),
      formatRs(pnl.changes?.grossProfit?.changeAmount ?? 0),
      formatPct(pnl.changes?.grossProfit?.changePercent)
    ],
    [
      'Other Income',
      formatRs(pnl.otherIncome),
      formatRs(pnl.previousSummary?.otherIncome ?? 0),
      formatRs(pnl.changes?.otherIncome?.changeAmount ?? 0),
      formatPct(pnl.changes?.otherIncome?.changePercent)
    ]
  ];

  for (const cat of pnl.expensesByCategory) {
    bodyRows.push([
      `  • Operating: ${cat.category}`,
      formatRs(cat.amount),
      formatRs(cat.previousAmount ?? 0),
      formatRs(cat.changeAmount ?? 0),
      formatPct(cat.changePercent)
    ]);
  }

  bodyRows.push([
    'Total Operating Expenses',
    formatRs(pnl.expenses),
    formatRs(pnl.previousSummary?.expenses ?? 0),
    formatRs(pnl.changes?.expenses?.changeAmount ?? 0),
    formatPct(pnl.changes?.expenses?.changePercent)
  ]);

  bodyRows.push([
    'Net Profit',
    formatRs(pnl.netProfit),
    formatRs(pnl.previousSummary?.netProfit ?? 0),
    formatRs(pnl.changes?.netProfit?.changeAmount ?? 0),
    formatPct(pnl.changes?.netProfit?.changePercent)
  ]);

  bodyRows.push([
    'Net Margin (%)',
    `${pnl.marginPercent.toFixed(1)}%`,
    `${(pnl.previousMarginPercent ?? 0).toFixed(1)}%`,
    `${(pnl.marginPercent - (pnl.previousMarginPercent ?? 0)).toFixed(1)}%`,
    ''
  ]);

  autoTable(doc, {
    startY: 30,
    head: [['Financial Line Item', 'Current Period', 'Prior Period', 'Difference', 'Change (%)']],
    body: bodyRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  doc.save(`TrackOps_PNL_${safePeriod.replace(/\s+/g, '_')}.pdf`);
}

export function exportExpensesReportToExcel(expensesReport: ExpensesReport, periodLabel: string) {
  const wb = XLSX.utils.book_new();
  const safePeriod = periodLabel.replace(/[^\w\s-]/g, '').trim();

  const rows: (string | number)[][] = [
    ['TrackOps — Operating Expenses Report'],
    ['Period:', periodLabel],
    ['Total Operating Expenses (₹):', expensesReport.totalExpenses],
    ['Generated On:', new Date().toLocaleString('en-IN')],
    [],
    ['Category Breakdown', 'Amount (₹)'],
  ];

  for (const cat of expensesReport.totalsByCategory) {
    rows.push([cat.category, cat.amount]);
  }

  rows.push([]);
  rows.push(['Expense Entries List', '', '', '', '', '']);
  rows.push(['Entry ID', 'Date', 'Category', 'Amount (₹)', 'Payment Method', 'Note']);

  for (const entry of expensesReport.entries) {
    rows.push([
      entry.id,
      entry.recordDate,
      entry.category,
      entry.amount,
      entry.paymentMethod,
      entry.note || '—'
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
  XLSX.writeFile(wb, `TrackOps_EXPENSES_${safePeriod.replace(/\s+/g, '_')}.xlsx`);
}

export function exportExpensesReportToPDF(expensesReport: ExpensesReport, periodLabel: string) {
  const doc = new jsPDF();
  const safePeriod = periodLabel.replace(/[^\w\s-]/g, '').trim();

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('TrackOps — Operating Expenses Report', 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Period: ${periodLabel}  |  Total Expenses: ${formatRs(expensesReport.totalExpenses)}  |  Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 25);

  const bodyRows = expensesReport.entries.map(e => [
    `#${e.id}`,
    e.recordDate,
    e.category,
    e.paymentMethod,
    e.note || '—',
    formatRs(e.amount)
  ]);

  autoTable(doc, {
    startY: 30,
    head: [['ID', 'Date', 'Category', 'Mode', 'Note', 'Amount (INR)']],
    body: bodyRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8 }
  });

  doc.save(`TrackOps_EXPENSES_${safePeriod.replace(/\s+/g, '_')}.pdf`);
}

// ============================================================================
// EXPENSE & INCOME REGISTERS EXPORT (CR-002)
// ============================================================================

export function exportExpenseRegisterToExcel(
  items: ExpenseRegisterItem[],
  totals: ExpenseRegisterTotals,
  periodLabel: string
) {
  const wb = XLSX.utils.book_new();
  const safePeriod = periodLabel.replace(/[^\w\s-]/g, '').trim();

  const rows: (string | number)[][] = [
    ['TrackOps — Expense Register'],
    ['Period:', periodLabel],
    ['Generated On:', new Date().toLocaleString('en-IN')],
    [],
    ['Totals Summary', 'Amount (₹)'],
    ['Expenses (Manual)', totals.expensesTotal],
    ['Purchases (Stock)', totals.purchasesTotal],
    ['Total Money Out', totals.moneyOutTotal],
    ['Total Entries Count', totals.count],
    [],
    ['Date', 'Type', 'Reference', 'Category', 'Description', 'Payment Method', 'Amount (₹)']
  ];

  for (const item of items) {
    rows.push([
      item.date,
      item.source === 'expense' ? 'Expense' : 'Purchase',
      item.reference || '—',
      item.category,
      item.description || '—',
      item.paymentMethod,
      item.amount
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Expense Register');
  XLSX.writeFile(wb, `TrackOps_EXPENSE_REGISTER_${safePeriod.replace(/\s+/g, '_')}.xlsx`);
}

export function exportExpenseRegisterToPDF(
  items: ExpenseRegisterItem[],
  totals: ExpenseRegisterTotals,
  periodLabel: string
) {
  const doc = new jsPDF();
  const safePeriod = periodLabel.replace(/[^\w\s-]/g, '').trim();

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('TrackOps — Expense Register', 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Period: ${periodLabel}  |  Generated on: ${new Date().toLocaleDateString('en-IN')}`,
    14,
    25
  );

  autoTable(doc, {
    startY: 30,
    head: [['Expenses (Manual)', 'Purchases (Stock)', 'Total Money Out', 'Total Entries']],
    body: [
      [
        formatRs(totals.expensesTotal),
        formatRs(totals.purchasesTotal),
        formatRs(totals.moneyOutTotal),
        String(totals.count)
      ]
    ],
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, fontStyle: 'bold', textColor: [15, 23, 42] }
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 45;

  const bodyRows = items.map((item) => [
    item.date,
    item.source === 'expense' ? 'Expense' : 'Purchase',
    item.reference || '—',
    item.category,
    item.description || '—',
    item.paymentMethod,
    formatRs(item.amount)
  ]);

  autoTable(doc, {
    startY: finalY + 8,
    head: [['Date', 'Type', 'Reference', 'Category', 'Description', 'Payment', 'Amount (INR)']],
    body: bodyRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  doc.save(`TrackOps_EXPENSE_REGISTER_${safePeriod.replace(/\s+/g, '_')}.pdf`);
}

export function exportIncomeRegisterToExcel(
  items: IncomeRegisterItem[],
  totals: IncomeRegisterTotals,
  periodLabel: string
) {
  const wb = XLSX.utils.book_new();
  const safePeriod = periodLabel.replace(/[^\w\s-]/g, '').trim();

  const rows: (string | number)[][] = [
    ['TrackOps — Income Register'],
    ['Period:', periodLabel],
    ['Generated On:', new Date().toLocaleString('en-IN')],
    [],
    ['Totals Summary', 'Amount (₹)'],
    ['Sales Revenue', totals.salesTotal],
    ['Other Income', totals.otherIncomeTotal],
    ['Total Money In', totals.moneyInTotal],
    ['Total Entries Count', totals.count],
    [],
    ['Date', 'Type', 'Reference', 'Category', 'Description', 'Payment Method', 'Amount (₹)']
  ];

  for (const item of items) {
    rows.push([
      item.date,
      item.source === 'sale' ? 'Sale' : 'Other income',
      item.reference || '—',
      item.category,
      item.description || '—',
      item.paymentMethod,
      item.amount
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Income Register');
  XLSX.writeFile(wb, `TrackOps_INCOME_REGISTER_${safePeriod.replace(/\s+/g, '_')}.xlsx`);
}

export function exportIncomeRegisterToPDF(
  items: IncomeRegisterItem[],
  totals: IncomeRegisterTotals,
  periodLabel: string
) {
  const doc = new jsPDF();
  const safePeriod = periodLabel.replace(/[^\w\s-]/g, '').trim();

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('TrackOps — Income Register', 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Period: ${periodLabel}  |  Generated on: ${new Date().toLocaleDateString('en-IN')}`,
    14,
    25
  );

  autoTable(doc, {
    startY: 30,
    head: [['Sales Revenue', 'Other Income', 'Total Money In', 'Total Entries']],
    body: [
      [
        formatRs(totals.salesTotal),
        formatRs(totals.otherIncomeTotal),
        formatRs(totals.moneyInTotal),
        String(totals.count)
      ]
    ],
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, fontStyle: 'bold', textColor: [15, 23, 42] }
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 45;

  const bodyRows = items.map((item) => [
    item.date,
    item.source === 'sale' ? 'Sale' : 'Other income',
    item.reference || '—',
    item.category,
    item.description || '—',
    item.paymentMethod,
    formatRs(item.amount)
  ]);

  autoTable(doc, {
    startY: finalY + 8,
    head: [['Date', 'Type', 'Reference', 'Category', 'Description', 'Payment', 'Amount (INR)']],
    body: bodyRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  doc.save(`TrackOps_INCOME_REGISTER_${safePeriod.replace(/\s+/g, '_')}.pdf`);
}

