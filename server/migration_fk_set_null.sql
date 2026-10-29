-- Make sure foreign keys to products on stock_movements.product_id, sale_items.product_id,
-- and purchase_items.product_id are ON DELETE SET NULL, so old history survives a delete.

-- 1. stock_movements
ALTER TABLE stock_movements ALTER COLUMN product_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_product_id_fkey'
  ) THEN
    ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_product_id_fkey;
  END IF;

  ALTER TABLE stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
END $$;

-- 2. sale_items
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_product_id_fkey'
  ) THEN
    ALTER TABLE sale_items DROP CONSTRAINT sale_items_product_id_fkey;
  END IF;

  ALTER TABLE sale_items
    ADD CONSTRAINT sale_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
END $$;

-- 3. purchase_items
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchase_items_product_id_fkey'
  ) THEN
    ALTER TABLE purchase_items DROP CONSTRAINT purchase_items_product_id_fkey;
  END IF;

  ALTER TABLE purchase_items
    ADD CONSTRAINT purchase_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
END $$;
