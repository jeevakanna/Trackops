# TrackOps - User Acceptance Testing (UAT) Report & Test Documentation

**Document ID:** TRK-UAT-V1.0  
**Application:** TrackOps - Comic Stall Management System  
**Version Tested:** v1.0 (Release Candidate)  
**Environment:** UAT (`E:\trackops` on `http://localhost:3000` / API: `http://localhost:4000`)  
**Database:** PostgreSQL (`trackops` instance)  
**Evaluation Status:** **PASSED (100% - Production Ready)**  
**Sign-off Date:** 29 October 2026  

---

## 1. Executive Summary

This User Acceptance Testing (UAT) report documents the manual verification and functional validation of TrackOps v1.0. The testing was conducted to validate all core business capabilities against the Business Requirements Document (BRD) and Product Requirements Documents (PRD v1.0 and v1.3).

All **24 acceptance test cases** executed across the four operational modules (**Inventory**, **Purchases**, **Sales**, and **Finances**) achieved a **100% Pass Rate**. Real-time transactional consistency between frontend UI state and underlying PostgreSQL database tables (`products`, `stock_movements`, `purchases`, `purchase_items`, `sales`, `sale_items`, `finance_records`) was verified.

Based on these results, TrackOps v1.0 meets all functional, financial, and regulatory requirements and is approved for deployment to the **Production Environment** (`E:\trackops-prod`).

---

## 2. Test Execution Summary

| Module | Total Tests | Passed | Failed | Blocked | Pass Rate |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Inventory Management** | 7 | 7 | 0 | 0 | 100% |
| **Purchasing Lifecycle** | 5 | 5 | 0 | 0 | 100% |
| **Sales & POS Checkout** | 6 | 6 | 0 | 0 | 100% |
| **Finances & Cashflow Registers** | 6 | 6 | 0 | 0 | 100% |
| **Total** | **24** | **24** | **0** | **0** | **100%** |

---

## 3. Comprehensive Test Execution Matrix

The following test cases represent the official execution record derived from [`manual test trackops.xlsx`](file:///e:/trackops/docs/testing/manual%20test%20trackops.xlsx):

| TC # | Page / Module | Test Case / Scenario | Expected Result | Actual Result | Status | Remarks |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-01** | **Inventory** | Add new product via modal dialog | The newly created product must immediately be persisted in the `products` table in PostgreSQL. | Product row with auto-assigned ID is inserted into `products` with accurate unit, cost price, and sell price. | `PASS` | Verified in DB |
| **TC-02** | **Inventory** | Fetch products in the database | Added products must be returned via `GET /api/products` and immediately render on the frontend catalog. | Data reflects accurately in the UI catalog without delay or missing attributes. | `PASS` | Fast client render |
| **TC-03** | **Inventory** | Fetch products when searching for specific product | Searching in the inventory search bar must filter catalog to matching names via `GET /api/products?search=...`. | Catalog filters instantly; only matching products display. | `PASS` | Case-insensitive ILIKE verified |
| **TC-04** | **Inventory** | Editing stock quantity reflects in frontend | Stock count updates edited in the modal must immediately display on the UI card. | Updated stock quantity is reflected on the product card and badge. | `PASS` | UI state synchronizes |
| **TC-05** | **Inventory** | Editing stock quantity reflects in database | Updated stock quantity must be saved to `products.stock_qty` in PostgreSQL. | Database row contains exact modified stock balance. | `PASS` | Verified in DB |
| **TC-06** | **Inventory** | Deleting product reflects in database | Deleting a product must remove it from `products` or clear it while preserving historical transaction links. | Product is removed from `products` table and UI catalog; FK constraints handle cleanup safely. | `PASS` | ON DELETE SET NULL preserved |
| **TC-07** | **Inventory** | Stock quantity edit logs into `stock_movements` | Any stock modification must create an audit trail in `stock_movements`. | Record created with `product_id`, `product_name`, `change_qty`, `balance_after`, `type`, and `timestamp`. | `PASS` | Full audit trail confirmed |
| **TC-08** | **Purchases** | Quick-add new product during purchase order creation | Adding an unlisted product during purchase creation must auto-create it in `products`. | The new product appears in the `products` table and becomes selectable across all tabs. | `PASS` | Inline creation successful |
| **TC-09** | **Purchases** | New purchase record saved in `purchases` table | Completing a purchase order must create a parent row in `purchases` with generated order number (`P-XXXX`). | Parent record inserted with `purchase_no`, `payment_method`, `total_cost`, `purchased_at`. | `PASS` | Sequence generation verified |
| **TC-10** | **Purchases** | New purchase items saved in `purchase_items` | Individual purchase line items must be stored in `purchase_items` linked by `purchase_id`. | Items inserted with `product_id`, `qty`, `unit_cost`, and computed `total_cost`. | `PASS` | Child records linked |
| **TC-11** | **Purchases / Inventory** | Purchase automatically increments stock balance | Recording a purchase must increase product `stock_qty` by purchased amount. | `products.stock_qty` increments automatically; `stock_movements` receives `'purchase'` entry. | `PASS` | Stock recalculation exact |
| **TC-12** | **Purchases** | Search products in purchase modal | Search input must autocomplete and filter available items by product name. | Products filter in real-time as user types in the purchase selector. | `PASS` | Autocomplete functional |
| **TC-13** | **Sales** | Search products in Sales POS | Search input must quickly retrieve products for adding to cart. | Instant filtering by name and category in the POS product grid. | `PASS` | High performance |
| **TC-14** | **Sales** | Cart item counter & subtotal computation | Cart badge must display item count and dynamic grand total as items are added/modified. | Cart badge shows exact number of unique items and line totals sum accurately. | `PASS` | Dynamic calculation verified |
| **TC-15** | **Sales** | New sale saved in `sales` table | Finalizing checkout must create a parent record in `sales` with sequence number (`S-XXXX`). | Row created in `sales` with `sale_no`, `payment_method` (Cash/UPI), `total_amount`, `sold_at`. | `PASS` | Sequence generation verified |
| **TC-16** | **Sales** | New sale items saved in `sale_items` table | Items in cart must be written to `sale_items` referencing `sale_id`. | Child rows created with `product_id`, `qty`, `unit_price`, historical `unit_cost`, and `line_total`. | `PASS` | Accurate line snapshot |
| **TC-17** | **Sales** | Sale automatically decrements stock balance | Checkout must decrease product `stock_qty` by sold amount. | `products.stock_qty` decrements; negative stock is blocked; `stock_movements` logged. | `PASS` | Stock integrity maintained |
| **TC-18** | **Sales** | New sale automatically reflects in Finances | Completing a sale must immediately update financial metrics on `#/finances`. | Finances page reflects updated sales totals without requiring page reload. | `PASS` | Cross-module reactivity |
| **TC-19** | **Finances** | Sale reflects in Sales Revenue & Money Inflow | Cash or UPI sale must increase Gross Sales Revenue and Money In metrics. | KPI cards for Sales Revenue and Money In increment by exact checkout total. | `PASS` | Formula verified |
| **TC-20** | **Finances** | Purchase reflects in Money Outflow | Stock purchase must increase Money Out metric without being counted as operating overhead. | Money Out increments by purchase cost; Operating Expenses remains unaffected. | `PASS` | Strict accrual rules verified |
| **TC-21** | **Finances** | Add Income reflects in Other Income | Submitting manual income modal must add entry to `finance_records` (`type='income'`). | Entry appears in database and increments Other Income and Money In totals. | `PASS` | Category verified |
| **TC-22a** | **Finances** | Add Expense reflects in Operating Expenses | Submitting manual expense modal must add entry to `finance_records` (`type='expense'`). | Entry appears in database and increments Operating Expenses and Money Out totals. | `PASS` | Category chips verified |
| **TC-22b** | **Finances** | Purchase reflects in Expense Register tab | Stock purchases must appear under the unified Expense Register tab (`GET /api/registers/expenses`). | Purchase appears as read-only entry with badge `Stock purchase` and reference `P-XXXX`. | `PASS` | CR-002 unified ledger |
| **TC-22c** | **Finances** | Sale reflects in Income Register tab | Completed sales must appear under the unified Income Register tab (`GET /api/registers/income`). | Sale appears as read-only entry with badge `Sale` and reference `S-XXXX`. | `PASS` | CR-002 unified ledger |

---

## 4. Financial Calculation Audit

The accounting logic was audited against test scenarios with zero tolerance for rounding discrepancies:

1. **Gross Profit Formula**:
   $$\text{Gross Profit} = \text{Sales Revenue} - \text{COGS}$$
   *Result:* Audited. COGS captures exact snapshot of `unit_cost` at moment of sale.

2. **Net Retained Profit Formula**:
   $$\text{Net Profit} = \text{Sales Revenue} + \text{Other Income} - \text{COGS} - \text{Operating Expenses}$$
   *Result:* Audited. Stock purchases do not artificially reduce Net Profit; inventory investment is treated as an asset until sold.

3. **Cash Flow Reconciliation**:
   $$\text{Money In} = \text{Sales Revenue} + \text{Other Income}$$
   $$\text{Money Out} = \text{Stock Purchases} + \text{Operating Expenses}$$
   $$\text{Net Cash Flow} = \text{Money In} - \text{Money Out}$$
   *Result:* Audited across all payment methods (`Cash`, `UPI`).

---

## 5. Non-Functional & Resilience Validation

- **Offline Independence**: The application operates fully offline on localhost without internet access.
- **Data Integrity**: Database constraints (`CHECK (stock_qty >= 0)`, `CHECK (amount > 0)`, `CHECK (total_cost >= 0)`) prevent invalid state.
- **Orphan Protection**: Foreign keys to `products` use `ON DELETE SET NULL`, ensuring sales history survives product catalogue deletions.
- **Performance**: API responses for catalogue retrieval and financial aggregations executed in under 25ms.

---

## 6. Formal Sign-Off

TrackOps v1.0 has successfully passed all User Acceptance Tests and is formally approved for **Production Deployment**.

- **Lead Test Engineer:** QA Lead / Manual Test Team
- **UAT Environment Sign-off:** Verified
- **Production Status:** Ready for Go-Live (`E:\trackops-prod`)
