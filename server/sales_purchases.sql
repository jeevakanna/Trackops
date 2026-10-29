-- server/sales_purchases.sql
-- Idempotent schema migration for TrackOps Purchases and Sales parent/child tables

CREATE SEQUENCE IF NOT EXISTS purchase_number_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS sale_number_seq START WITH 1;

-- Drop views if they exist to allow schema modifications
DROP VIEW IF EXISTS purchase_lines CASCADE;
DROP VIEW IF EXISTS sale_lines CASCADE;

-- If tables exist with the legacy column names (e.g. 'total' instead of 'total_cost' / 'total_amount'), drop and recreate them
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchases' AND column_name = 'total'
  ) THEN
    DROP TABLE IF EXISTS purchase_items CASCADE;
    DROP TABLE IF EXISTS purchases CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'total'
  ) THEN
    DROP TABLE IF EXISTS sale_items CASCADE;
    DROP TABLE IF EXISTS sales CASCADE;
  END IF;
END $$;

-- 1. Purchases (Parent)
CREATE TABLE IF NOT EXISTS purchases (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  purchase_no    TEXT UNIQUE NOT NULL DEFAULT ('P-' || LPAD(nextval('purchase_number_seq')::TEXT, 4, '0')),
  purchased_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'UPI')),
  note           TEXT,
  total_cost     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0)
);

-- 2. Purchase Items (Child)
CREATE TABLE IF NOT EXISTS purchase_items (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  purchase_id  BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id   BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_type    TEXT NOT NULL,
  qty          NUMERIC(12,3) NOT NULL CHECK (qty > 0),
  unit_cost    NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  total_cost   NUMERIC(12,2) GENERATED ALWAYS AS (round(qty * unit_cost, 2)) STORED
);

-- 3. Sales (Parent)
CREATE TABLE IF NOT EXISTS sales (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sale_no        TEXT UNIQUE NOT NULL DEFAULT ('S-' || LPAD(nextval('sale_number_seq')::TEXT, 4, '0')),
  sold_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'UPI')),
  total_amount   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0)
);

-- 4. Sale Items (Child)
CREATE TABLE IF NOT EXISTS sale_items (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sale_id      BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id   BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_type    TEXT NOT NULL,
  qty          NUMERIC(12,3) NOT NULL CHECK (qty > 0),
  unit_price   NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost    NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  line_total   NUMERIC(12,2) GENERATED ALWAYS AS (round(qty * unit_price, 2)) STORED
);

-- Indexes on foreign keys and date columns
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON purchase_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchased_at ON purchases(purchased_at);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at);

-- Views for flat reports
CREATE OR REPLACE VIEW purchase_lines AS
SELECT
  p.purchase_no AS purchase_id,
  (p.purchased_at AT TIME ZONE 'Asia/Kolkata')::DATE AS date,
  pi.product_name,
  pi.unit_type,
  pi.qty,
  pi.unit_cost,
  pi.total_cost,
  p.payment_method
FROM purchase_items pi
JOIN purchases p ON p.id = pi.purchase_id
ORDER BY p.purchased_at DESC, pi.id ASC;

CREATE OR REPLACE VIEW sale_lines AS
SELECT
  s.sale_no AS sale_id,
  (s.sold_at AT TIME ZONE 'Asia/Kolkata')::DATE AS date,
  si.product_name,
  si.unit_type,
  si.qty,
  si.unit_price,
  si.unit_cost,
  si.line_total,
  s.payment_method
FROM sale_items si
JOIN sales s ON s.id = si.sale_id
ORDER BY s.sold_at DESC, si.id ASC;

-- Ensure stock_movements table exists with product_id ON DELETE SET NULL
CREATE TABLE IF NOT EXISTS stock_movements (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id    BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL,
  type          TEXT NOT NULL,
  change_qty    NUMERIC(12,3) NOT NULL,
  balance_after NUMERIC(12,3) NOT NULL,
  reason        TEXT,
  reference_id  TEXT,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure products table has check constraint on stock_qty >= 0
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_qty_check'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_qty_check CHECK (stock_qty >= 0);
  END IF;
END $$;

-- Grant permissions to trackops application user if user exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trackops') THEN
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO trackops;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO trackops;
  END IF;
END $$;
