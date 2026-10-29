CREATE TABLE IF NOT EXISTS stock_movements (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id    BIGINT,
  product_name  TEXT NOT NULL,
  type          TEXT NOT NULL,
  change_qty    NUMERIC(12,3) NOT NULL,
  balance_after NUMERIC(12,3) NOT NULL,
  reason        TEXT,
  reference_id  TEXT,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS note TEXT;

CREATE SEQUENCE IF NOT EXISTS sale_number_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS purchase_number_seq START WITH 1;

CREATE TABLE IF NOT EXISTS sales (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number         TEXT UNIQUE NOT NULL DEFAULT ('S-' || LPAD(nextval('sale_number_seq')::TEXT, 4, '0')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'UPI')),
  total          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sale_id      BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id   BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_type    TEXT NOT NULL,
  qty          NUMERIC(12,3) NOT NULL CHECK (qty > 0),
  price        NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  cost         NUMERIC(12,2) NOT NULL CHECK (cost >= 0),
  line_total   NUMERIC(12,2) NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE IF NOT EXISTS purchases (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number         TEXT UNIQUE NOT NULL DEFAULT ('P-' || LPAD(nextval('purchase_number_seq')::TEXT, 4, '0')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'UPI')),
  note           TEXT,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  purchase_id  BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id   BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_type    TEXT NOT NULL,
  qty          NUMERIC(12,3) NOT NULL CHECK (qty > 0),
  cost         NUMERIC(12,2) NOT NULL CHECK (cost >= 0),
  line_total   NUMERIC(12,2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
