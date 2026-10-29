DROP TABLE IF EXISTS products;

CREATE TABLE products (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT          NOT NULL CHECK (length(btrim(name)) > 0),
  unit_type   TEXT          NOT NULL DEFAULT 'pcs',
  stock_qty   NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  cost_price  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sell_price  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (sell_price >= 0),
  image_path  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_unit ON products (lower(name), lower(unit_type));
