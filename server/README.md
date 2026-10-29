# TrackOps Server & Database Architecture

The TrackOps backend is a fast, lightweight Node.js service powered by **Express 5** and **PostgreSQL**.

---

## 📁 Directory Overview

```
server/
├── db.ts                      # PostgreSQL connection pool configuration (pg.Pool)
├── index.ts                   # Express 5 REST API router & static asset server
├── schema.sql                 # Baseline schema: products table & indices
├── sales_purchases_schema.sql # Sales, Purchases, items, stock movement ledgers, sequences
├── finances.sql               # Expense & income records, categorization, date constraints
├── migration_fk_set_null.sql  # Foreign key cascade & data preservation policies
└── sample_data.sql            # Demo inventory items & pricing for local evaluation
```

---

## 🗄️ Database Initialization Order

When deploying TrackOps to a clean PostgreSQL database, execute the SQL files in this exact sequence:

1. **`schema.sql`**
   - Creates the `products` table with identity generation and unique index on `(lower(name), lower(unit_type))`.
2. **`sales_purchases_schema.sql`**
   - Creates `sales` and `purchases` tables with sequential numbering generators (`sale_number_seq`, `purchase_number_seq`).
   - Creates `sale_items`, `purchase_items`, and the `stock_movements` inventory audit log.
3. **`finances.sql`**
   - Creates `finance_records` table with checks for payment method (`Cash` / `UPI`), transaction type (`income` / `expense`), and date indexing.
4. **`migration_fk_set_null.sql`**
   - Applies `ON DELETE SET NULL` foreign key rules so historical sales/purchase audits survive even if a product catalog item is removed.
5. *(Optional)* **`sample_data.sql`**
   - Seeds sample comic books, mangas, posters, and action figures with initial inventory quantities and price points.

---

## ⚙️ Environment Variables

The server relies on the following environment variables (loaded via `dotenv` from root `.env`):
- `DATABASE_URL`: PostgreSQL connection string (e.g., `postgresql://trackops:trackops@localhost:5432/trackops_prod`)
- `PORT`: HTTP port on which the Express server listens (default: `5000`)
