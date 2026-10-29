import { pool } from '../server/db.ts';

const API_BASE = 'http://localhost:4000/api';

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

function getTodayKolkata(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getThisMonthRange(): { from: string; to: string } {
  const today = getTodayKolkata();
  const [year, month] = today.split('-');
  const from = `${year}-${month}-01`;
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING CR-002 FINANCES & REGISTERS VERIFICATION');
  console.log('====================================================\n');

  const { from: thisMonthFrom, to: thisMonthTo } = getThisMonthRange();
  console.log(`Current month range (Asia/Kolkata): ${thisMonthFrom} to ${thisMonthTo}`);

  // Backup current state
  console.log('\n--- Backing up database state ---');
  const backupProducts = (await pool.query('SELECT * FROM products')).rows;
  const backupSales = (await pool.query('SELECT * FROM sales')).rows;
  const backupSaleItems = (await pool.query('SELECT * FROM sale_items')).rows;
  const backupPurchases = (await pool.query('SELECT * FROM purchases')).rows;
  const backupPurchaseItems = (await pool.query('SELECT * FROM purchase_items')).rows;
  const backupFinance = (await pool.query('SELECT * FROM finance_records')).rows;
  const backupMovements = (await pool.query('SELECT * FROM stock_movements')).rows;

  // Clean tables for tests
  console.log('Cleaning tables for isolated tests...');
  await pool.query('DELETE FROM stock_movements');
  await pool.query('DELETE FROM sale_items');
  await pool.query('DELETE FROM sales');
  await pool.query('DELETE FROM purchase_items');
  await pool.query('DELETE FROM purchases');
  await pool.query('DELETE FROM finance_records');
  await pool.query('DELETE FROM products');

  try {
    // ------------------------------------------------------------------------
    // TEST 1: With empty tables, both registers show empty states and zero totals
    // ------------------------------------------------------------------------
    console.log('\n>>> TEST 1: Empty tables return empty entries and zero totals');
    const expEmpty = await fetchJson(`${API_BASE}/registers/expenses?from=${thisMonthFrom}&to=${thisMonthTo}`);
    console.log('Expenses empty status:', expEmpty.status);
    console.log('Expenses totals:', expEmpty.data.totals);
    if (
      expEmpty.data.entries.length === 0 &&
      expEmpty.data.totals.expensesTotal === 0 &&
      expEmpty.data.totals.purchasesTotal === 0 &&
      expEmpty.data.totals.moneyOutTotal === 0 &&
      expEmpty.data.totals.count === 0
    ) {
      console.log('✅ TEST 1 (Expense Register) PASSED: Zero totals & empty list');
    } else {
      throw new Error(`TEST 1 Failed on Expense Register: ${JSON.stringify(expEmpty.data)}`);
    }

    const incEmpty = await fetchJson(`${API_BASE}/registers/income?from=${thisMonthFrom}&to=${thisMonthTo}`);
    console.log('Income empty status:', incEmpty.status);
    console.log('Income totals:', incEmpty.data.totals);
    if (
      incEmpty.data.entries.length === 0 &&
      incEmpty.data.totals.salesTotal === 0 &&
      incEmpty.data.totals.otherIncomeTotal === 0 &&
      incEmpty.data.totals.moneyInTotal === 0 &&
      incEmpty.data.totals.count === 0
    ) {
      console.log('✅ TEST 1 (Income Register) PASSED: Zero totals & empty list');
    } else {
      throw new Error(`TEST 1 Failed on Income Register: ${JSON.stringify(incEmpty.data)}`);
    }

    // ------------------------------------------------------------------------
    // TEST 2: Create product, purchase 10 @ 20 (200), sale 4 @ 30 (120), expense 10 (Packaging), other income 50
    // ------------------------------------------------------------------------
    console.log('\n>>> TEST 2: Seed scenario transactions and verify registers & P&L');
    // 1. Create product: Batman A4, cost 20, sell 30
    const prodRes = await fetchJson(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Batman',
        unitType: 'A4',
        costPrice: 20,
        sellPrice: 30,
        stockQty: 0
      })
    });
    const product = prodRes.data;
    console.log(`Created product #${product.id}: ${product.name} (${product.unitType})`);

    // 2. Purchase: 10 units @ 20 = 200
    const purchRes = await fetchJson(`${API_BASE}/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod: 'UPI',
        note: '',
        items: [{ productId: product.id, qty: 10, cost: 20 }]
      })
    });
    const purchase = purchRes.data;
    console.log(`Created purchase #${purchase.id} (${purchase.purchaseNo}): ₹${purchase.totalCost}`);

    // 3. Sale: 4 units @ 30 = 120
    const saleRes = await fetchJson(`${API_BASE}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod: 'Cash',
        items: [{ productId: product.id, qty: 4 }]
      })
    });
    const sale = saleRes.data;
    console.log(`Created sale #${sale.id} (${sale.saleNo}): ₹${sale.totalAmount}`);

    // 4. Manual expense: ₹10 (Packaging)
    const expRes = await fetchJson(`${API_BASE}/finances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'expense',
        category: 'Packaging',
        amount: 10,
        paymentMethod: 'Cash',
        note: 'Boxes'
      })
    });
    const manualExpense = expRes.data;
    console.log(`Created manual expense #${manualExpense.id}: ₹${manualExpense.amount} (${manualExpense.category})`);

    // 5. Other income: ₹50
    const incRes = await fetchJson(`${API_BASE}/finances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'income',
        category: 'Other income',
        amount: 50,
        paymentMethod: 'UPI',
        note: 'Stall commission'
      })
    });
    const otherIncome = incRes.data;
    console.log(`Created other income #${otherIncome.id}: ₹${otherIncome.amount} (${otherIncome.category})`);

    // Verification for Test 2:
    // - Expense register: 2 rows (the ₹10 expense and the ₹200 purchase). Expenses ₹10, Purchases ₹200, Money out ₹210.
    const expReg2 = await fetchJson(`${API_BASE}/registers/expenses?from=${thisMonthFrom}&to=${thisMonthTo}`);
    console.log('\nExpense Register Rows:');
    console.table(expReg2.data.entries.map((e: any) => ({
      source: e.source,
      reference: e.reference,
      category: e.category,
      desc: e.description,
      amount: e.amount,
      deletable: e.deletable
    })));
    console.log('Expense Register Totals:', expReg2.data.totals);

    if (
      expReg2.data.entries.length === 2 &&
      expReg2.data.totals.expensesTotal === 10 &&
      expReg2.data.totals.purchasesTotal === 200 &&
      expReg2.data.totals.moneyOutTotal === 210 &&
      expReg2.data.totals.count === 2
    ) {
      console.log('✅ TEST 2 (Expense Register) PASSED: 2 rows, Expenses ₹10, Purchases ₹200, Money out ₹210');
    } else {
      throw new Error(`TEST 2 Failed on Expense Register: ${JSON.stringify(expReg2.data)}`);
    }

    // - Income register: 2 rows (the ₹120 sale and the ₹50 other income). Sales ₹120, Other income ₹50, Money in ₹170.
    const incReg2 = await fetchJson(`${API_BASE}/registers/income?from=${thisMonthFrom}&to=${thisMonthTo}`);
    console.log('\nIncome Register Rows:');
    console.table(incReg2.data.entries.map((e: any) => ({
      source: e.source,
      reference: e.reference,
      category: e.category,
      desc: e.description,
      amount: e.amount,
      deletable: e.deletable
    })));
    console.log('Income Register Totals:', incReg2.data.totals);

    if (
      incReg2.data.entries.length === 2 &&
      incReg2.data.totals.salesTotal === 120 &&
      incReg2.data.totals.otherIncomeTotal === 50 &&
      incReg2.data.totals.moneyInTotal === 170 &&
      incReg2.data.totals.count === 2
    ) {
      console.log('✅ TEST 2 (Income Register) PASSED: 2 rows, Sales ₹120, Other income ₹50, Money in ₹170');
    } else {
      throw new Error(`TEST 2 Failed on Income Register: ${JSON.stringify(incReg2.data)}`);
    }

    // - P&L: Operating expenses ₹10 (not ₹210), cost of goods sold ₹80, Net profit ₹80.
    const pnl2 = await fetchJson(`${API_BASE}/reports/pnl?from=${thisMonthFrom}&to=${thisMonthTo}`);
    console.log('\nP&L Summary:');
    console.log({
      salesRevenue: pnl2.data.salesRevenue,
      cogs: pnl2.data.cogs,
      grossProfit: pnl2.data.grossProfit,
      otherIncome: pnl2.data.otherIncome,
      expenses: pnl2.data.expenses,
      purchases: pnl2.data.purchases,
      netProfit: pnl2.data.netProfit
    });

    if (
      pnl2.data.expenses === 10 &&
      pnl2.data.cogs === 80 &&
      pnl2.data.netProfit === 80 &&
      pnl2.data.purchases === 200
    ) {
      console.log('✅ TEST 2 (P&L Report) PASSED: Operating expenses ₹10 (not ₹210), COGS ₹80, Net profit ₹80');
    } else {
      throw new Error(`TEST 2 Failed on P&L: ${JSON.stringify(pnl2.data)}`);
    }

    // ------------------------------------------------------------------------
    // TEST 3: Edit sale to 3 units: income register shows ₹90. Delete purchase: disappears from expense register.
    // ------------------------------------------------------------------------
    console.log('\n>>> TEST 3: Edit sale to 3 units and delete purchase');
    // Edit sale to 3 units @ 30 = 90
    const editSaleRes = await fetchJson(`${API_BASE}/sales/${sale.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod: 'Cash',
        items: [{ productId: product.id, qty: 3 }]
      })
    });
    console.log(`Edited sale #${sale.id}: total is now ₹${editSaleRes.data.totalAmount}`);

    // Check income register now shows salesTotal = 90, moneyInTotal = 140
    const incReg3 = await fetchJson(`${API_BASE}/registers/income?from=${thisMonthFrom}&to=${thisMonthTo}`);
    console.log('Income register after sale edit:', incReg3.data.totals);
    if (
      incReg3.data.totals.salesTotal === 90 &&
      incReg3.data.totals.otherIncomeTotal === 50 &&
      incReg3.data.totals.moneyInTotal === 140
    ) {
      console.log('✅ TEST 3 (Sale edit live update) PASSED: Income register automatically shows ₹90 sales');
    } else {
      throw new Error(`TEST 3 Failed on sale edit: ${JSON.stringify(incReg3.data)}`);
    }

    // Delete purchase:
    // First, since sale took 3 units and purchase was 10, current stock is 7. Deleting purchase requires stock >= 10.
    // Let's delete the sale or set sale qty to 0 / delete sale first if purchase delete enforces stock constraints:
    // Wait! In Task 18, DELETE /api/purchases/:id checks:
    // "rejects with 409 'Cannot delete: <name> has already been sold, stock would go below 0' if stock would fall below 0".
    // Since 3 units were sold, deleting a 10-unit purchase would make stock 7 - 10 = -3!
    // So to delete the purchase cleanly, let's delete the sale first (returning 3 units to stock -> stock = 10), then delete purchase!
    console.log('Deleting sale to return items to stock before purchase deletion...');
    await fetchJson(`${API_BASE}/sales/${sale.id}`, { method: 'DELETE' });

    console.log('Deleting purchase...');
    const delPurchRes = await fetchJson(`${API_BASE}/purchases/${purchase.id}`, { method: 'DELETE' });
    console.log(`Deleted purchase #${purchase.id}: status ${delPurchRes.status}`);

    // Check expense register: purchase disappears, leaving 1 row (the ₹10 expense), Expenses ₹10, Purchases ₹0, Money out ₹10
    const expReg3 = await fetchJson(`${API_BASE}/registers/expenses?from=${thisMonthFrom}&to=${thisMonthTo}`);
    console.log('Expense register after purchase deletion:', expReg3.data.totals);
    if (
      expReg3.data.entries.length === 1 &&
      expReg3.data.entries[0].source === 'expense' &&
      expReg3.data.totals.expensesTotal === 10 &&
      expReg3.data.totals.purchasesTotal === 0 &&
      expReg3.data.totals.moneyOutTotal === 10
    ) {
      console.log('✅ TEST 3 (Purchase deletion live update) PASSED: Purchase disappeared from expense register');
    } else {
      throw new Error(`TEST 3 Failed on purchase deletion: ${JSON.stringify(expReg3.data)}`);
    }

    // ------------------------------------------------------------------------
    // TEST 4: Deleting manual expense or other income removes only that row. Delete action does NOT appear on purchase or sale rows.
    // ------------------------------------------------------------------------
    console.log('\n>>> TEST 4: Delete manual expense and verify non-deletable flags');
    // Verify deletable flags
    // Re-create a purchase and sale to inspect flags
    const purch4 = (await fetchJson(`${API_BASE}/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod: 'UPI',
        items: [{ productId: product.id, qty: 5, cost: 20 }]
      })
    })).data;

    const sale4 = (await fetchJson(`${API_BASE}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod: 'Cash',
        items: [{ productId: product.id, qty: 2 }]
      })
    })).data;

    const expReg4 = await fetchJson(`${API_BASE}/registers/expenses?from=${thisMonthFrom}&to=${thisMonthTo}`);
    const purchRow = expReg4.data.entries.find((e: any) => e.source === 'purchase');
    const expRow = expReg4.data.entries.find((e: any) => e.source === 'expense');

    if (purchRow?.deletable === false && expRow?.deletable === true) {
      console.log('✅ TEST 4 (Expense flags) PASSED: purchase deletable=false, expense deletable=true');
    } else {
      throw new Error(`TEST 4 flags failed: purch deletable=${purchRow?.deletable}, exp deletable=${expRow?.deletable}`);
    }

    const incReg4 = await fetchJson(`${API_BASE}/registers/income?from=${thisMonthFrom}&to=${thisMonthTo}`);
    const saleRow = incReg4.data.entries.find((e: any) => e.source === 'sale');
    const otherRow = incReg4.data.entries.find((e: any) => e.source === 'other');

    if (saleRow?.deletable === false && otherRow?.deletable === true) {
      console.log('✅ TEST 4 (Income flags) PASSED: sale deletable=false, other income deletable=true');
    } else {
      throw new Error(`TEST 4 flags failed: sale deletable=${saleRow?.deletable}, other deletable=${otherRow?.deletable}`);
    }

    // Delete the manual expense
    console.log(`Deleting manual expense #${manualExpense.id}...`);
    const delExpRes = await fetchJson(`${API_BASE}/finances/${manualExpense.id}`, { method: 'DELETE' });
    console.log('Delete expense response:', delExpRes.data);

    // Verify only the expense row was removed; purchase row remains
    const expRegAfterDel = await fetchJson(`${API_BASE}/registers/expenses?from=${thisMonthFrom}&to=${thisMonthTo}`);
    if (
      expRegAfterDel.data.entries.length === 1 &&
      expRegAfterDel.data.entries[0].source === 'purchase' &&
      expRegAfterDel.data.totals.expensesTotal === 0 &&
      expRegAfterDel.data.totals.purchasesTotal === 100
    ) {
      console.log('✅ TEST 4 (Delete manual expense) PASSED: Only expense removed, purchase intact');
    } else {
      throw new Error(`TEST 4 delete failed: ${JSON.stringify(expRegAfterDel.data)}`);
    }

    // Delete the other income
    console.log(`Deleting other income #${otherIncome.id}...`);
    const delIncRes = await fetchJson(`${API_BASE}/finances/${otherIncome.id}`, { method: 'DELETE' });
    console.log('Delete other income response:', delIncRes.data);

    const incRegAfterDel = await fetchJson(`${API_BASE}/registers/income?from=${thisMonthFrom}&to=${thisMonthTo}`);
    if (
      incRegAfterDel.data.entries.length === 1 &&
      incRegAfterDel.data.entries[0].source === 'sale' &&
      incRegAfterDel.data.totals.otherIncomeTotal === 0 &&
      incRegAfterDel.data.totals.salesTotal === 60
    ) {
      console.log('✅ TEST 4 (Delete other income) PASSED: Only other income removed, sale intact');
    } else {
      throw new Error(`TEST 4 delete failed: ${JSON.stringify(incRegAfterDel.data)}`);
    }

    // ------------------------------------------------------------------------
    // TEST 5: Source filter chips and search return the right rows, totals follow filter
    // ------------------------------------------------------------------------
    console.log('\n>>> TEST 5: Source filter chips and search filtering');
    // Add an expense again for filtering test
    await fetchJson(`${API_BASE}/finances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'expense',
        category: 'Transport',
        amount: 35,
        paymentMethod: 'Cash',
        note: 'Van fuel'
      })
    });

    // 1. Source filter = expense
    const onlyExpenses = await fetchJson(`${API_BASE}/registers/expenses?from=${thisMonthFrom}&to=${thisMonthTo}&source=expense`);
    if (
      onlyExpenses.data.entries.length === 1 &&
      onlyExpenses.data.entries[0].source === 'expense' &&
      onlyExpenses.data.totals.expensesTotal === 35 &&
      onlyExpenses.data.totals.purchasesTotal === 0 &&
      onlyExpenses.data.totals.moneyOutTotal === 35
    ) {
      console.log('✅ TEST 5 (source=expense) PASSED: Totals follow filter');
    } else {
      throw new Error(`TEST 5 source=expense failed: ${JSON.stringify(onlyExpenses.data)}`);
    }

    // 2. Source filter = purchase
    const onlyPurchases = await fetchJson(`${API_BASE}/registers/expenses?from=${thisMonthFrom}&to=${thisMonthTo}&source=purchase`);
    if (
      onlyPurchases.data.entries.length === 1 &&
      onlyPurchases.data.entries[0].source === 'purchase' &&
      onlyPurchases.data.totals.expensesTotal === 0 &&
      onlyPurchases.data.totals.purchasesTotal === 100 &&
      onlyPurchases.data.totals.moneyOutTotal === 100
    ) {
      console.log('✅ TEST 5 (source=purchase) PASSED: Totals follow filter');
    } else {
      throw new Error(`TEST 5 source=purchase failed: ${JSON.stringify(onlyPurchases.data)}`);
    }

    // 3. Search = fuel
    const searchFuel = await fetchJson(`${API_BASE}/registers/expenses?from=${thisMonthFrom}&to=${thisMonthTo}&search=fuel`);
    if (
      searchFuel.data.entries.length === 1 &&
      searchFuel.data.entries[0].description.includes('fuel') &&
      searchFuel.data.totals.moneyOutTotal === 35
    ) {
      console.log('✅ TEST 5 (search=fuel) PASSED: Search returns matching row and totals');
    } else {
      throw new Error(`TEST 5 search failed: ${JSON.stringify(searchFuel.data)}`);
    }

    // ------------------------------------------------------------------------
    // TEST 6: Last month and Custom ranges return right rows, last day included
    // ------------------------------------------------------------------------
    console.log('\n>>> TEST 6: Last month and custom ranges, inclusive bounds');
    // Create an expense dated specifically on 2026-09-30 (last day of September)
    await fetchJson(`${API_BASE}/finances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'expense',
        category: 'Utilities',
        amount: 88,
        recordDate: '2026-09-30',
        paymentMethod: 'UPI',
        note: 'September power bill'
      })
    });

    // Query custom range 2026-09-01 to 2026-09-30
    const sepRange = await fetchJson(`${API_BASE}/registers/expenses?from=2026-09-01&to=2026-09-30`);
    const sepEntry = sepRange.data.entries.find((e: any) => e.date === '2026-09-30');
    if (sepEntry && sepRange.data.totals.expensesTotal === 88) {
      console.log('✅ TEST 6 (Custom range last day included) PASSED: Row on 2026-09-30 included');
    } else {
      throw new Error(`TEST 6 failed: ${JSON.stringify(sepRange.data)}`);
    }

    // Query range 2026-09-01 to 2026-09-29 (should NOT include the 2026-09-30 entry)
    const sepBefore = await fetchJson(`${API_BASE}/registers/expenses?from=2026-09-01&to=2026-09-29`);
    if (sepBefore.data.entries.length === 0) {
      console.log('✅ TEST 6 (Upper bound boundary check) PASSED: 2026-09-30 correctly excluded when to=2026-09-29');
    } else {
      throw new Error(`TEST 6 boundary check failed: ${JSON.stringify(sepBefore.data)}`);
    }

    console.log('\n====================================================');
    console.log('ALL API & REGISTRATION TESTS PASSED PERFECTLY!');
    console.log('====================================================\n');
  } finally {
    // Restore backup database state
    console.log('\n--- Restoring database state ---');
    await pool.query('DELETE FROM stock_movements');
    await pool.query('DELETE FROM sale_items');
    await pool.query('DELETE FROM sales');
    await pool.query('DELETE FROM purchase_items');
    await pool.query('DELETE FROM purchases');
    await pool.query('DELETE FROM finance_records');
    await pool.query('DELETE FROM products');

    for (const p of backupProducts) {
      await pool.query(
        'INSERT INTO products (id, name, unit_type, stock_qty, cost_price, sell_price, image_path) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [p.id, p.name, p.unit_type, p.stock_qty, p.cost_price, p.sell_price, p.image_path]
      );
    }
    for (const p of backupPurchases) {
      await pool.query(
        'INSERT INTO purchases (id, purchase_no, purchased_at, payment_method, note, total_cost) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5, $6)',
        [p.id, p.purchase_no, p.purchased_at, p.payment_method, p.note, p.total_cost]
      );
    }
    for (const pi of backupPurchaseItems) {
      await pool.query(
        'INSERT INTO purchase_items (id, purchase_id, product_id, product_name, unit_type, qty, unit_cost) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [pi.id, pi.purchase_id, pi.product_id, pi.product_name, pi.unit_type, pi.qty, pi.unit_cost]
      );
    }
    for (const s of backupSales) {
      await pool.query(
        'INSERT INTO sales (id, sale_no, sold_at, payment_method, total_amount) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5)',
        [s.id, s.sale_no, s.sold_at, s.payment_method, s.total_amount]
      );
    }
    for (const si of backupSaleItems) {
      await pool.query(
        'INSERT INTO sale_items (id, sale_id, product_id, product_name, unit_type, qty, unit_price, unit_cost) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [si.id, si.sale_id, si.product_id, si.product_name, si.unit_type, si.qty, si.unit_price, si.unit_cost]
      );
    }
    for (const f of backupFinance) {
      await pool.query(
        'INSERT INTO finance_records (id, type, category, amount, record_date, payment_method, note, created_at) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [f.id, f.type, f.category, f.amount, f.record_date, f.payment_method, f.note, f.created_at]
      );
    }
    for (const m of backupMovements) {
      await pool.query(
        'INSERT INTO stock_movements (id, product_id, product_name, type, change_qty, balance_after, reason, reference_id, note, created_at) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [m.id, m.product_id, m.product_name, m.type, m.change_qty, m.balance_after, m.reason, m.reference_id, m.note, m.created_at]
      );
    }
    console.log('Database state restored successfully.');
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
