import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ProductRow {
  id: string | number;
  name: string;
  unit_type: string;
  stock_qty: string | number;
  cost_price: string | number;
  sell_price: string | number;
  image_path: string | null;
}

export interface ApiProduct {
  id: number;
  name: string;
  unitType: string;
  stockQty: number;
  costPrice: number;
  sellPrice: number;
  imagePath: string | null;
}

export function toCamelProduct(row: ProductRow): ApiProduct {
  return {
    id: Number(row.id),
    name: String(row.name),
    unitType: String(row.unit_type),
    stockQty: Number(row.stock_qty),
    costPrice: Number(row.cost_price),
    sellPrice: Number(row.sell_price),
    imagePath: row.image_path !== null && row.image_path !== undefined ? String(row.image_path) : null,
  };
}

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// List Products with optional ?search=
app.get('/api/products', async (req, res) => {
  try {
    const search = req.query.search;
    let query = `
      SELECT id, name, unit_type, stock_qty, cost_price, sell_price, image_path
      FROM products
    `;
    const params: unknown[] = [];

    if (typeof search === 'string' && search.trim().length > 0) {
      params.push(`%${search.trim()}%`);
      query += ` WHERE name ILIKE $1`;
    }

    query += ` ORDER BY name ASC, unit_type ASC`;

    const result = await pool.query<ProductRow>(query, params);
    const products = result.rows.map(toCamelProduct);
    res.json(products);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    console.error('Error fetching products:', message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get Single Product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    if (!/^\d+$/.test(rawId)) {
      return res.status(400).json({ error: 'Invalid product ID. Must be a positive integer.' });
    }

    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const result = await pool.query<ProductRow>(
      `SELECT id, name, unit_type, stock_qty, cost_price, sell_price, image_path
       FROM products
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Product with id ${id} not found` });
    }

    res.json(toCamelProduct(result.rows[0]));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    console.error('Error fetching product by id:', message);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create Product
app.post('/api/products', async (req, res) => {
  try {
    const { name, unitType, stockQty, costPrice, sellPrice } = req.body || {};

    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return res.status(400).json({ error: 'Product name must be at most 100 characters' });
    }

    const ALLOWED_UNIT_TYPES = ['A4', 'A3', 'A5', 'Polaroid'];
    if (!ALLOWED_UNIT_TYPES.includes(unitType)) {
      return res.status(400).json({
        error: `unitType must be one of ${ALLOWED_UNIT_TYPES.join(', ')}`,
      });
    }

    let finalStockQty = 0;
    if (stockQty !== undefined && stockQty !== null && stockQty !== '') {
      const numStock = Number(stockQty);
      if (isNaN(numStock) || !Number.isFinite(numStock) || numStock < 0) {
        return res.status(400).json({ error: 'stockQty must be a number of 0 or more' });
      }
      finalStockQty = numStock;
    }

    if (costPrice === undefined || costPrice === null || costPrice === '') {
      return res.status(400).json({ error: 'costPrice is required and must be a number of 0 or more' });
    }
    const numCostPrice = Number(costPrice);
    if (isNaN(numCostPrice) || !Number.isFinite(numCostPrice) || numCostPrice < 0) {
      return res.status(400).json({ error: 'costPrice must be a number of 0 or more' });
    }

    if (sellPrice === undefined || sellPrice === null || sellPrice === '') {
      return res.status(400).json({ error: 'sellPrice is required and must be a number of 0 or more' });
    }
    const numSellPrice = Number(sellPrice);
    if (isNaN(numSellPrice) || !Number.isFinite(numSellPrice) || numSellPrice < 0) {
      return res.status(400).json({ error: 'sellPrice must be a number of 0 or more' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertResult = await client.query<ProductRow>(
        `INSERT INTO products (name, unit_type, stock_qty, cost_price, sell_price)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, unit_type, stock_qty, cost_price, sell_price, image_path`,
        [trimmedName, unitType, finalStockQty, numCostPrice, numSellPrice]
      );

      const createdProduct = insertResult.rows[0];

      // If starting stock is above 0, check if stock_movements table exists
      if (finalStockQty > 0) {
        const tableCheck = await client.query(
          `SELECT to_regclass('public.stock_movements') IS NOT NULL AS table_exists`
        );

        if (tableCheck.rows[0]?.table_exists) {
          await client.query(
            `INSERT INTO stock_movements (product_id, product_name, type, change_qty, balance_after, created_at)
             VALUES ($1, $2, 'opening', $3, $4, NOW())`,
            [createdProduct.id, createdProduct.name, finalStockQty, finalStockQty]
          );
        }
      }

      await client.query('COMMIT');
      return res.status(201).json(toCamelProduct(createdProduct));
    } catch (dbErr: any) {
      await client.query('ROLLBACK');

      if (dbErr && dbErr.code === '23505') {
        return res.status(409).json({ error: 'This poster already exists in this size' });
      }

      console.error('Error adding product to database:', dbErr);
      return res.status(500).json({ error: 'Could not add product' });
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    console.error('Unexpected error in POST /api/products:', err);
    return res.status(500).json({ error: 'Could not add product' });
  }
});

// Set product exact stock quantity
app.put('/api/products/:id/stock', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid product id' });
  }

  const { stockQty, note, reason } = req.body || {};

  if (
    stockQty === undefined ||
    stockQty === null ||
    stockQty === '' ||
    isNaN(Number(stockQty)) ||
    !Number.isFinite(Number(stockQty)) ||
    Number(stockQty) < 0
  ) {
    return res.status(400).json({ error: 'stockQty must be a number of 0 or more' });
  }

  const numStockQty = Number(stockQty);

  if (note !== undefined && note !== null && typeof note === 'string' && note.length > 200) {
    return res.status(400).json({ error: 'note must be at most 200 characters' });
  }

  const trimmedNote =
    note !== undefined && note !== null && typeof note === 'string' && note.trim().length > 0
      ? note.trim()
      : null;

  const movementReason =
    reason !== undefined && reason !== null && typeof reason === 'string' && reason.trim().length > 0
      ? reason.trim()
      : 'Correction';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const selectRes = await client.query<ProductRow>(
      `SELECT id, name, unit_type, stock_qty, cost_price, sell_price, image_path
       FROM products
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (selectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const current = selectRes.rows[0];
    const currentQty = Number(current.stock_qty);
    const change = numStockQty - currentQty;

    if (change === 0) {
      await client.query('ROLLBACK');
      return res.status(200).json(toCamelProduct(current));
    }

    const updateRes = await client.query<ProductRow>(
      `UPDATE products
       SET stock_qty = $1
       WHERE id = $2
       RETURNING id, name, unit_type, stock_qty, cost_price, sell_price, image_path`,
      [numStockQty, id]
    );

    await client.query(
      `INSERT INTO stock_movements (product_id, product_name, type, change_qty, balance_after, reason, note, created_at)
       VALUES ($1, $2, 'adjustment', $3, $4, $5, $6, NOW())`,
      [current.id, current.name, change, numStockQty, movementReason, trimmedNote]
    );

    await client.query('COMMIT');
    return res.status(200).json(toCamelProduct(updateRes.rows[0]));
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Error updating stock in PUT /api/products/:id/stock:', err);
    return res.status(500).json({ error: 'Could not update stock' });
  } finally {
    client.release();
  }
});

// Adjust product stock quantity by delta (add or remove a change)
app.patch('/api/products/:id/stock', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid product id' });
  }

  const { changeQty, delta, change, note, reason } = req.body || {};
  const rawChange = changeQty ?? delta ?? change;

  if (
    rawChange === undefined ||
    rawChange === null ||
    rawChange === '' ||
    isNaN(Number(rawChange)) ||
    !Number.isFinite(Number(rawChange))
  ) {
    return res.status(400).json({ error: 'changeQty must be a valid number' });
  }

  const numChange = Number(rawChange);

  if (note !== undefined && note !== null && typeof note === 'string' && note.length > 200) {
    return res.status(400).json({ error: 'note must be at most 200 characters' });
  }

  const trimmedNote =
    note !== undefined && note !== null && typeof note === 'string' && note.trim().length > 0
      ? note.trim()
      : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const selectRes = await client.query<ProductRow>(
      `SELECT id, name, unit_type, stock_qty, cost_price, sell_price, image_path
       FROM products
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (selectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const current = selectRes.rows[0];
    const currentQty = Number(current.stock_qty);
    const newQty = currentQty + numChange;

    if (newQty < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Resulting stock cannot be negative' });
    }

    if (numChange === 0) {
      await client.query('ROLLBACK');
      return res.status(200).json(toCamelProduct(current));
    }

    const updateRes = await client.query<ProductRow>(
      `UPDATE products
       SET stock_qty = $1
       WHERE id = $2
       RETURNING id, name, unit_type, stock_qty, cost_price, sell_price, image_path`,
      [newQty, id]
    );

    await client.query(
      `INSERT INTO stock_movements (product_id, product_name, type, change_qty, balance_after, reason, note, created_at)
       VALUES ($1, $2, 'adjustment', $3, $4, $5, $6, NOW())`,
      [current.id, current.name, numChange, newQty, reason || 'Correction', trimmedNote]
    );

    await client.query('COMMIT');
    return res.status(200).json(toCamelProduct(updateRes.rows[0]));
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Error updating stock in PATCH /api/products/:id/stock:', err);
    return res.status(500).json({ error: 'Could not update stock' });
  } finally {
    client.release();
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid product id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const deleteRes = await client.query<{ id: number; name: string }>(
      `DELETE FROM products
       WHERE id = $1
       RETURNING id, name`,
      [id]
    );

    if (deleteRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    await client.query('COMMIT');
    return res.status(200).json({
      deleted: true,
      id: Number(deleteRes.rows[0].id),
      name: String(deleteRes.rows[0].name),
    });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Error deleting product in DELETE /api/products/:id:', err);
    return res.status(500).json({ error: 'Could not delete product' });
  } finally {
    client.release();
  }
});

function toCamelSaleItem(row: any) {
  return {
    id: Number(row.id),
    saleId: Number(row.sale_id),
    productId: row.product_id !== null && row.product_id !== undefined ? Number(row.product_id) : null,
    productName: String(row.product_name),
    unitType: String(row.unit_type),
    qty: Number(row.qty),
    unitPrice: Number(row.unit_price ?? row.price),
    price: Number(row.unit_price ?? row.price),
    unitCost: Number(row.unit_cost ?? row.cost),
    cost: Number(row.unit_cost ?? row.cost),
    lineTotal: Number(row.line_total),
  };
}

function toCamelPurchaseItem(row: any) {
  return {
    id: Number(row.id),
    purchaseId: Number(row.purchase_id),
    productId: row.product_id !== null && row.product_id !== undefined ? Number(row.product_id) : null,
    productName: String(row.product_name),
    unitType: String(row.unit_type),
    qty: Number(row.qty),
    unitCost: Number(row.unit_cost ?? row.cost),
    cost: Number(row.unit_cost ?? row.cost),
    totalCost: Number(row.total_cost ?? row.line_total),
    lineTotal: Number(row.total_cost ?? row.line_total),
  };
}

// -------------------------------------------------------------
// SALES ENDPOINTS
// -------------------------------------------------------------

// POST /api/sales
app.post('/api/sales', async (req, res) => {
  const { paymentMethod, soldAt, items } = req.body || {};

  if (!paymentMethod || (paymentMethod !== 'Cash' && paymentMethod !== 'UPI')) {
    return res.status(400).json({ error: 'Invalid payment method. Must be Cash or UPI.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required and must not be empty.' });
  }

  // Validate items
  for (const item of items) {
    const pId = Number(item.productId);
    const qty = Number(item.qty);
    if (!Number.isInteger(pId) || pId <= 0) {
      return res.status(400).json({ error: 'Each item must have a valid positive integer productId.' });
    }
    if (isNaN(qty) || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Item quantity must be a positive number greater than 0.' });
    }
  }

  // 1. Merge duplicate productIds in items
  const mergedMap = new Map<number, number>();
  for (const item of items) {
    const pId = Number(item.productId);
    const qty = Number(item.qty);
    mergedMap.set(pId, (mergedMap.get(pId) || 0) + qty);
  }
  const mergedItems = Array.from(mergedMap.entries()).map(([productId, qty]) => ({ productId, qty }));

  // Lock product rows in id order (SELECT ... FOR UPDATE) to avoid deadlocks
  const sortedIds = mergedItems.map((i) => i.productId).sort((a, b) => a - b);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lockResult = await client.query<ProductRow>(
      `SELECT id, name, unit_type, stock_qty, cost_price, sell_price
       FROM products
       WHERE id = ANY($1::bigint[])
       ORDER BY id ASC
       FOR UPDATE`,
      [sortedIds]
    );

    const productMap = new Map<number, ProductRow>();
    for (const row of lockResult.rows) {
      productMap.set(Number(row.id), row);
    }

    // 2. Reject if any product does not exist, or if qty > stock_qty
    for (const item of mergedItems) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Product with id ${item.productId} not found.` });
      }

      const availableStock = Number(prod.stock_qty);
      if (item.qty > availableStock) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Not enough stock for ${prod.name} (${prod.unit_type}). Available quantity: ${availableStock}.`,
          availableStock,
        });
      }
    }

    // Calculate totals and prepare item records (prices come from DB sell_price)
    let saleTotal = 0;
    const preparedItems = mergedItems.map((item) => {
      const prod = productMap.get(item.productId)!;
      const unitPrice = Number(prod.sell_price);
      const unitCost = Number(prod.cost_price);
      const lineTotal = Number((item.qty * unitPrice).toFixed(2));
      saleTotal += lineTotal;
      return {
        productId: item.productId,
        productName: prod.name,
        unitType: prod.unit_type,
        qty: item.qty,
        unitPrice,
        unitCost,
      };
    });

    saleTotal = Number(saleTotal.toFixed(2));

    // 3. Decrease products.stock_qty by qty
    for (const item of mergedItems) {
      await client.query(
        `UPDATE products
         SET stock_qty = stock_qty - $1
         WHERE id = $2`,
        [item.qty, item.productId]
      );
    }

    // 4. Insert sales row & 5. Set sales.total_amount to sum of line totals
    const sDate = soldAt ? new Date(soldAt) : null;
    const saleInsert = await client.query(
      `INSERT INTO sales (payment_method, total_amount, sold_at)
       VALUES ($1, $2, COALESCE($3, NOW()))
       RETURNING id, sale_no, payment_method, total_amount, sold_at`,
      [paymentMethod, saleTotal, sDate]
    );
    const saleRow = saleInsert.rows[0];
    const saleId = Number(saleRow.id);
    const saleNo = String(saleRow.sale_no);

    // Insert sale_items (line_total is GENERATED ALWAYS)
    const insertedItems: any[] = [];
    for (const item of preparedItems) {
      const itemInsert = await client.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, unit_type, qty, unit_price, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, sale_id, product_id, product_name, unit_type, qty, unit_price, unit_cost, line_total`,
        [saleId, item.productId, item.productName, item.unitType, item.qty, item.unitPrice, item.unitCost]
      );
      insertedItems.push(toCamelSaleItem(itemInsert.rows[0]));

      // 6. Insert one stock_movements row per item: type 'sale', change_qty negative, balance_after, reference_id = sale_no
      const prod = productMap.get(item.productId)!;
      const balanceAfter = Number((Number(prod.stock_qty) - item.qty).toFixed(3));
      await client.query(
        `INSERT INTO stock_movements (product_id, product_name, type, change_qty, balance_after, reference_id, note, created_at)
         VALUES ($1, $2, 'sale', $3, $4, $5, $6, NOW())`,
        [item.productId, item.productName, -item.qty, balanceAfter, saleNo, `Sale ${saleNo}`]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      id: saleId,
      saleNo,
      number: saleNo,
      paymentMethod: saleRow.payment_method,
      totalAmount: Number(saleRow.total_amount),
      total: Number(saleRow.total_amount),
      soldAt: saleRow.sold_at instanceof Date ? saleRow.sold_at.toISOString() : saleRow.sold_at,
      createdAt: saleRow.sold_at instanceof Date ? saleRow.sold_at.toISOString() : saleRow.sold_at,
      items: insertedItems,
    });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Error creating sale:', err);
    return res.status(500).json({ error: 'Could not save sale' });
  } finally {
    client.release();
  }
});

// GET /api/sales
app.get('/api/sales', async (req, res) => {
  try {
    const { from, to, search } = req.query;
    let query = `
      SELECT s.id, s.sale_no, s.payment_method, s.total_amount, s.sold_at,
             COUNT(si.id)::int AS item_count
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      params.push(from);
      conditions.push(`(s.sold_at AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length}`);
    }
    if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      params.push(to);
      conditions.push(`(s.sold_at AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length}`);
    }
    if (typeof search === 'string' && search.trim().length > 0) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(
        s.sale_no ILIKE $${params.length} OR
        EXISTS (
          SELECT 1 FROM sale_items si_search
          WHERE si_search.sale_id = s.id
            AND si_search.product_name ILIKE $${params.length}
        )
      )`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` GROUP BY s.id ORDER BY s.sold_at DESC, s.id DESC`;

    const result = await pool.query(query, params);
    const list = result.rows.map((r) => ({
      id: Number(r.id),
      saleNo: String(r.sale_no),
      number: String(r.sale_no),
      paymentMethod: r.payment_method,
      totalAmount: Number(r.total_amount),
      total: Number(r.total_amount),
      date: r.sold_at instanceof Date ? r.sold_at.toISOString().slice(0, 10) : String(r.sold_at).slice(0, 10),
      soldAt: r.sold_at instanceof Date ? r.sold_at.toISOString() : r.sold_at,
      createdAt: r.sold_at instanceof Date ? r.sold_at.toISOString() : r.sold_at,
      itemCount: Number(r.item_count),
    }));

    res.json(list);
  } catch (err: unknown) {
    console.error('Error fetching sales list:', err);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// GET /api/sales/:id
app.get('/api/sales/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    let saleQuery = `SELECT id, sale_no, payment_method, total_amount, sold_at FROM sales `;
    const params: any[] = [];

    if (/^\d+$/.test(rawId)) {
      params.push(Number(rawId));
      saleQuery += `WHERE id = $1`;
    } else if (/^S-\d+$/i.test(rawId)) {
      params.push(rawId.toUpperCase());
      saleQuery += `WHERE UPPER(sale_no) = $1`;
    } else {
      return res.status(400).json({ error: 'Invalid sale ID format.' });
    }

    const saleResult = await pool.query(saleQuery, params);
    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: `Sale ${rawId} not found.` });
    }

    const sale = saleResult.rows[0];
    const itemsResult = await pool.query(
      `SELECT id, sale_id, product_id, product_name, unit_type, qty, unit_price, unit_cost, line_total
       FROM sale_items
       WHERE sale_id = $1
       ORDER BY id ASC`,
      [sale.id]
    );

    res.json({
      id: Number(sale.id),
      saleNo: String(sale.sale_no),
      number: String(sale.sale_no),
      paymentMethod: sale.payment_method,
      totalAmount: Number(sale.total_amount),
      total: Number(sale.total_amount),
      soldAt: sale.sold_at instanceof Date ? sale.sold_at.toISOString() : sale.sold_at,
      createdAt: sale.sold_at instanceof Date ? sale.sold_at.toISOString() : sale.sold_at,
      items: itemsResult.rows.map(toCamelSaleItem),
    });
  } catch (err: unknown) {
    console.error('Error fetching sale details:', err);
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
});

// PUT /api/sales/:id
app.put('/api/sales/:id', async (req, res) => {
  const rawId = req.params.id;
  const { paymentMethod, soldAt, items } = req.body || {};

  if (!paymentMethod || (paymentMethod !== 'Cash' && paymentMethod !== 'UPI')) {
    return res.status(400).json({ error: 'Invalid payment method. Must be Cash or UPI.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required and must not be empty.' });
  }

  for (const item of items) {
    const pId = Number(item.productId);
    const qty = Number(item.qty);
    if (!Number.isInteger(pId) || pId <= 0) {
      return res.status(400).json({ error: 'Each item must have a valid positive integer productId.' });
    }
    if (isNaN(qty) || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Item quantity must be a positive number greater than 0.' });
    }
  }

  // Merge duplicate productIds in incoming items
  const newQtyMap = new Map<number, number>();
  for (const item of items) {
    const pId = Number(item.productId);
    const qty = Number(item.qty);
    newQtyMap.set(pId, (newQtyMap.get(pId) || 0) + qty);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock sale row
    let saleQuery = `SELECT id, sale_no, payment_method, total_amount, sold_at FROM sales `;
    const saleParams: any[] = [];
    if (/^\d+$/.test(rawId)) {
      saleParams.push(Number(rawId));
      saleQuery += `WHERE id = $1 FOR UPDATE`;
    } else if (/^S-\d+$/i.test(rawId)) {
      saleParams.push(rawId.toUpperCase());
      saleQuery += `WHERE UPPER(sale_no) = $1 FOR UPDATE`;
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid sale ID format.' });
    }

    const saleResult = await client.query(saleQuery, saleParams);
    if (saleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Sale ${rawId} not found.` });
    }

    const sale = saleResult.rows[0];
    const saleId = Number(sale.id);
    const saleNo = String(sale.sale_no);

    // Fetch old items
    const oldItemsResult = await client.query(
      `SELECT id, sale_id, product_id, product_name, unit_type, qty, unit_price, unit_cost
       FROM sale_items
       WHERE sale_id = $1`,
      [saleId]
    );

    const oldItemsMap = new Map<number, { qty: number; unitPrice: number; unitCost: number }>();
    for (const row of oldItemsResult.rows) {
      if (row.product_id !== null && row.product_id !== undefined) {
        const pId = Number(row.product_id);
        const existing = oldItemsMap.get(pId);
        if (existing) {
          existing.qty += Number(row.qty);
        } else {
          oldItemsMap.set(pId, {
            qty: Number(row.qty),
            unitPrice: Number(row.unit_price),
            unitCost: Number(row.unit_cost),
          });
        }
      }
    }

    // All affected product IDs
    const allAffectedIds = Array.from(new Set([...oldItemsMap.keys(), ...newQtyMap.keys()])).sort((a, b) => a - b);

    // Lock affected products in ID order
    let productMap = new Map<number, ProductRow>();
    if (allAffectedIds.length > 0) {
      const lockProds = await client.query<ProductRow>(
        `SELECT id, name, unit_type, stock_qty, cost_price, sell_price
         FROM products
         WHERE id = ANY($1::bigint[])
         ORDER BY id ASC
         FOR UPDATE`,
        [allAffectedIds]
      );
      for (const r of lockProds.rows) {
        productMap.set(Number(r.id), r);
      }
    }

    // Check if any product in new items does not exist
    for (const pId of newQtyMap.keys()) {
      if (!productMap.has(pId)) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Product with id ${pId} not found.` });
      }
    }

    // Stock difference per product: old qty minus new qty (returns stock if positive, consumes stock if negative)
    // If any product's stock would go below 0, reject with 409
    for (const pId of allAffectedIds) {
      const oldQty = oldItemsMap.get(pId)?.qty || 0;
      const newQty = newQtyMap.get(pId) || 0;
      const stockDiff = oldQty - newQty;
      const prod = productMap.get(pId);
      if (prod) {
        const currentStock = Number(prod.stock_qty);
        if (currentStock + stockDiff < 0) {
          await client.query('ROLLBACK');
          const availableStock = currentStock + oldQty;
          return res.status(409).json({
            error: `Not enough stock for ${prod.name} (${prod.unit_type}). Available quantity: ${availableStock}.`,
            availableStock,
          });
        }
      }
    }

    // Apply stock differences
    for (const pId of allAffectedIds) {
      const oldQty = oldItemsMap.get(pId)?.qty || 0;
      const newQty = newQtyMap.get(pId) || 0;
      const stockDiff = oldQty - newQty;
      if (stockDiff !== 0) {
        await client.query(
          `UPDATE products SET stock_qty = stock_qty + $1 WHERE id = $2`,
          [stockDiff, pId]
        );
      }
    }

    // Replace item rows
    await client.query(`DELETE FROM sale_items WHERE sale_id = $1`, [saleId]);

    let saleTotal = 0;
    const insertedItems: any[] = [];
    for (const [pId, newQty] of newQtyMap.entries()) {
      const prod = productMap.get(pId)!;
      const oldItem = oldItemsMap.get(pId);
      // For a product already on this sale, keep original unit_price and unit_cost.
      // For a product newly added, use current sell_price and cost_price.
      const unitPrice = oldItem ? oldItem.unitPrice : Number(prod.sell_price);
      const unitCost = oldItem ? oldItem.unitCost : Number(prod.cost_price);
      const lineTotal = Number((newQty * unitPrice).toFixed(2));
      saleTotal += lineTotal;

      const itemInsert = await client.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, unit_type, qty, unit_price, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, sale_id, product_id, product_name, unit_type, qty, unit_price, unit_cost, line_total`,
        [saleId, pId, prod.name, prod.unit_type, newQty, unitPrice, unitCost]
      );
      insertedItems.push(toCamelSaleItem(itemInsert.rows[0]));
    }
    saleTotal = Number(saleTotal.toFixed(2));

    // Update parent sale row
    const sDate = soldAt ? new Date(soldAt) : null;
    const updatedSaleRes = await client.query(
      `UPDATE sales
       SET payment_method = $1,
           sold_at = COALESCE($2, sold_at),
           total_amount = $3
       WHERE id = $4
       RETURNING id, sale_no, payment_method, total_amount, sold_at`,
      [paymentMethod, sDate, saleTotal, saleId]
    );
    const updatedSale = updatedSaleRes.rows[0];

    // Compensating stock_movements rows ONLY for products whose quantity changed
    for (const pId of allAffectedIds) {
      const oldQty = oldItemsMap.get(pId)?.qty || 0;
      const newQty = newQtyMap.get(pId) || 0;
      const stockDiff = oldQty - newQty;
      if (stockDiff !== 0) {
        const prod = productMap.get(pId)!;
        const balanceAfter = Number((Number(prod.stock_qty) + stockDiff).toFixed(3));
        await client.query(
          `INSERT INTO stock_movements (product_id, product_name, type, change_qty, balance_after, reference_id, note, created_at)
           VALUES ($1, $2, 'sale', $3, $4, $5, $6, NOW())`,
          [pId, prod.name, stockDiff, balanceAfter, saleNo, `Edited ${saleNo}`]
        );
      }
    }

    await client.query('COMMIT');

    return res.status(200).json({
      id: saleId,
      saleNo,
      number: saleNo,
      paymentMethod: updatedSale.payment_method,
      totalAmount: Number(updatedSale.total_amount),
      total: Number(updatedSale.total_amount),
      soldAt: updatedSale.sold_at instanceof Date ? updatedSale.sold_at.toISOString() : updatedSale.sold_at,
      createdAt: updatedSale.sold_at instanceof Date ? updatedSale.sold_at.toISOString() : updatedSale.sold_at,
      items: insertedItems,
    });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Error updating sale:', err);
    return res.status(500).json({ error: 'Could not update sale' });
  } finally {
    client.release();
  }
});

// DELETE /api/sales/:id
app.delete('/api/sales/:id', async (req, res) => {
  const rawId = req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let saleQuery = `SELECT id, sale_no FROM sales `;
    const saleParams: any[] = [];
    if (/^\d+$/.test(rawId)) {
      saleParams.push(Number(rawId));
      saleQuery += `WHERE id = $1 FOR UPDATE`;
    } else if (/^S-\d+$/i.test(rawId)) {
      saleParams.push(rawId.toUpperCase());
      saleQuery += `WHERE UPPER(sale_no) = $1 FOR UPDATE`;
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid sale ID format.' });
    }

    const saleResult = await client.query(saleQuery, saleParams);
    if (saleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Sale ${rawId} not found.` });
    }

    const sale = saleResult.rows[0];
    const saleId = Number(sale.id);
    const saleNo = String(sale.sale_no);

    const oldItemsResult = await client.query(
      `SELECT product_id, product_name, unit_type, qty
       FROM sale_items
       WHERE sale_id = $1`,
      [saleId]
    );

    const oldQtyMap = new Map<number, { qty: number; name: string }>();
    for (const row of oldItemsResult.rows) {
      if (row.product_id !== null && row.product_id !== undefined) {
        const pId = Number(row.product_id);
        const existing = oldQtyMap.get(pId);
        if (existing) {
          existing.qty += Number(row.qty);
        } else {
          oldQtyMap.set(pId, { qty: Number(row.qty), name: String(row.product_name) });
        }
      }
    }

    const affectedIds = Array.from(oldQtyMap.keys()).sort((a, b) => a - b);
    let productMap = new Map<number, ProductRow>();
    if (affectedIds.length > 0) {
      const lockProds = await client.query<ProductRow>(
        `SELECT id, name, unit_type, stock_qty, cost_price, sell_price
         FROM products
         WHERE id = ANY($1::bigint[])
         ORDER BY id ASC
         FOR UPDATE`,
        [affectedIds]
      );
      for (const r of lockProds.rows) {
        productMap.set(Number(r.id), r);
      }
    }

    // Reverse the sale: increase each product's stock_qty by the item qty
    for (const pId of affectedIds) {
      const info = oldQtyMap.get(pId)!;
      const prod = productMap.get(pId);
      if (prod) {
        const balanceAfter = Number((Number(prod.stock_qty) + info.qty).toFixed(3));
        await client.query(
          `UPDATE products SET stock_qty = stock_qty + $1 WHERE id = $2`,
          [info.qty, pId]
        );
        await client.query(
          `INSERT INTO stock_movements (product_id, product_name, type, change_qty, balance_after, reference_id, note, created_at)
           VALUES ($1, $2, 'sale', $3, $4, $5, $6, NOW())`,
          [pId, prod.name, info.qty, balanceAfter, saleNo, `Deleted ${saleNo}`]
        );
      }
    }

    // Delete the sale (items cascade)
    await client.query(`DELETE FROM sales WHERE id = $1`, [saleId]);

    await client.query('COMMIT');
    return res.status(200).json({ deleted: true, id: saleId, saleNo });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Error deleting sale:', err);
    return res.status(500).json({ error: 'Could not delete sale' });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// PURCHASES ENDPOINTS
// -------------------------------------------------------------

// POST /api/purchases
app.post('/api/purchases', async (req, res) => {
  const { paymentMethod, note, purchasedAt, items } = req.body || {};

  if (!paymentMethod || (paymentMethod !== 'Cash' && paymentMethod !== 'UPI')) {
    return res.status(400).json({ error: 'Invalid payment method. Must be Cash or UPI.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required and must not be empty.' });
  }

  // Validate items
  for (const item of items) {
    const pId = Number(item.productId);
    const qty = Number(item.qty);
    const cost = Number(item.cost);
    if (!Number.isInteger(pId) || pId <= 0) {
      return res.status(400).json({ error: 'Each item must have a valid positive integer productId.' });
    }
    if (isNaN(qty) || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Item quantity must be a positive number greater than 0.' });
    }
    if (isNaN(cost) || !Number.isFinite(cost) || cost < 0) {
      return res.status(400).json({ error: 'Cost must be a number of 0 or more.' });
    }
  }

  // 1. Merge duplicate productIds in items (latest cost taken)
  const mergedMap = new Map<number, { qty: number; cost: number }>();
  for (const item of items) {
    const pId = Number(item.productId);
    const qty = Number(item.qty);
    const cost = Number(item.cost);
    const existing = mergedMap.get(pId);
    if (existing) {
      mergedMap.set(pId, { qty: existing.qty + qty, cost });
    } else {
      mergedMap.set(pId, { qty, cost });
    }
  }
  const mergedItems = Array.from(mergedMap.entries()).map(([productId, val]) => ({
    productId,
    qty: val.qty,
    cost: val.cost,
  }));

  // Lock rows in id order (SELECT ... FOR UPDATE)
  const sortedIds = mergedItems.map((i) => i.productId).sort((a, b) => a - b);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lockResult = await client.query<ProductRow>(
      `SELECT id, name, unit_type, stock_qty, cost_price, sell_price
       FROM products
       WHERE id = ANY($1::bigint[])
       ORDER BY id ASC
       FOR UPDATE`,
      [sortedIds]
    );

    const productMap = new Map<number, ProductRow>();
    for (const row of lockResult.rows) {
      productMap.set(Number(row.id), row);
    }

    // 2. Reject if any product does not exist
    for (const item of mergedItems) {
      if (!productMap.has(item.productId)) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Product with id ${item.productId} not found.` });
      }
    }

    let purchaseTotal = 0;
    const preparedItems = mergedItems.map((item) => {
      const prod = productMap.get(item.productId)!;
      const lineTotal = Number((item.qty * item.cost).toFixed(2));
      purchaseTotal += lineTotal;
      return {
        productId: item.productId,
        productName: prod.name,
        unitType: prod.unit_type,
        qty: item.qty,
        cost: item.cost,
      };
    });

    purchaseTotal = Number(purchaseTotal.toFixed(2));

    // 3. Increase products.stock_qty by qty
    // 4. Set products.cost_price to this purchase's cost (latest-cost method), only when cost is above 0
    for (const item of mergedItems) {
      if (item.cost > 0) {
        await client.query(
          `UPDATE products
           SET stock_qty = stock_qty + $1,
               cost_price = $2
           WHERE id = $3`,
          [item.qty, item.cost, item.productId]
        );
      } else {
        await client.query(
          `UPDATE products
           SET stock_qty = stock_qty + $1
           WHERE id = $2`,
          [item.qty, item.productId]
        );
      }
    }

    // 5. Insert purchases row & 6. Set purchases.total_cost to the sum of the item totals
    const sanitizedNote = typeof note === 'string' && note.trim().length > 0 ? note.trim() : null;
    const pDate = purchasedAt ? new Date(purchasedAt) : null;
    const purchaseInsert = await client.query(
      `INSERT INTO purchases (payment_method, note, total_cost, purchased_at)
       VALUES ($1, $2, $3, COALESCE($4, NOW()))
       RETURNING id, purchase_no, payment_method, note, total_cost, purchased_at`,
      [paymentMethod, sanitizedNote, purchaseTotal, pDate]
    );
    const purchaseRow = purchaseInsert.rows[0];
    const purchaseId = Number(purchaseRow.id);
    const purchaseNo = String(purchaseRow.purchase_no);

    // Insert purchase_items (total_cost is GENERATED ALWAYS)
    const insertedItems: any[] = [];
    for (const item of preparedItems) {
      const itemInsert = await client.query(
        `INSERT INTO purchase_items (purchase_id, product_id, product_name, unit_type, qty, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, purchase_id, product_id, product_name, unit_type, qty, unit_cost, total_cost`,
        [purchaseId, item.productId, item.productName, item.unitType, item.qty, item.cost]
      );
      insertedItems.push(toCamelPurchaseItem(itemInsert.rows[0]));

      // 7. Insert one stock_movements row per item: type 'purchase', change_qty positive, balance_after, reference_id = purchase_no
      const prod = productMap.get(item.productId)!;
      const balanceAfter = Number((Number(prod.stock_qty) + item.qty).toFixed(3));
      await client.query(
        `INSERT INTO stock_movements (product_id, product_name, type, change_qty, balance_after, reference_id, note, created_at)
         VALUES ($1, $2, 'purchase', $3, $4, $5, $6, NOW())`,
        [item.productId, item.productName, item.qty, balanceAfter, purchaseNo, sanitizedNote || `Purchase ${purchaseNo}`]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      id: purchaseId,
      purchaseNo,
      number: purchaseNo,
      paymentMethod: purchaseRow.payment_method,
      note: purchaseRow.note,
      totalCost: Number(purchaseRow.total_cost),
      total: Number(purchaseRow.total_cost),
      purchasedAt: purchaseRow.purchased_at instanceof Date ? purchaseRow.purchased_at.toISOString() : purchaseRow.purchased_at,
      createdAt: purchaseRow.purchased_at instanceof Date ? purchaseRow.purchased_at.toISOString() : purchaseRow.purchased_at,
      items: insertedItems,
    });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase:', err);
    return res.status(500).json({ error: 'Could not save purchase' });
  } finally {
    client.release();
  }
});

// GET /api/purchases
app.get('/api/purchases', async (req, res) => {
  try {
    const { from, to, search } = req.query;
    let query = `
      SELECT p.id, p.purchase_no, p.payment_method, p.note, p.total_cost, p.purchased_at,
             COUNT(pi.id)::int AS item_count
      FROM purchases p
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      params.push(from);
      conditions.push(`(p.purchased_at AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length}`);
    }
    if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      params.push(to);
      conditions.push(`(p.purchased_at AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length}`);
    }
    if (typeof search === 'string' && search.trim().length > 0) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(
        p.purchase_no ILIKE $${params.length} OR
        EXISTS (
          SELECT 1 FROM purchase_items pi_search
          WHERE pi_search.purchase_id = p.id
            AND pi_search.product_name ILIKE $${params.length}
        )
      )`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` GROUP BY p.id ORDER BY p.purchased_at DESC, p.id DESC`;

    const result = await pool.query(query, params);
    const list = result.rows.map((r) => ({
      id: Number(r.id),
      purchaseNo: String(r.purchase_no),
      number: String(r.purchase_no),
      paymentMethod: r.payment_method,
      note: r.note,
      totalCost: Number(r.total_cost),
      total: Number(r.total_cost),
      date: r.purchased_at instanceof Date ? r.purchased_at.toISOString().slice(0, 10) : String(r.purchased_at).slice(0, 10),
      purchasedAt: r.purchased_at instanceof Date ? r.purchased_at.toISOString() : r.purchased_at,
      createdAt: r.purchased_at instanceof Date ? r.purchased_at.toISOString() : r.purchased_at,
      itemCount: Number(r.item_count),
    }));

    res.json(list);
  } catch (err: unknown) {
    console.error('Error fetching purchases list:', err);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// GET /api/purchases/:id
app.get('/api/purchases/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    let purchQuery = `SELECT id, purchase_no, payment_method, note, total_cost, purchased_at FROM purchases `;
    const params: any[] = [];

    if (/^\d+$/.test(rawId)) {
      params.push(Number(rawId));
      purchQuery += `WHERE id = $1`;
    } else if (/^P-\d+$/i.test(rawId)) {
      params.push(rawId.toUpperCase());
      purchQuery += `WHERE UPPER(purchase_no) = $1`;
    } else {
      return res.status(400).json({ error: 'Invalid purchase ID format.' });
    }

    const purchResult = await pool.query(purchQuery, params);
    if (purchResult.rows.length === 0) {
      return res.status(404).json({ error: `Purchase ${rawId} not found.` });
    }

    const purchase = purchResult.rows[0];
    const itemsResult = await pool.query(
      `SELECT id, purchase_id, product_id, product_name, unit_type, qty, unit_cost, total_cost
       FROM purchase_items
       WHERE purchase_id = $1
       ORDER BY id ASC`,
      [purchase.id]
    );

    res.json({
      id: Number(purchase.id),
      purchaseNo: String(purchase.purchase_no),
      number: String(purchase.purchase_no),
      paymentMethod: purchase.payment_method,
      note: purchase.note,
      totalCost: Number(purchase.total_cost),
      total: Number(purchase.total_cost),
      purchasedAt: purchase.purchased_at instanceof Date ? purchase.purchased_at.toISOString() : purchase.purchased_at,
      createdAt: purchase.purchased_at instanceof Date ? purchase.purchased_at.toISOString() : purchase.purchased_at,
      items: itemsResult.rows.map(toCamelPurchaseItem),
    });
  } catch (err: unknown) {
    console.error('Error fetching purchase details:', err);
    res.status(500).json({ error: 'Failed to fetch purchase' });
  }
});

// PUT /api/purchases/:id
app.put('/api/purchases/:id', async (req, res) => {
  const rawId = req.params.id;
  const { paymentMethod, note, purchasedAt, items } = req.body || {};

  if (!paymentMethod || (paymentMethod !== 'Cash' && paymentMethod !== 'UPI')) {
    return res.status(400).json({ error: 'Invalid payment method. Must be Cash or UPI.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required and must not be empty.' });
  }

  for (const item of items) {
    const pId = Number(item.productId);
    const qty = Number(item.qty);
    const cost = Number(item.cost);
    if (!Number.isInteger(pId) || pId <= 0) {
      return res.status(400).json({ error: 'Each item must have a valid positive integer productId.' });
    }
    if (isNaN(qty) || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Item quantity must be a positive number greater than 0.' });
    }
    if (isNaN(cost) || !Number.isFinite(cost) || cost < 0) {
      return res.status(400).json({ error: 'Cost must be a number of 0 or more.' });
    }
  }

  // Merge duplicate productIds in incoming items
  const newQtyMap = new Map<number, { qty: number; cost: number }>();
  for (const item of items) {
    const pId = Number(item.productId);
    const qty = Number(item.qty);
    const cost = Number(item.cost);
    const existing = newQtyMap.get(pId);
    if (existing) {
      newQtyMap.set(pId, { qty: existing.qty + qty, cost });
    } else {
      newQtyMap.set(pId, { qty, cost });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let purchQuery = `SELECT id, purchase_no, payment_method, note, total_cost, purchased_at FROM purchases `;
    const purchParams: any[] = [];
    if (/^\d+$/.test(rawId)) {
      purchParams.push(Number(rawId));
      purchQuery += `WHERE id = $1 FOR UPDATE`;
    } else if (/^P-\d+$/i.test(rawId)) {
      purchParams.push(rawId.toUpperCase());
      purchQuery += `WHERE UPPER(purchase_no) = $1 FOR UPDATE`;
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid purchase ID format.' });
    }

    const purchResult = await client.query(purchQuery, purchParams);
    if (purchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Purchase ${rawId} not found.` });
    }

    const purchase = purchResult.rows[0];
    const purchaseId = Number(purchase.id);
    const purchaseNo = String(purchase.purchase_no);

    // Fetch old items
    const oldItemsResult = await client.query(
      `SELECT id, purchase_id, product_id, product_name, unit_type, qty, unit_cost
       FROM purchase_items
       WHERE purchase_id = $1`,
      [purchaseId]
    );

    const oldQtyMap = new Map<number, number>();
    for (const row of oldItemsResult.rows) {
      if (row.product_id !== null && row.product_id !== undefined) {
        const pId = Number(row.product_id);
        oldQtyMap.set(pId, (oldQtyMap.get(pId) || 0) + Number(row.qty));
      }
    }

    const allAffectedIds = Array.from(new Set([...oldQtyMap.keys(), ...newQtyMap.keys()])).sort((a, b) => a - b);

    // Lock affected products in ID order
    let productMap = new Map<number, ProductRow>();
    if (allAffectedIds.length > 0) {
      const lockProds = await client.query<ProductRow>(
        `SELECT id, name, unit_type, stock_qty, cost_price, sell_price
         FROM products
         WHERE id = ANY($1::bigint[])
         ORDER BY id ASC
         FOR UPDATE`,
        [allAffectedIds]
      );
      for (const r of lockProds.rows) {
        productMap.set(Number(r.id), r);
      }
    }

    // Check all new products exist
    for (const pId of newQtyMap.keys()) {
      if (!productMap.has(pId)) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Product with id ${pId} not found.` });
      }
    }

    // Work out stock difference per product: new qty minus old qty
    // If any product's stock would go below 0, reject with 409
    for (const pId of allAffectedIds) {
      const oldQty = oldQtyMap.get(pId) || 0;
      const newQty = newQtyMap.get(pId)?.qty || 0;
      const diff = newQty - oldQty;
      const prod = productMap.get(pId);
      if (prod) {
        const currentStock = Number(prod.stock_qty);
        if (currentStock + diff < 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: `Cannot edit: ${prod.name} (${prod.unit_type}) stock would go below 0 (only ${currentStock} in stock)`,
          });
        }
      }
    }

    // Apply stock differences
    for (const pId of allAffectedIds) {
      const oldQty = oldQtyMap.get(pId) || 0;
      const newQty = newQtyMap.get(pId)?.qty || 0;
      const diff = newQty - oldQty;
      if (diff !== 0) {
        await client.query(
          `UPDATE products SET stock_qty = stock_qty + $1 WHERE id = $2`,
          [diff, pId]
        );
      }
    }

    // Replace item rows
    await client.query(`DELETE FROM purchase_items WHERE purchase_id = $1`, [purchaseId]);

    let purchaseTotal = 0;
    const insertedItems: any[] = [];
    for (const [pId, info] of newQtyMap.entries()) {
      const prod = productMap.get(pId)!;
      const lineTotal = Number((info.qty * info.cost).toFixed(2));
      purchaseTotal += lineTotal;

      const itemInsert = await client.query(
        `INSERT INTO purchase_items (purchase_id, product_id, product_name, unit_type, qty, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, purchase_id, product_id, product_name, unit_type, qty, unit_cost, total_cost`,
        [purchaseId, pId, prod.name, prod.unit_type, info.qty, info.cost]
      );
      insertedItems.push(toCamelPurchaseItem(itemInsert.rows[0]));
    }
    purchaseTotal = Number(purchaseTotal.toFixed(2));

    const sanitizedNote = typeof note === 'string' && note.trim().length > 0 ? note.trim() : null;
    const pDate = purchasedAt ? new Date(purchasedAt) : null;
    const updatedPurchRes = await client.query(
      `UPDATE purchases
       SET payment_method = $1,
           note = $2,
           purchased_at = COALESCE($3, purchased_at),
           total_cost = $4
       WHERE id = $5
       RETURNING id, purchase_no, payment_method, note, total_cost, purchased_at`,
      [paymentMethod, sanitizedNote, pDate, purchaseTotal, purchaseId]
    );
    const updatedPurch = updatedPurchRes.rows[0];

    // Compensating stock_movements rows ONLY for products whose quantity changed
    for (const pId of allAffectedIds) {
      const oldQty = oldQtyMap.get(pId) || 0;
      const newQty = newQtyMap.get(pId)?.qty || 0;
      const diff = newQty - oldQty;
      if (diff !== 0) {
        const prod = productMap.get(pId)!;
        const balanceAfter = Number((Number(prod.stock_qty) + diff).toFixed(3));
        await client.query(
          `INSERT INTO stock_movements (product_id, product_name, type, change_qty, balance_after, reference_id, note, created_at)
           VALUES ($1, $2, 'purchase', $3, $4, $5, $6, NOW())`,
          [pId, prod.name, diff, balanceAfter, purchaseNo, `Edited ${purchaseNo}`]
        );
      }
    }

    // Cost price: if this was the most recent purchase for a product, set that product's cost_price to the unit_cost of its most recent purchase item after the edit. Otherwise leave cost_price alone.
    for (const pId of allAffectedIds) {
      const newerPurchRes = await client.query(
        `SELECT 1 FROM purchase_items pi
         JOIN purchases p ON pi.purchase_id = p.id
         WHERE pi.product_id = $1
           AND p.id != $2
           AND (p.purchased_at > $3 OR (p.purchased_at = $3 AND p.id > $2))
         LIMIT 1`,
        [pId, purchaseId, updatedPurch.purchased_at]
      );

      if (newerPurchRes.rows.length === 0) {
        const latestCostRes = await client.query(
          `SELECT pi.unit_cost FROM purchase_items pi
           JOIN purchases p ON pi.purchase_id = p.id
           WHERE pi.product_id = $1
             AND pi.unit_cost > 0
           ORDER BY p.purchased_at DESC, p.id DESC, pi.id DESC
           LIMIT 1`,
          [pId]
        );
        if (latestCostRes.rows.length > 0) {
          const newCost = Number(latestCostRes.rows[0].unit_cost);
          await client.query(
            `UPDATE products SET cost_price = $1 WHERE id = $2`,
            [newCost, pId]
          );
        }
      }
    }

    await client.query('COMMIT');

    return res.status(200).json({
      id: purchaseId,
      purchaseNo,
      number: purchaseNo,
      paymentMethod: updatedPurch.payment_method,
      note: updatedPurch.note,
      totalCost: Number(updatedPurch.total_cost),
      total: Number(updatedPurch.total_cost),
      purchasedAt: updatedPurch.purchased_at instanceof Date ? updatedPurch.purchased_at.toISOString() : updatedPurch.purchased_at,
      createdAt: updatedPurch.purchased_at instanceof Date ? updatedPurch.purchased_at.toISOString() : updatedPurch.purchased_at,
      items: insertedItems,
    });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Error updating purchase:', err);
    return res.status(500).json({ error: 'Could not update purchase' });
  } finally {
    client.release();
  }
});

// DELETE /api/purchases/:id
app.delete('/api/purchases/:id', async (req, res) => {
  const rawId = req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let purchQuery = `SELECT id, purchase_no, purchased_at FROM purchases `;
    const purchParams: any[] = [];
    if (/^\d+$/.test(rawId)) {
      purchParams.push(Number(rawId));
      purchQuery += `WHERE id = $1 FOR UPDATE`;
    } else if (/^P-\d+$/i.test(rawId)) {
      purchParams.push(rawId.toUpperCase());
      purchQuery += `WHERE UPPER(purchase_no) = $1 FOR UPDATE`;
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid purchase ID format.' });
    }

    const purchResult = await client.query(purchQuery, purchParams);
    if (purchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Purchase ${rawId} not found.` });
    }

    const purchase = purchResult.rows[0];
    const purchaseId = Number(purchase.id);
    const purchaseNo = String(purchase.purchase_no);

    const oldItemsResult = await client.query(
      `SELECT product_id, product_name, unit_type, qty, unit_cost
       FROM purchase_items
       WHERE purchase_id = $1`,
      [purchaseId]
    );

    const oldQtyMap = new Map<number, { qty: number; name: string; unit: string }>();
    for (const row of oldItemsResult.rows) {
      if (row.product_id !== null && row.product_id !== undefined) {
        const pId = Number(row.product_id);
        const existing = oldQtyMap.get(pId);
        if (existing) {
          existing.qty += Number(row.qty);
        } else {
          oldQtyMap.set(pId, {
            qty: Number(row.qty),
            name: String(row.product_name),
            unit: String(row.unit_type),
          });
        }
      }
    }

    const affectedIds = Array.from(oldQtyMap.keys()).sort((a, b) => a - b);
    let productMap = new Map<number, ProductRow>();
    if (affectedIds.length > 0) {
      const lockProds = await client.query<ProductRow>(
        `SELECT id, name, unit_type, stock_qty, cost_price, sell_price
         FROM products
         WHERE id = ANY($1::bigint[])
         ORDER BY id ASC
         FOR UPDATE`,
        [affectedIds]
      );
      for (const r of lockProds.rows) {
        productMap.set(Number(r.id), r);
      }
    }

    // Reverse the purchase: decrease each product's stock_qty by item qty.
    // If any product's stock would go below 0, reject with 409
    for (const pId of affectedIds) {
      const prod = productMap.get(pId);
      const itemInfo = oldQtyMap.get(pId)!;
      if (prod) {
        const currentStock = Number(prod.stock_qty);
        if (currentStock - itemInfo.qty < 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: `Cannot delete: ${prod.name} (${prod.unit_type}) has already been sold, stock would go below 0`,
          });
        }
      }
    }

    // Decrement stock
    for (const pId of affectedIds) {
      const itemInfo = oldQtyMap.get(pId)!;
      await client.query(
        `UPDATE products SET stock_qty = stock_qty - $1 WHERE id = $2`,
        [itemInfo.qty, pId]
      );
    }

    // Add compensating stock_movements rows
    for (const pId of affectedIds) {
      const prod = productMap.get(pId)!;
      const itemInfo = oldQtyMap.get(pId)!;
      const balanceAfter = Number((Number(prod.stock_qty) - itemInfo.qty).toFixed(3));
      await client.query(
        `INSERT INTO stock_movements (product_id, product_name, type, change_qty, balance_after, reference_id, note, created_at)
         VALUES ($1, $2, 'purchase', $3, $4, $5, $6, NOW())`,
        [pId, prod.name, -itemInfo.qty, balanceAfter, purchaseNo, `Deleted ${purchaseNo}`]
      );
    }

    // Cost price: for each affected product, if this was its most recent purchase, set cost_price to the unit_cost of its next most recent purchase item. If none remain, leave cost_price alone.
    for (const pId of affectedIds) {
      const newerPurchRes = await client.query(
        `SELECT 1 FROM purchase_items pi
         JOIN purchases p ON pi.purchase_id = p.id
         WHERE pi.product_id = $1
           AND p.id != $2
           AND (p.purchased_at > $3 OR (p.purchased_at = $3 AND p.id > $2))
         LIMIT 1`,
        [pId, purchaseId, purchase.purchased_at]
      );

      if (newerPurchRes.rows.length === 0) {
        const nextCostRes = await client.query(
          `SELECT pi.unit_cost FROM purchase_items pi
           JOIN purchases p ON pi.purchase_id = p.id
           WHERE pi.product_id = $1
             AND p.id != $2
             AND pi.unit_cost > 0
           ORDER BY p.purchased_at DESC, p.id DESC, pi.id DESC
           LIMIT 1`,
          [pId, purchaseId]
        );
        if (nextCostRes.rows.length > 0) {
          const nextCost = Number(nextCostRes.rows[0].unit_cost);
          await client.query(`UPDATE products SET cost_price = $1 WHERE id = $2`, [nextCost, pId]);
        }
      }
    }

    // Delete purchase (cascade deletes items)
    await client.query(`DELETE FROM purchases WHERE id = $1`, [purchaseId]);

    await client.query('COMMIT');
    return res.status(200).json({ deleted: true, id: purchaseId, purchaseNo });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Error deleting purchase:', err);
    return res.status(500).json({ error: 'Could not delete purchase' });
  } finally {
    client.release();
  }
});

// ============================================================================
// FINANCES & REPORTS API (Change Request CR-001)
// ============================================================================

export const EXPENSE_CATEGORIES = [
  'Printing',
  'Packaging',
  'Transport',
  'Rent',
  'Utilities',
  'Marketing',
  'Other'
] as const;

export const INCOME_CATEGORIES = [
  'Other income'
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
export type IncomeCategory = typeof INCOME_CATEGORIES[number];

function getTodayKolkata(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function parseAndValidateDateRange(req: express.Request, res: express.Response): { from: string; to: string } | null {
  const { from, to } = req.query;
  if (typeof from !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      typeof to !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      isNaN(Date.parse(from)) || isNaN(Date.parse(to))) {
    res.status(400).json({ error: "Valid 'from' and 'to' dates (YYYY-MM-DD) are required" });
    return null;
  }
  if (from > to) {
    res.status(400).json({ error: "Invalid date range: 'from' must be before or equal to 'to'" });
    return null;
  }
  return { from, to };
}

export interface FinanceRow {
  id: string | number;
  type: string;
  category: string;
  amount: string | number;
  record_date: string | Date;
  payment_method: string;
  note: string | null;
  created_at: string | Date;
}

export function toCamelFinance(row: FinanceRow) {
  let recordDate = '';
  if (row.record_date instanceof Date) {
    recordDate = row.record_date.toISOString().split('T')[0];
  } else if (typeof row.record_date === 'string') {
    recordDate = row.record_date.split('T')[0];
  }
  return {
    id: Number(row.id),
    type: String(row.type) as 'income' | 'expense',
    category: String(row.category),
    amount: Number(row.amount),
    recordDate,
    date: recordDate,
    paymentMethod: String(row.payment_method) as 'Cash' | 'UPI',
    note: row.note !== null && row.note !== undefined ? String(row.note) : '',
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
  };
}

async function fetchSummaryForRange(from: string, to: string) {
  // 1. Sales revenue in range
  const salesRes = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(total_amount), 0) AS total
     FROM sales
     WHERE (sold_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
       AND (sold_at AT TIME ZONE 'Asia/Kolkata')::date <= $2::date`,
    [from, to]
  );
  const salesRevenue = Number(salesRes.rows[0]?.total || 0);

  // 2. COGS (sum of sale_items qty * unit_cost for sales in range)
  const cogsRes = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(si.qty * si.unit_cost), 0) AS total
     FROM sale_items si
     JOIN sales s ON si.sale_id = s.id
     WHERE (s.sold_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
       AND (s.sold_at AT TIME ZONE 'Asia/Kolkata')::date <= $2::date`,
    [from, to]
  );
  const cogs = Number(Number(cogsRes.rows[0]?.total || 0).toFixed(2));

  // 3. Other income (manual entries in finance_records where type = 'income')
  const incomeRes = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM finance_records
     WHERE type = 'income'
       AND record_date >= $1::date
       AND record_date <= $2::date`,
    [from, to]
  );
  const otherIncome = Number(incomeRes.rows[0]?.total || 0);

  // 4. Operating expenses (manual entries in finance_records where type = 'expense')
  const expRes = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM finance_records
     WHERE type = 'expense'
       AND record_date >= $1::date
       AND record_date <= $2::date`,
    [from, to]
  );
  const expenses = Number(expRes.rows[0]?.total || 0);

  // 5. Purchases (purchases table total_cost in range)
  const purchRes = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(total_cost), 0) AS total
     FROM purchases
     WHERE (purchased_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
       AND (purchased_at AT TIME ZONE 'Asia/Kolkata')::date <= $2::date`,
    [from, to]
  );
  const purchases = Number(purchRes.rows[0]?.total || 0);

  // Computed metrics
  const moneyIn = Number((salesRevenue + otherIncome).toFixed(2));
  const moneyOut = Number((expenses + purchases).toFixed(2));
  const grossProfit = Number((salesRevenue - cogs).toFixed(2));
  const netProfit = Number((grossProfit + otherIncome - expenses).toFixed(2));

  return {
    salesRevenue: Number(salesRevenue.toFixed(2)),
    otherIncome: Number(otherIncome.toFixed(2)),
    moneyIn,
    expenses: Number(expenses.toFixed(2)),
    purchases: Number(purchases.toFixed(2)),
    moneyOut,
    cogs,
    grossProfit,
    netProfit
  };
}

// 1. Create finance entry
app.post('/api/finances', async (req, res) => {
  try {
    const { type, category, amount, recordDate, paymentMethod, note } = req.body;

    if (type !== 'income' && type !== 'expense') {
      return res.status(400).json({ error: "Type must be 'income' or 'expense'" });
    }

    if (type === 'expense') {
      if (!EXPENSE_CATEGORIES.includes(category as ExpenseCategory)) {
        return res.status(400).json({
          error: `Invalid expense category. Allowed categories: ${EXPENSE_CATEGORIES.join(', ')}`
        });
      }
    } else {
      if (!INCOME_CATEGORIES.includes(category as IncomeCategory)) {
        return res.status(400).json({
          error: `Invalid income category. Allowed categories: ${INCOME_CATEGORIES.join(', ')}`
        });
      }
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "Amount must be a number greater than 0" });
    }

    if (paymentMethod !== 'Cash' && paymentMethod !== 'UPI') {
      return res.status(400).json({ error: "Payment method must be 'Cash' or 'UPI'" });
    }

    if (note !== undefined && note !== null && typeof note === 'string' && note.length > 200) {
      return res.status(400).json({ error: "Note must be at most 200 characters" });
    }

    const cleanNote = typeof note === 'string' && note.trim().length > 0 ? note.trim() : null;
    const cleanDate = typeof recordDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(recordDate)
      ? recordDate
      : getTodayKolkata();

    const insertRes = await pool.query<FinanceRow>(
      `INSERT INTO finance_records (type, category, amount, record_date, payment_method, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, type, category, amount, record_date, payment_method, note, created_at`,
      [type, category, Number(numAmount.toFixed(2)), cleanDate, paymentMethod, cleanNote]
    );

    return res.status(201).json(toCamelFinance(insertRes.rows[0]));
  } catch (err: unknown) {
    console.error('Error creating finance record:', err);
    return res.status(500).json({ error: 'Failed to create finance record' });
  }
});

// 2. List finance entries
app.get('/api/finances', async (req, res) => {
  try {
    const { from, to, type } = req.query;
    let query = `
      SELECT id, type, category, amount, record_date, payment_method, note, created_at
      FROM finance_records
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      params.push(from);
      conditions.push(`record_date >= $${params.length}`);
    }
    if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      params.push(to);
      conditions.push(`record_date <= $${params.length}`);
    }
    if (type === 'income' || type === 'expense') {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY record_date DESC, id DESC`;

    const result = await pool.query<FinanceRow>(query, params);
    const records = result.rows.map(toCamelFinance);
    return res.json(records);
  } catch (err: unknown) {
    console.error('Error fetching finances:', err);
    return res.status(500).json({ error: 'Failed to fetch finances' });
  }
});

// 3. Delete finance entry
app.delete('/api/finances/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    if (!/^\d+$/.test(rawId)) {
      return res.status(400).json({ error: 'Invalid finance record ID' });
    }
    const id = Number(rawId);
    const result = await pool.query(
      `DELETE FROM finance_records WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Finance record not found' });
    }
    return res.status(200).json({ deleted: true, id });
  } catch (err: unknown) {
    console.error('Error deleting finance record:', err);
    return res.status(500).json({ error: 'Failed to delete finance record' });
  }
});

// ============================================================================
// REGISTERS API (Expense Register & Income Register)
// ============================================================================

// 1. Expense Register (Money Out: Expenses + Purchases)
app.get('/api/registers/expenses', async (req, res) => {
  try {
    const range = parseAndValidateDateRange(req, res);
    if (!range) return;
    const { from, to } = range;

    const rawSource = req.query.source;
    let sourceFilter = 'all';
    if (typeof rawSource === 'string' && rawSource.trim().length > 0) {
      const s = rawSource.trim().toLowerCase();
      if (s !== 'all' && s !== 'expense' && s !== 'purchase') {
        return res.status(400).json({ error: "Invalid source filter. Allowed: all, expense, purchase" });
      }
      sourceFilter = s;
    }

    let limit = 100;
    if (req.query.limit !== undefined) {
      const l = parseInt(String(req.query.limit), 10);
      if (isNaN(l) || l < 1) {
        return res.status(400).json({ error: "Invalid limit. Must be a positive integer" });
      }
      limit = l;
    }

    let offset = 0;
    if (req.query.offset !== undefined) {
      const o = parseInt(String(req.query.offset), 10);
      if (isNaN(o) || o < 0) {
        return res.status(400).json({ error: "Invalid offset. Must be a non-negative integer" });
      }
      offset = o;
    }

    const search = typeof req.query.search === 'string' && req.query.search.trim().length > 0
      ? req.query.search.trim()
      : null;

    const params: (string | number)[] = [from, to];
    const parts: string[] = [];

    if (sourceFilter !== 'purchase') {
      parts.push(`
        SELECT
          fr.id,
          'expense' AS source,
          fr.record_date::text AS date,
          fr.created_at,
          NULL::text AS reference,
          fr.category,
          COALESCE(fr.note, '') AS description,
          fr.amount::numeric AS amount,
          fr.payment_method AS "paymentMethod",
          TRUE AS deletable
        FROM finance_records fr
        WHERE fr.type = 'expense'
          AND fr.record_date >= $1::date
          AND fr.record_date <= $2::date
      `);
    }

    if (sourceFilter !== 'expense') {
      parts.push(`
        SELECT
          p.id,
          'purchase' AS source,
          TO_CHAR(p.purchased_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS date,
          p.purchased_at AS created_at,
          p.purchase_no AS reference,
          'Stock purchase' AS category,
          COALESCE(
            NULLIF(TRIM(p.note), ''),
            (
              SELECT STRING_AGG(
                pi.product_name || CASE WHEN pi.unit_type IS NOT NULL AND pi.unit_type <> '' THEN ' ' || pi.unit_type ELSE '' END || ' x' || TRIM(TO_CHAR(pi.qty, 'FM999999990.###')),
                ', '
                ORDER BY pi.id
              )
              FROM purchase_items pi
              WHERE pi.purchase_id = p.id
            ),
            ''
          ) AS description,
          p.total_cost::numeric AS amount,
          p.payment_method AS "paymentMethod",
          FALSE AS deletable
        FROM purchases p
        WHERE (p.purchased_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
          AND (p.purchased_at AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
      `);
    }

    let searchClause = '';
    if (search) {
      params.push(`%${search}%`);
      const pIdx = params.length;
      searchClause = ` WHERE (category ILIKE $${pIdx} OR description ILIKE $${pIdx} OR COALESCE(reference, '') ILIKE $${pIdx})`;
    }

    const cte = `
      WITH combined AS (
        ${parts.join('\nUNION ALL\n')}
      ),
      filtered AS (
        SELECT * FROM combined${searchClause}
      )
    `;

    const totalsQuery = `
      ${cte}
      SELECT
        COALESCE(SUM(CASE WHEN source = 'expense' THEN amount ELSE 0 END), 0) AS "expensesTotal",
        COALESCE(SUM(CASE WHEN source = 'purchase' THEN amount ELSE 0 END), 0) AS "purchasesTotal",
        COALESCE(SUM(amount), 0) AS "moneyOutTotal",
        COUNT(*)::int AS count
      FROM filtered;
    `;

    const entriesParams = [...params, limit, offset];
    const limitIdx = entriesParams.length - 1;
    const offsetIdx = entriesParams.length;

    const entriesQuery = `
      ${cte}
      SELECT
        id,
        source,
        date,
        reference,
        category,
        description,
        amount,
        "paymentMethod",
        deletable
      FROM filtered
      ORDER BY date DESC, created_at DESC, id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const [totalsRes, entriesRes] = await Promise.all([
      pool.query<{ expensesTotal: string; purchasesTotal: string; moneyOutTotal: string; count: number }>(totalsQuery, params),
      pool.query<{
        id: string | number;
        source: 'expense' | 'purchase';
        date: string;
        reference: string | null;
        category: string;
        description: string;
        amount: string | number;
        paymentMethod: string;
        deletable: boolean;
      }>(entriesQuery, entriesParams)
    ]);

    const t = totalsRes.rows[0];
    const expensesTotal = Number(Number(t?.expensesTotal || 0).toFixed(2));
    const purchasesTotal = Number(Number(t?.purchasesTotal || 0).toFixed(2));
    const moneyOutTotal = Number(Number(t?.moneyOutTotal || 0).toFixed(2));
    const count = Number(t?.count || 0);

    const entries = entriesRes.rows.map(r => ({
      id: Number(r.id),
      source: r.source,
      date: String(r.date),
      reference: r.reference !== null && r.reference !== undefined ? String(r.reference) : null,
      category: String(r.category),
      description: String(r.description || ''),
      amount: Number(r.amount),
      paymentMethod: String(r.paymentMethod),
      deletable: Boolean(r.deletable)
    }));

    return res.json({
      entries,
      totals: {
        expensesTotal,
        purchasesTotal,
        moneyOutTotal,
        count
      },
      expensesTotal,
      purchasesTotal,
      moneyOutTotal,
      count
    });
  } catch (err: unknown) {
    console.error('Error fetching expenses register:', err);
    return res.status(500).json({ error: 'Failed to fetch expenses register' });
  }
});

// 2. Income Register (Money In: Sales Revenue + Other Income)
app.get('/api/registers/income', async (req, res) => {
  try {
    const range = parseAndValidateDateRange(req, res);
    if (!range) return;
    const { from, to } = range;

    const rawSource = req.query.source;
    let sourceFilter = 'all';
    if (typeof rawSource === 'string' && rawSource.trim().length > 0) {
      const s = rawSource.trim().toLowerCase();
      if (s !== 'all' && s !== 'sale' && s !== 'other') {
        return res.status(400).json({ error: "Invalid source filter. Allowed: all, sale, other" });
      }
      sourceFilter = s;
    }

    let limit = 100;
    if (req.query.limit !== undefined) {
      const l = parseInt(String(req.query.limit), 10);
      if (isNaN(l) || l < 1) {
        return res.status(400).json({ error: "Invalid limit. Must be a positive integer" });
      }
      limit = l;
    }

    let offset = 0;
    if (req.query.offset !== undefined) {
      const o = parseInt(String(req.query.offset), 10);
      if (isNaN(o) || o < 0) {
        return res.status(400).json({ error: "Invalid offset. Must be a non-negative integer" });
      }
      offset = o;
    }

    const search = typeof req.query.search === 'string' && req.query.search.trim().length > 0
      ? req.query.search.trim()
      : null;

    const params: (string | number)[] = [from, to];
    const parts: string[] = [];

    if (sourceFilter !== 'other') {
      parts.push(`
        SELECT
          s.id,
          'sale' AS source,
          TO_CHAR(s.sold_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS date,
          s.sold_at AS created_at,
          s.sale_no AS reference,
          'Sales revenue' AS category,
          COALESCE(
            (
              SELECT STRING_AGG(
                si.product_name || CASE WHEN si.unit_type IS NOT NULL AND si.unit_type <> '' THEN ' ' || si.unit_type ELSE '' END || ' x' || TRIM(TO_CHAR(si.qty, 'FM999999990.###')),
                ', '
                ORDER BY si.id
              )
              FROM sale_items si
              WHERE si.sale_id = s.id
            ),
            ''
          ) AS description,
          s.total_amount::numeric AS amount,
          s.payment_method AS "paymentMethod",
          FALSE AS deletable
        FROM sales s
        WHERE (s.sold_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
          AND (s.sold_at AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
      `);
    }

    if (sourceFilter !== 'sale') {
      parts.push(`
        SELECT
          fr.id,
          'other' AS source,
          fr.record_date::text AS date,
          fr.created_at,
          NULL::text AS reference,
          fr.category,
          COALESCE(fr.note, '') AS description,
          fr.amount::numeric AS amount,
          fr.payment_method AS "paymentMethod",
          TRUE AS deletable
        FROM finance_records fr
        WHERE fr.type = 'income'
          AND fr.record_date >= $1::date
          AND fr.record_date <= $2::date
      `);
    }

    let searchClause = '';
    if (search) {
      params.push(`%${search}%`);
      const pIdx = params.length;
      searchClause = ` WHERE (category ILIKE $${pIdx} OR description ILIKE $${pIdx} OR COALESCE(reference, '') ILIKE $${pIdx})`;
    }

    const cte = `
      WITH combined AS (
        ${parts.join('\nUNION ALL\n')}
      ),
      filtered AS (
        SELECT * FROM combined${searchClause}
      )
    `;

    const totalsQuery = `
      ${cte}
      SELECT
        COALESCE(SUM(CASE WHEN source = 'sale' THEN amount ELSE 0 END), 0) AS "salesTotal",
        COALESCE(SUM(CASE WHEN source = 'other' THEN amount ELSE 0 END), 0) AS "otherIncomeTotal",
        COALESCE(SUM(amount), 0) AS "moneyInTotal",
        COUNT(*)::int AS count
      FROM filtered;
    `;

    const entriesParams = [...params, limit, offset];
    const limitIdx = entriesParams.length - 1;
    const offsetIdx = entriesParams.length;

    const entriesQuery = `
      ${cte}
      SELECT
        id,
        source,
        date,
        reference,
        category,
        description,
        amount,
        "paymentMethod",
        deletable
      FROM filtered
      ORDER BY date DESC, created_at DESC, id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const [totalsRes, entriesRes] = await Promise.all([
      pool.query<{ salesTotal: string; otherIncomeTotal: string; moneyInTotal: string; count: number }>(totalsQuery, params),
      pool.query<{
        id: string | number;
        source: 'sale' | 'other';
        date: string;
        reference: string | null;
        category: string;
        description: string;
        amount: string | number;
        paymentMethod: string;
        deletable: boolean;
      }>(entriesQuery, entriesParams)
    ]);

    const t = totalsRes.rows[0];
    const salesTotal = Number(Number(t?.salesTotal || 0).toFixed(2));
    const otherIncomeTotal = Number(Number(t?.otherIncomeTotal || 0).toFixed(2));
    const moneyInTotal = Number(Number(t?.moneyInTotal || 0).toFixed(2));
    const count = Number(t?.count || 0);

    const entries = entriesRes.rows.map(r => ({
      id: Number(r.id),
      source: r.source,
      date: String(r.date),
      reference: r.reference !== null && r.reference !== undefined ? String(r.reference) : null,
      category: String(r.category),
      description: String(r.description || ''),
      amount: Number(r.amount),
      paymentMethod: String(r.paymentMethod),
      deletable: Boolean(r.deletable)
    }));

    return res.json({
      entries,
      totals: {
        salesTotal,
        otherIncomeTotal,
        moneyInTotal,
        count
      },
      salesTotal,
      otherIncomeTotal,
      moneyInTotal,
      count
    });
  } catch (err: unknown) {
    console.error('Error fetching income register:', err);
    return res.status(500).json({ error: 'Failed to fetch income register' });
  }
});


// 4. Reports Summary
app.get('/api/reports/summary', async (req, res) => {
  try {
    const range = parseAndValidateDateRange(req, res);
    if (!range) return;
    const summary = await fetchSummaryForRange(range.from, range.to);
    return res.json(summary);
  } catch (err: unknown) {
    console.error('Error fetching summary report:', err);
    return res.status(500).json({ error: 'Could not fetch summary report' });
  }
});

// 5. Reports Profit & Loss (PnL)
app.get('/api/reports/pnl', async (req, res) => {
  try {
    const range = parseAndValidateDateRange(req, res);
    if (!range) return;

    const { from, to } = range;
    const currentSummary = await fetchSummaryForRange(from, to);

    // Compute previous period of equal length
    const d1 = new Date(from + 'T00:00:00Z');
    const d2 = new Date(to + 'T00:00:00Z');
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const prevD2 = new Date(d1.getTime() - (1000 * 60 * 60 * 24));
    const prevD1 = new Date(prevD2.getTime() - ((diffDays - 1) * 1000 * 60 * 60 * 24));
    const prevFrom = prevD1.toISOString().split('T')[0];
    const prevTo = prevD2.toISOString().split('T')[0];

    const previousSummary = await fetchSummaryForRange(prevFrom, prevTo);

    // Expenses by category for current period
    const catRes = await pool.query<{ category: string; amount: string }>(
      `SELECT category, COALESCE(SUM(amount), 0) AS amount
       FROM finance_records
       WHERE type = 'expense'
         AND record_date >= $1::date
         AND record_date <= $2::date
       GROUP BY category`,
      [from, to]
    );
    const catMap = new Map<string, number>();
    for (const row of catRes.rows) {
      catMap.set(row.category, Number(row.amount));
    }

    // Expenses by category for previous period
    const prevCatRes = await pool.query<{ category: string; amount: string }>(
      `SELECT category, COALESCE(SUM(amount), 0) AS amount
       FROM finance_records
       WHERE type = 'expense'
         AND record_date >= $1::date
         AND record_date <= $2::date
       GROUP BY category`,
      [prevFrom, prevTo]
    );
    const prevCatMap = new Map<string, number>();
    for (const row of prevCatRes.rows) {
      prevCatMap.set(row.category, Number(row.amount));
    }

    const expensesByCategory = EXPENSE_CATEGORIES.map((cat) => {
      const curAmt = Number((catMap.get(cat) || 0).toFixed(2));
      const prevAmt = Number((prevCatMap.get(cat) || 0).toFixed(2));
      const chgAmt = Number((curAmt - prevAmt).toFixed(2));
      const chgPct = prevAmt !== 0 ? Number((((curAmt - prevAmt) / Math.abs(prevAmt)) * 100).toFixed(2)) : null;
      return {
        category: cat,
        amount: curAmt,
        previousAmount: prevAmt,
        changeAmount: chgAmt,
        changePercent: chgPct
      };
    });

    const marginPercent = currentSummary.salesRevenue > 0
      ? Number(((currentSummary.netProfit / currentSummary.salesRevenue) * 100).toFixed(2))
      : 0;

    const previousMarginPercent = previousSummary.salesRevenue > 0
      ? Number(((previousSummary.netProfit / previousSummary.salesRevenue) * 100).toFixed(2))
      : 0;

    const computeLineChange = (current: number, previous: number) => {
      const changeAmount = Number((current - previous).toFixed(2));
      const changePercent = previous !== 0
        ? Number((((current - previous) / Math.abs(previous)) * 100).toFixed(2))
        : null;
      return { current, previous, changeAmount, changePercent };
    };

    const changes = {
      salesRevenue: computeLineChange(currentSummary.salesRevenue, previousSummary.salesRevenue),
      cogs: computeLineChange(currentSummary.cogs, previousSummary.cogs),
      grossProfit: computeLineChange(currentSummary.grossProfit, previousSummary.grossProfit),
      otherIncome: computeLineChange(currentSummary.otherIncome, previousSummary.otherIncome),
      expenses: computeLineChange(currentSummary.expenses, previousSummary.expenses),
      netProfit: computeLineChange(currentSummary.netProfit, previousSummary.netProfit),
      marginPercent: computeLineChange(marginPercent, previousMarginPercent),
      moneyIn: computeLineChange(currentSummary.moneyIn, previousSummary.moneyIn),
      moneyOut: computeLineChange(currentSummary.moneyOut, previousSummary.moneyOut),
      purchases: computeLineChange(currentSummary.purchases, previousSummary.purchases)
    };

    return res.json({
      ...currentSummary,
      summary: currentSummary,
      previousSummary,
      expensesByCategory,
      marginPercent,
      previousMarginPercent,
      changes,
      currentRange: { from, to },
      previousRange: { from: prevFrom, to: prevTo }
    });
  } catch (err: unknown) {
    console.error('Error fetching PnL report:', err);
    return res.status(500).json({ error: 'Could not fetch PnL report' });
  }
});

// 6. Reports Expenses
app.get('/api/reports/expenses', async (req, res) => {
  try {
    const range = parseAndValidateDateRange(req, res);
    if (!range) return;
    const { from, to } = range;

    const catRes = await pool.query<{ category: string; amount: string }>(
      `SELECT category, COALESCE(SUM(amount), 0) AS amount
       FROM finance_records
       WHERE type = 'expense'
         AND record_date >= $1::date
         AND record_date <= $2::date
       GROUP BY category
       ORDER BY amount DESC`,
      [from, to]
    );

    const totalsByCategory = catRes.rows.map(r => ({
      category: r.category,
      amount: Number(Number(r.amount).toFixed(2))
    }));

    const entriesRes = await pool.query<FinanceRow>(
      `SELECT id, type, category, amount, record_date, payment_method, note, created_at
       FROM finance_records
       WHERE type = 'expense'
         AND record_date >= $1::date
         AND record_date <= $2::date
       ORDER BY record_date DESC, id DESC`,
      [from, to]
    );

    const entries = entriesRes.rows.map(toCamelFinance);
    const totalExpenses = Number(totalsByCategory.reduce((sum, c) => sum + c.amount, 0).toFixed(2));

    return res.json({
      totalExpenses,
      totalsByCategory,
      entries
    });
  } catch (err: unknown) {
    console.error('Error fetching expenses report:', err);
    return res.status(500).json({ error: 'Could not fetch expenses report' });
  }
});

// 7. Reports Charts
app.get('/api/reports/charts', async (req, res) => {
  try {
    const range = parseAndValidateDateRange(req, res);
    if (!range) return;
    const { from, to } = range;

    const d1 = new Date(from + 'T00:00:00Z');
    const d2 = new Date(to + 'T00:00:00Z');
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    let group = req.query.group;
    if (group !== 'day' && group !== 'month') {
      group = diffDays <= 31 ? 'day' : 'month';
    }

    // Generate unbroken periods
    const periods: string[] = [];
    if (group === 'day') {
      const cur = new Date(from + 'T00:00:00Z');
      const end = new Date(to + 'T00:00:00Z');
      while (cur <= end) {
        periods.push(cur.toISOString().split('T')[0]);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    } else {
      const [startYear, startMonth] = from.split('-').map(Number);
      const [endYear, endMonth] = to.split('-').map(Number);
      let y = startYear;
      let m = startMonth;
      while (y < endYear || (y === endYear && m <= endMonth)) {
        periods.push(`${y}-${String(m).padStart(2, '0')}`);
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    }

    const periodFormat = group === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';

    // 1. Sales by period
    const salesRes = await pool.query<{ period: string; amount: string }>(
      `SELECT TO_CHAR(sold_at AT TIME ZONE 'Asia/Kolkata', '${periodFormat}') AS period,
              COALESCE(SUM(total_amount), 0) AS amount
       FROM sales
       WHERE (sold_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
         AND (sold_at AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
       GROUP BY period`,
      [from, to]
    );
    const salesMap = new Map<string, number>();
    for (const r of salesRes.rows) {
      salesMap.set(r.period, Number(r.amount));
    }

    // 2. COGS by period
    const cogsRes = await pool.query<{ period: string; amount: string }>(
      `SELECT TO_CHAR(s.sold_at AT TIME ZONE 'Asia/Kolkata', '${periodFormat}') AS period,
              COALESCE(SUM(si.qty * si.unit_cost), 0) AS amount
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE (s.sold_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
         AND (s.sold_at AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
       GROUP BY period`,
      [from, to]
    );
    const cogsMap = new Map<string, number>();
    for (const r of cogsRes.rows) {
      cogsMap.set(r.period, Number(r.amount));
    }

    // 3. Finances (income and expense) by period
    const finRes = await pool.query<{ period: string; type: string; amount: string }>(
      `SELECT TO_CHAR(record_date, '${periodFormat}') AS period,
              type,
              COALESCE(SUM(amount), 0) AS amount
       FROM finance_records
       WHERE record_date >= $1::date
         AND record_date <= $2::date
       GROUP BY period, type`,
      [from, to]
    );
    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    for (const r of finRes.rows) {
      if (r.type === 'income') {
        incomeMap.set(r.period, Number(r.amount));
      } else if (r.type === 'expense') {
        expenseMap.set(r.period, Number(r.amount));
      }
    }

    // 4. Purchases by period
    const purchRes = await pool.query<{ period: string; amount: string }>(
      `SELECT TO_CHAR(purchased_at AT TIME ZONE 'Asia/Kolkata', '${periodFormat}') AS period,
              COALESCE(SUM(total_cost), 0) AS amount
       FROM purchases
       WHERE (purchased_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
         AND (purchased_at AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
       GROUP BY period`,
      [from, to]
    );
    const purchMap = new Map<string, number>();
    for (const r of purchRes.rows) {
      purchMap.set(r.period, Number(r.amount));
    }

    // Merge series for every period without gaps
    const incomeVsExpenses: Array<{ period: string; moneyIn: number; expenses: number }> = [];
    const salesOverTime: Array<{ period: string; amount: number }> = [];
    const purchasesOverTime: Array<{ period: string; amount: number }> = [];
    const profitTrend: Array<{ period: string; netProfit: number }> = [];

    for (const p of periods) {
      const sRev = salesMap.get(p) || 0;
      const oInc = incomeMap.get(p) || 0;
      const expAmt = expenseMap.get(p) || 0;
      const purAmt = purchMap.get(p) || 0;
      const cogsAmt = cogsMap.get(p) || 0;

      const moneyIn = Number((sRev + oInc).toFixed(2));
      const expensesVal = Number(expAmt.toFixed(2));
      const netProfit = Number(((sRev - cogsAmt) + oInc - expAmt).toFixed(2));

      incomeVsExpenses.push({ period: p, moneyIn, expenses: expensesVal });
      salesOverTime.push({ period: p, amount: Number(sRev.toFixed(2)) });
      purchasesOverTime.push({ period: p, amount: Number(purAmt.toFixed(2)) });
      profitTrend.push({ period: p, netProfit });
    }

    // 5. Top 10 selling products
    const topRes = await pool.query<{ name: string; unitType: string; qty: string; revenue: string }>(
      `SELECT si.product_name AS name,
              si.unit_type AS "unitType",
              ROUND(SUM(si.qty), 3) AS qty,
              ROUND(SUM(si.line_total), 2) AS revenue
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE (s.sold_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
         AND (s.sold_at AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
       GROUP BY si.product_name, si.unit_type
       ORDER BY qty DESC
       LIMIT 10`,
      [from, to]
    );
    const topSelling = topRes.rows.map(r => ({
      name: r.name,
      unitType: r.unitType,
      qty: Number(r.qty),
      revenue: Number(r.revenue)
    }));

    // 6. Stock levels
    const stockRes = await pool.query<{ name: string; unitType: string; qty: string; status: 'out' | 'low' | 'ok' }>(
      `SELECT name,
              unit_type AS "unitType",
              ROUND(stock_qty, 3) AS qty,
              CASE
                WHEN stock_qty <= 0 THEN 'out'
                WHEN stock_qty <= 10 THEN 'low'
                ELSE 'ok'
              END AS status
       FROM products
       ORDER BY stock_qty ASC, name ASC`
    );
    const stockLevels = stockRes.rows.map(r => ({
      name: r.name,
      unitType: r.unitType,
      qty: Number(r.qty),
      status: r.status
    }));

    return res.json({
      group,
      incomeVsExpenses,
      salesOverTime,
      purchasesOverTime,
      profitTrend,
      topSelling,
      stockLevels
    });
  } catch (err: unknown) {
    console.error('Error fetching charts report:', err);
    return res.status(500).json({ error: 'Could not fetch charts report' });
  }
});

// Fallback 404 for unmatched API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Serve static production build if dist directory exists
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// Start listening
const server = app.listen(PORT, HOST, () => {
  console.log(`TrackOps API Server listening on http://${HOST}:${PORT}`);
});

export { app, server };
