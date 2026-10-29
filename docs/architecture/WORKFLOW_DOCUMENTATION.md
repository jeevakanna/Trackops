# TrackOps - End-to-End Operational & Business Workflow Documentation

**Document ID:** TRK-WFL-V1.0  
**Application:** TrackOps - Comic Stall Management System  
**Version:** v1.0 Production  
**Target Audience:** Stall Operators, Event Cashiers, Store Managers, Auditors  

---

## 1. Operational Overview & Stall Management Lifecycle

TrackOps is designed specifically for fast-paced retail environments such as comic conventions, pop-up merchandise stalls, and exhibition booths. The operational lifecycle flows across five distinct phases:

```
[ Phase 1: Setup ] ──> [ Phase 2: Purchasing ] ──> [ Phase 3: POS Sales ] ──> [ Phase 4: Overheads ] ──> [ Phase 5: Closeout & P&L ]
 Catalogue Setup        Inbound Stock Arrival      Fast-Paced Checkout        Operational Expenses       Financial Reconciliation
 Stock Audits           Vendor Reorders            Cash & UPI Tender          Cashflow Registers         PDF/Excel Statement Exports
```

---

## 2. Detailed Operational Workflows

### Phase 1: Pre-Event Catalogue Setup & Inventory Management

#### Workflow 1.1: Product Catalogue Creation
1. Navigate to **Inventory** (`#/inventory`).
2. Click **+ Add Product**.
3. Complete the required fields in the modal:
   - **Product Name**: Must be non-empty and unique per unit type (e.g., `Spider-Man Noir Art Print`).
   - **Unit Type**: Standardized options: `A4`, `A3`, `A5`, `Polaroid`.
   - **Cost Price (₹)**: Base acquisition cost from supplier/print shop.
   - **Sell Price (₹)**: Retail retail shelf price charged to customer.
   - **Stock Quantity**: Opening count of on-hand units.
4. Click **Save Product**.
   - *System Action:* Inserts record into PostgreSQL `products` table and creates an initial `'initial'` entry in `stock_movements`.

#### Workflow 1.2: Physical Stock Count & Inventory Adjustment
1. When performing physical audits or damaged stock write-offs:
2. Click the **Edit / Adjust Stock** icon on the target product card.
3. Choose the adjustment type:
   - **Add Stock**: Adds newly received or found inventory.
   - **Subtract Stock**: Writes off damaged, stolen, or promotional units.
   - **Set Absolute Quantity**: Overrides total to match manual count.
4. Provide a mandatory **Reason** (`Damaged`, `Physical Audit`, `Promo Giveaway`).
5. Confirm the edit.
   - *System Action:* Updates `products.stock_qty` and records an immutable log in `stock_movements` with `balance_after`.

---

### Phase 2: Vendor Purchasing & Inventory Replenishment

#### Workflow 2.1: Inbound Stock Purchase Order
1. Navigate to **Purchases** (`#/purchases`).
2. Click **+ New Purchase**.
3. Select or search products from the catalog.
4. Input **Quantity** and **Unit Cost (₹)** for each item.
   - *Line Total* updates dynamically: $\text{Line Total} = \text{Qty} \times \text{Unit Cost}$.
5. If receiving an uncatalogued comic or print:
   - Use the **Quick Add Product** inline field to register it immediately without leaving the purchase flow.
6. Select **Payment Method**: `Cash` or `UPI`.
7. Add optional vendor or delivery note.
8. Click **Complete Purchase**.
   - *System Action:*
     1. Allocates sequence ID `P-XXXX` from `purchase_number_seq`.
     2. Inserts parent record in `purchases` table.
     3. Inserts all line items into `purchase_items`.
     4. Increments `products.stock_qty` for each item.
     5. Creates `'purchase'` entry in `stock_movements`.
     6. Immediately updates **Money Out** in Finances without touching operating expense totals.

---

### Phase 3: Point-of-Sale (POS) Checkout & Customer Sales

#### Workflow 3.1: Live Stall Sales Execution
```
[ Customer Selects Posters ] ──> [ Cashier Taps Items to Cart ] ──> [ Select Cash / UPI ] ──> [ Confirm Checkout ] ──> [ Instant Receipt / Balance Update ]
```
1. Cashier opens **Sales** (`#/sales`).
2. Search products using the instant keyboard shortcut or search bar.
3. Tap product card or click **+ Add to Cart**.
4. Adjust cart quantities with `+` / `-` controls.
   - *Validation Safeguard:* The system blocks checkout if requested quantity exceeds available `stock_qty`.
5. Review order summary:
   - Displays total items, unit prices, and grand total in **₹**.
6. Select Customer Tender:
   - **Cash**: Prompts tender amount and calculates exact change due.
   - **UPI**: Displays stall QR / UPI confirmation prompt.
7. Click **Complete Sale**.
   - *System Action:*
     1. Generates sequential invoice number `S-XXXX` via `sale_number_seq`.
     2. Snapshots active `cost_price` into `sale_items.unit_cost` (locks in Cost of Goods Sold).
     3. Inserts records into `sales` and `sale_items`.
     4. Decrements `products.stock_qty`.
     5. Creates `'sale'` audit entry in `stock_movements`.
     6. Reconciles into **Sales Revenue** and **Money In** in real-time.
8. Optional: Click **Print / Download Receipt** to generate client receipt PDF.

---

### Phase 4: Operating Expenses & Cashflow Management

#### Workflow 4.1: Logging Daily Stall Operating Overheads
1. Open **Finances** (`#/finances`).
2. Click **+ Add Expense**.
3. Enter overhead amount (e.g. ₹1,200).
4. Tap the appropriate category chip:
   - `Printing` | `Packaging` | `Transport` | `Rent` | `Utilities` | `Marketing` | `Other`
5. Select Date (defaults to today in `Asia/Kolkata`).
6. Select Payment Method (`Cash` or `UPI`).
7. Enter brief description (e.g., `Booth power connection fee`).
8. Click **Save Expense**.
   - *System Action:* Persists to `finance_records` (`type='expense'`), updates P&L Operating Expenses, and adds entry to Expense Register.

#### Workflow 4.2: Logging Non-Sales Inflow
1. Click **+ Add Income**.
2. Enter amount, date, payment method, and note (e.g. `Booth sharing refund`).
3. Click **Save Income**.
   - *System Action:* Persists to `finance_records` (`type='income'`), increments Other Income and Money In totals.

#### Workflow 4.3: Real-Time Cashflow Register Inspection
Beneath the action bar, two live registers provide instant auditing:
- **Expense Register**: Combines all money-out transactions:
  - Manual expenses from `finance_records` (deletable).
  - Stock purchases from `purchases` table (read-only link to `P-XXXX`).
  - Summarizes `expensesTotal`, `purchasesTotal`, and overall `moneyOutTotal`.
- **Income Register**: Combines all money-in transactions:
  - Cash and UPI sales from `sales` table (read-only link to `S-XXXX`).
  - Non-sales income from `finance_records`.
  - Summarizes `salesTotal`, `otherIncomeTotal`, and overall `moneyInTotal`.

---

### Phase 5: Event Closeout, Reconciliation & Reporting

#### Workflow 5.1: Daily / Period P&L Review
1. Set the date filter at the top of the Finances page (e.g. `Today`, `This Week`, `This Month`, or `Custom Range`).
2. Review the core financial statements:
   - **Totals KPI Strip**:
     - $\text{Money In} = \text{Sales Revenue} + \text{Other Income}$
     - $\text{Money Out} = \text{Purchases} + \text{Operating Expenses}$
     - $\text{Net Profit} = \text{Gross Profit} + \text{Other Income} - \text{Operating Expenses}$
   - **Profit & Loss Statement**:
     - Gross Sales Revenue
     - Less: Cost of Goods Sold (COGS)
     - **= Gross Profit** and Gross Margin %
     - Plus: Other Income
     - Less: Operating Overhead Breakdown (Rent, Transport, Packaging, etc.)
     - **= Net Retained Profit**
   - **Period-over-Period Variance Analysis**:
     - Automatically compares selected date window with an equal preceding duration (e.g., today vs yesterday, or this weekend vs last weekend).
     - Calculates absolute ₹ variance and percentage changes.

#### Workflow 5.2: Formal Statement Exporting
1. Click **Export PDF**: Generates publication-ready P&L statement, KPI breakdown, and register logs formatted for management review.
2. Click **Export Excel**: Generates `.xlsx` workbook with separate sheets for P&L Summary, Expense Register, and Income Register.

---

## 3. Accrual Accounting Safeguards & Principles

TrackOps adheres strictly to retail accounting principles:
1. **Purchases are Cash Outflows, Not Expenses**:
   - Buying 500 posters for ₹25,000 does NOT decrease profit by ₹25,000 on day 1. It converts cash into asset inventory.
   - As each poster sells, its historical cost reaches profit as **COGS** ($\text{sale\_items.qty} \times \text{sale\_items.unit\_cost}$).
2. **Locked Historical Cost**:
   - If a product's cost price is edited later, past sales retain the original cost recorded at the time of purchase, preserving accounting accuracy.
3. **Strict IST Timezone Boundary**:
   - All aggregations are bound to `(timestamp AT TIME ZONE 'Asia/Kolkata')::date`. No transactions leak into previous or subsequent days due to UTC offset shifts.
