# TrackOps — Changelog & Implementation Notes

## Summary of Changes

### Task: Remove Home Page
- **Removed Page Component**: Completely deleted [`src/pages/HomePage.tsx`](file:///e:/trackops/src/pages/HomePage.tsx).
- **Navigation & Routing**: Updated [`src/types/index.ts`](file:///e:/trackops/src/types/index.ts) to remove `'home'` from `PageId`. Updated [`src/components/Sidebar.tsx`](file:///e:/trackops/src/components/Sidebar.tsx) to remove the Home navigation item and link the brand header directly to Inventory.
- **Application Core**: Updated [`src/App.tsx`](file:///e:/trackops/src/App.tsx) to remove `HomePage` import and view rendering, setting `'inventory'` as the default starting page.

### Task: Stock Movement Reason Dropdown on Edit Product / Stock
- **Dropdown in Edit Stock Modal**: Added a required `Reason` dropdown in [`src/pages/InventoryPage.tsx`](file:///e:/trackops/src/pages/InventoryPage.tsx) with the 3 requested options: `"Correction"`, `"Wastage"`, and `"Miscellaneous"`.
- **API & Client Services**: Updated [`src/services/api.ts`](file:///e:/trackops/src/services/api.ts) (`setStock`) and [`src/types/index.ts`](file:///e:/trackops/src/types/index.ts) to transmit `reason` in the request body to `PUT /api/products/:id/stock`.
- **Backend & Database Persistence**: Updated `PUT /api/products/:id/stock` in [`server/index.ts`](file:///e:/trackops/server/index.ts) to persist the selected reason into the PostgreSQL `stock_movements.reason` column instead of hardcoding `'Correction'`.
- **Automated Verification**: Verified database persistence of `"Correction"`, `"Wastage"`, and `"Miscellaneous"` via end-to-end integration tests.

### Task: Completely Data-Less Frontend
- **Removed All Seed & Sample Data**: Stripped all sample products, purchases, sales, and operating expenses from [`src/services/devSeed.ts`](file:///e:/trackops/src/services/devSeed.ts) and removed legacy seed references.
- **Removed LocalStorage Seeding & Writes**: Eliminated all code writing seed records to `localStorage` on initial load. Converted [`src/services/storage.ts`](file:///e:/trackops/src/services/storage.ts) to an in-memory service with zero `localStorage` reads or writes.
- **Connected Pages Rely Exclusively on API**: Verified that Inventory, Sales, and Purchases pages read and write solely via `/api` PostgreSQL endpoints.
- **Unconnected Pages Start Empty**: Configured Home, Finances, and Reports pages to start empty with zero balances, 0 revenue/profit, and clean empty states.
- **Removed Hardcoded Sample Text & Placeholders**: Removed sample names (e.g. superhero names like Spider-Man, Doctor Strange, Wolverine, Ant-Man), sample amounts, and placeholder lists across forms and inputs.
- **Friendly Empty States with Single Clear Action**:
  - **Home**: "No products yet" with single "Add Product" button.
  - **Inventory**: "No products yet" with "+ Add Product" button.
  - **Sales**: "No products yet" with "Add Product" button when catalog is empty; "No sales yet" in recent log.
  - **Purchases**: "No purchases yet" in recent voucher log; "+ New Item Catalog" when search finds no matches.
  - **Finances**: "No financial transactions found" with single "+ Add Expense" button.
  - **Reports**: P&L empty state banner with "Add Product", and individual empty states on Sales, Purchases, Expenses, and Stock valuation tabs with clear routing buttons.
- **One-Time Startup Cleanup**: Created and registered `cleanupLegacyLocalStorage()` in [`src/main.tsx`](file:///e:/trackops/src/main.tsx) to remove all legacy keys (`trackops_products_v1`, `trackops_products_v2`, `trackops_sales_v1`, `trackops_sales_v2`, etc.) on app startup.


### Task 1: Fixed Profit & Accounting Logic
- Created shared accounting utility [`src/utils/accounting.ts`](file:///e:/trackops/src/utils/accounting.ts) providing unified accounting formulas across Home, Finances, and Reports.
- Formula implemented: `Profit = Sales revenue − Cost of Goods Sold (COGS) − Operating expenses`.
- Excluded stock purchases from operating expenses in profit calculations; purchases move money out and add inventory stock, reaching profit only as units are sold.
- Updated `SaleLineItem` to record and store unit `cost` at the time of sale.
- Implemented automatic migration in `storage.ts` to assign current product cost (or 0 if deleted) to legacy sales without recorded costs.
- Finances now clearly displays three metrics: **Money in**, **Money out** (operating expenses + stock purchases), and **Profit**.
- P&L Report displays **Gross Revenue**, **COGS**, **Gross Profit**, **Operating Expenses by category**, **Net Profit**, and **Margin %** without stock purchases appearing as an expense line.

### Task 2: Removed Out-of-Scope Features
- Removed `supplierName` from Purchases (types, storage, UI, exports).
- Removed `customerName` and `Refunded` status from Sales.
- Maintained backwards-compatible loading for existing legacy records.

### Task 3: Clean Start & Empty States
- Removed all default mock/seed records from initial localStorage state (`products`, `sales`, `purchases`, `finances`, `movements` all initialize to `[]`).
- Created a separate dev-only seed script [`src/services/devSeed.ts`](file:///e:/trackops/src/services/devSeed.ts), isolated from production UI.
- Designed user-friendly empty states with clear calls-to-action on every page (Home, Inventory, Purchases, Sales, Finances, Reports).

### Task 4: Real Date Range Reports & Purchases Register
- Implemented dynamic date presets: **This month**, **Last month**, **This quarter**, **This year**, and **Custom range** with start/end date pickers using the local system date.
- Added the dedicated **Purchases Report** listing procurement vouchers with items, unit costs, payment modes, and totals.
- Added period-over-period comparison on the P&L statement comparing against an immediately preceding period of identical duration (amount and % change).
- Added **Export PDF** and **Export Excel** buttons across all 5 reports (Profit & Loss, Sales, Purchases, Expenses, Stock Valuation), ensuring exported numbers match on-screen figures and currency renders cleanly with `Rs.` in PDFs and `₹` in spreadsheets.

### Task 5: Home Screen
- Added dynamic month selector with real system dates.
- Displayed Sales, Expenses, and Profit using the shared accounting utility.
- Added 4 quick cards linking to Inventory, Finances, Sales, and Purchases, each featuring one key metric.
- Included an Income vs. Expenses proportional chart, a low-stock alert list, and recent transactions.

### Task 6: Inventory Polish
- Added stock history view per product detailing movement source labels (`Sale`, `Purchase`, `Adjustment`) and links to view original sale bills and purchase vouchers.
- Added Stock Adjustment modal with mandatory reasons (`Damage` or `Correction`) and optional notes.
- Added inline validation blocking empty names, negative quantities, and negative prices, along with a warning when selling price is below cost.
- Preserved historical integrity: removing a product leaves past sale line items and purchase vouchers intact.
- Added "Add stock" shortcut button directing to Purchases.

### Task 7: Sales Counter
- Implemented responsive product search, quantity stepper, per-line totals, optional discount, and Cash/UPI payment toggle.
- Added strict stock availability checking that blocks orders exceeding current stock with clear messaging.
- Atomic sale save: decrements stock, records stock movement, creates sale with locked line-item unit costs, and logs an income record in Finances.
- Implemented post-sale receipt modal with Print, PDF download, and Share options. Saved sales are view-only.

### Task 8: Purchases Screen
- Implemented single-screen layout with purchase entry form and recent purchases list with expand-in-place rows.
- Atomic purchase save: increments stock, updates product latest cost price, records stock movement, and creates a "Stock Purchase" money-out record in Finances. Saved purchases are view-only.

### Task 9: Finances Screen
- Combined ledger with category and type filters: **All**, **Income**, **Operating Expenses**, and **Purchases**, with month filtering.
- Implemented manual income and expense entry (with amount first, category, date, payment mode, note).
- System-generated records linked to sales and purchases are marked with badges, non-editable, and open the original transaction in a modal.
- Manual records support deletion with an undo snackbar.

### Task 10: Data Safety & Portability
- Ensured atomic multi-entity localStorage writes.
- Added schema versioning (`trackops_version_v2`) with automatic migration logic.
- Built-in Settings modal in the header featuring **Download Backup** (`TrackOps_Backup_YYYY-MM-DD.json`), **Restore from Backup** with schema validation, and database wipe.
- Collision-free monotonic/cryptographic ID generator for records.

### Task 11: Async Storage Interface
- Wrapped all storage operations behind an asynchronous `Promise`-based service ([`src/services/storage.ts`](file:///e:/trackops/src/services/storage.ts)).
- Fully documented all API methods at the top of the file. All pages now `await` storage calls with loading and error states.

### Task 12: Performance, Offline Bundling & Cleanup
- Installed and bundled `@fontsource/inter` and `material-symbols` locally in [`src/index.css`](file:///e:/trackops/src/index.css), removing external Google CDN dependencies for 100% offline capability.
- Configured [`vite.config.ts`](file:///e:/trackops/vite.config.ts) with `server: { port: 3000, strictPort: true, host: true }` matching [`start_trackops.bat`](file:///e:/trackops/start_trackops.bat).
- Cleaned up unused files (`download_screens.mjs`).
- Resolved all TypeScript compiler issues (`npm run build` passes with zero errors).

### Task 13: Local PostgreSQL Database & Express Backend API
- Set up local PostgreSQL connection via `DATABASE_URL` in [`.env`](file:///e:/trackops/.env) with `.env` added to [`.gitignore`](file:///e:/trackops/.gitignore).
- Created [server/db.ts](file:///e:/trackops/server/db.ts) and [server/index.ts](file:///e:/trackops/server/index.ts) running on `0.0.0.0:4000`.
- Implemented `GET /api/health`, `GET /api/products` (with debounced search and `name, unit_type` sorting), and `GET /api/products/:id`.
- Added Vite proxy from `/api` to `http://localhost:4000`.
- Integrated Inventory Page with PostgreSQL API, showing poster sizes and stock status.

### Task 14: Product Creation API & Add Product Form
- Implemented `POST /api/products` with input validation (`name` max 100 chars, `unitType` in A4/A3/A5/Polaroid, non-negative numbers).
- Case-insensitive uniqueness enforcement on `(lower(name), lower(unit_type))` returning 409 conflict (`"This poster already exists in this size"`).
- Atomic stock movement insertion of type `'opening'` within the same transaction if starting stock $> 0$ and `stock_movements` table exists.
- Added `createProduct(data)` to [src/services/api.ts](file:///e:/trackops/src/services/api.ts).
- Enabled **Add Product** button on [src/pages/InventoryPage.tsx](file:///e:/trackops/src/pages/InventoryPage.tsx) with a responsive modal form and inline validation messages.

### Task 15: Sales and Purchases APIs & Page Integration
- Created [`server/sales_purchases_schema.sql`](file:///e:/trackops/server/sales_purchases_schema.sql) defining `sales`, `sale_items`, `purchases`, `purchase_items`, non-repeating number sequences (`S-0001`, `P-0001`), and enhanced `stock_movements`.
- Implemented `POST /api/sales`:
  - Validates `paymentMethod` (Cash or UPI) and non-empty `items`.
  - Merges duplicate product IDs, locks product rows in ascending ID order (`SELECT ... FOR UPDATE`), and verifies stock availability.
  - Decreases stock, logs locked sell price and unit cost, inserts the sale record, and writes `'sale'` stock movements atomically.
  - Returns `409` if stock is insufficient without persisting partial data.
- Implemented `POST /api/purchases`:
  - Validates input, merges duplicates, locks rows in ID order.
  - Increases stock, updates product `cost_price` to purchase cost (latest-cost method when cost $> 0$), and writes `'purchase'` stock movements atomically.
- Implemented Read Endpoints:
  - `GET /api/sales` and `GET /api/purchases` with date range filtering (`?from=YYYY-MM-DD&to=YYYY-MM-DD`) and item counts.
  - `GET /api/sales/:id` and `GET /api/purchases/:id` returning detailed bills/vouchers with item breakdowns by database ID or voucher number.
- Frontend API & Page Integration:
  - Added `createSale`, `getSales`, `getSale`, `createPurchase`, `getPurchases`, `getPurchase` to [`src/services/api.ts`](file:///e:/trackops/src/services/api.ts).
  - Updated [`src/pages/SalesPage.tsx`](file:///e:/trackops/src/pages/SalesPage.tsx) to read products from API, block quantities exceeding stock, call `createSale`, and display receipt modal.
  - Updated [`src/pages/PurchasesPage.tsx`](file:///e:/trackops/src/pages/PurchasesPage.tsx) to read products from API, call `createPurchase`, display recent purchases list, and load `getPurchase` on row expansion.
  - Prevented double submissions and triggered automatic cross-page data synchronization on completion.

### Task 16: Inventory Stock Adjustment & Product Deletion APIs & Dialogs
- Created and executed idempotent migration [`server/migration_fk_set_null.sql`](file:///e:/trackops/server/migration_fk_set_null.sql):
  - Made `stock_movements.product_id` nullable.
  - Ensured foreign keys on `stock_movements.product_id`, `sale_items.product_id`, and `purchase_items.product_id` have `ON DELETE SET NULL`.
  - Past sales, purchases, and stock movement logs survive product deletion with historical `product_name` and `unit_type` intact.
- Implemented `PUT /api/products/:id/stock`:
  - Body: `{ stockQty: number, note?: string }`.
  - Transactional row-locking with `SELECT ... FOR UPDATE`.
  - Calculates `change = stockQty - current.stock_qty`.
  - If `change === 0`, commits/returns 200 with unchanged product and creates no movement row.
  - Updates `products.stock_qty = stockQty`.
  - Inserts audit row in `stock_movements` with `type: 'adjustment'`, `reason: 'Correction'`, `change_qty: change`, `balance_after: stockQty`, optional note, and product name at that moment.
  - Input validation: returns `400` for bad ID, missing, non-numeric, or negative quantity; `404` if product not found; `500` on database failure.
- Implemented `PATCH /api/products/:id/stock`:
  - Adjusts stock quantity by delta `changeQty`, writes `adjustment` movement, and enforces non-negative stock balance.
- Implemented `DELETE /api/products/:id`:
  - Deletes product row from `products` table using transactional delete.
  - Due to `ON DELETE SET NULL`, related rows in `stock_movements`, `sale_items`, and `purchase_items` have their `product_id` set to `NULL` while retaining product name, unit type, and line item financial details.
  - Frees the unique `(lower(name), lower(unit_type))` constraint, allowing the exact poster name and size to be re-added later.
  - Returns `200` with `{ deleted: true, id, name }`, `400` on invalid ID, `404` if not found.
- Frontend API & UI Integration:
  - Added `setStock(id, { stockQty, note })` and `deleteProduct(id)` to [`src/services/api.ts`](file:///e:/trackops/src/services/api.ts).
  - Added **Edit stock** and **Delete** action buttons on desktop table rows and mobile product cards in [`src/pages/InventoryPage.tsx`](file:///e:/trackops/src/pages/InventoryPage.tsx).
  - Created **Edit Stock** modal: displays current stock, input for new quantity, inline change preview (e.g., `+5` or `-11`), inline negative number blocking, optional note field (max 200 chars), and submission buttons disabled during flight. Displays `"Stock updated"` toast on completion.
  - Created **Delete** confirmation modal: displays product name and size, explains that historical sales and purchases remain intact, offers Cancel and red Delete buttons with in-flight disablement. Displays `"Product deleted"` toast on completion.
  - Confirmed all operations pass `npm run build` and work cleanly across desktop and mobile devices via Tailscale.

### Task 17: Purchases and Sales Parent/Child Schema Migration & Inventory Linking
- Created and executed idempotent migration [`server/sales_purchases.sql`](file:///e:/trackops/server/sales_purchases.sql):
  - `purchases` (parent): `id` (identity PK), `purchase_no` (unique, auto `P-XXXX` from `purchase_number_seq`), `purchased_at`, `payment_method` (Cash/UPI CHECK), `note`, `total_cost` (CHECK $\ge 0$).
  - `purchase_items` (child): `id`, `purchase_id` (FK to purchases ON DELETE CASCADE), `product_id` (FK to products ON DELETE SET NULL), `product_name`, `unit_type`, `qty` (CHECK $> 0$), `unit_cost` (CHECK $\ge 0$), `total_cost` (`GENERATED ALWAYS AS (round(qty * unit_cost, 2)) STORED`).
  - `sales` (parent): `id` (identity PK), `sale_no` (unique, auto `S-XXXX` from `sale_number_seq`), `sold_at`, `payment_method` (Cash/UPI CHECK), `total_amount` (CHECK $\ge 0$).
  - `sale_items` (child): `id`, `sale_id` (FK to sales ON DELETE CASCADE), `product_id` (FK to products ON DELETE SET NULL), `product_name`, `unit_type`, `qty` (CHECK $> 0$), `unit_price` (CHECK $\ge 0$), `unit_cost` (CHECK $\ge 0$, locked at sale time), `line_total` (`GENERATED ALWAYS AS (round(qty * unit_price, 2)) STORED`).
  - Indexes on foreign keys (`purchase_id`, `sale_id`, `product_id`) and date columns (`purchased_at`, `sold_at`).
  - Flat reporting views: `purchase_lines` and `sale_lines` converting timestamps to Indian Standard Time (`Asia/Kolkata`).
  - Check constraint on `products.stock_qty >= 0` and database role grants to `trackops`.
- Backend Inventory Linking in [`server/index.ts`](file:///e:/trackops/server/index.ts):
  - `POST /api/purchases`: Merges duplicate product IDs, locks products in ID order (`FOR UPDATE`), increases stock, updates `cost_price` (when cost $> 0$), inserts purchase parent & child rows, writes `purchase` movements in `stock_movements`, and returns 201 with `{ id, purchaseNo, paymentMethod, note, totalCost, purchasedAt, items }`.
  - `POST /api/sales`: Prices fetched strictly from database `sell_price`, merges duplicates, locks rows in ID order, checks stock availability, decreases stock, inserts sale parent & child rows (saving `unit_cost` at sale time), writes `sale` movements in `stock_movements`, and returns 201 with `{ id, saleNo, paymentMethod, totalAmount, soldAt, items }`. Returns 409 if insufficient stock with available quantity message.
  - Read endpoints: `GET /api/purchases`, `GET /api/sales`, `GET /api/purchases/:id`, `GET /api/sales/:id`.
- Type Definitions & Frontend Alignment:
  - Enhanced [`src/types/index.ts`](file:///e:/trackops/src/types/index.ts) with `purchaseNo`, `totalCost`, `purchasedAt`, `saleNo`, `totalAmount`, `soldAt`, `unitPrice`, `unitCost`, and `date`.
### Task 18: Full CRUD for Purchases and Sales with Stock Constraints & Movement History
- Full Set of Backend APIs in [`server/index.ts`](file:///e:/trackops/server/index.ts):
  - `GET /api/purchases`: Supports `?from=YYYY-MM-DD&to=YYYY-MM-DD` (Asia/Kolkata) and `?search=` matching purchase voucher number or product name.
  - `GET /api/purchases/:id`: Retrieves complete purchase record with items.
  - `POST /api/purchases`: Accepts `{ paymentMethod, note, purchasedAt, items }`. Increases stock, updates `cost_price` when cost $> 0$, records `purchase` movements with positive `change_qty` and current `balance_after`.
  - `PUT /api/purchases/:id`: Full replacement. Locks parent purchase row and affected products in ID order (`FOR UPDATE`). Calculates net stock difference per product (`newQty - oldQty`). Enforces non-negative stock constraint: rejects with `409` `"Cannot edit: <name> (<unit>) stock would go below 0 (only <n> in stock)"` if stock would fall below 0. Updates stock quantities, replaces item rows, recalculates `total_cost`, writes compensating `stock_movements` rows for products whose quantities changed (`note: "Edited P-XXXX"`, `balance_after`), and updates product `cost_price` to latest purchase item cost if this was the latest purchase.
  - `DELETE /api/purchases/:id`: Locks parent purchase and affected products in ID order (`FOR UPDATE`). Reverses purchase by decrementing stock by item quantity. Enforces stock constraint: rejects with `409` `"Cannot delete: <name> (<unit>) has already been sold, stock would go below 0"` if stock would fall below 0. Cascades item deletion while append-only movement history is preserved. Writes compensating `stock_movements` rows (`type: 'purchase'`, negative `change_qty`, `note: "Deleted P-XXXX"`). Reverts `cost_price` to next most recent purchase item.
  - `GET /api/sales`: Supports `?from=YYYY-MM-DD&to=YYYY-MM-DD` (Asia/Kolkata) and `?search=` matching sale bill number or product name.
  - `GET /api/sales/:id`: Retrieves complete sale record with items.
  - `POST /api/sales`: Accepts `{ paymentMethod, soldAt, items }`. Prices fetched from database `sell_price`, locks products in ID order (`FOR UPDATE`), checks stock availability (rejects with `409` if insufficient), decreases stock, writes `sale` movements with negative `change_qty`.
  - `PUT /api/sales/:id`: Full replacement. Preserves original `unit_price` and `unit_cost` for existing sale items; newly added items use current catalog prices. Locks sale row and affected products in ID order (`FOR UPDATE`). Calculates net stock difference (`oldQty - newQty`). Enforces stock availability: rejects with `409` `"Not enough stock for <name> (<unit>). Available quantity: <current + oldQty>."` if required stock exceeds available. Updates stock, replaces items, recalculates `total_amount`, and writes compensating `stock_movements` rows (`note: "Edited S-XXXX"`).
  - `DELETE /api/sales/:id`: Locks sale row and affected products in ID order (`FOR UPDATE`). Returns sold items to stock (`stock_qty + oldQty`), deletes sale (cascades items), and writes compensating `stock_movements` rows (`type: 'sale'`, positive `change_qty`, `note: "Deleted S-XXXX"`).
- Frontend API Client in [`src/services/api.ts`](file:///e:/trackops/src/services/api.ts):
  - Added `listPurchases`, `getPurchase`, `createPurchase`, `updatePurchase`, `deletePurchase`.
  - Added `listSales`, `getSale`, `createSale`, `updateSale`, `deleteSale`.
- Purchases Page in [`src/pages/PurchasesPage.tsx`](file:///e:/trackops/src/pages/PurchasesPage.tsx):
  - Form handles both Create and Edit mode with clear banner and "Cancel Edit" button.
  - Recent purchases list with search filter (`historySearch`) and expand-in-place breakdown.
  - Edit button populates form with saved items, payment mode, and note.
  - Delete button triggers confirmation modal detailing voucher number and total outflow.
  - Inline error banner displays server 409 messages without clearing the form.
  - In-flight button disabling prevents double submits.
  - Shows success toasts (`"Saved"`, `"Updated"`, `"Deleted"`), refreshes recent list, and broadcasts `trackops:data_updated` for inventory synchronization.
- Sales Page in [`src/pages/SalesPage.tsx`](file:///e:/trackops/src/pages/SalesPage.tsx):
  - Cart handles both Create and Edit mode with clear banner and "Cancel Edit" button.
  - In edit mode, preserves original saved item prices and allows quantities up to `product.stockQty + originalQty`.
  - Added Recent Sales History section below POS counter with search filter and expandable vouchers.
  - Expanded vouchers include Receipt view, PDF download, Edit, and Delete actions.
  - Delete button triggers confirmation modal detailing bill number and total amount.
  - Inline error banner displays server 409 messages without clearing the active cart.
  - In-flight button disabling prevents double submits.
  - Shows success toasts (`"Saved"`, `"Updated"`, `"Deleted"`), refreshes history, and broadcasts `trackops:data_updated` for inventory synchronization.
- Verification & Quality:
  - Verified `npm run build` passes with zero errors.
  - Automated tests verified all 9 "DONE WHEN" criteria including create, edit, delete, compensating movements, stock balance identity (`products.stock_qty == balance_after`), concurrent race condition locking, and Tailscale remote access.
