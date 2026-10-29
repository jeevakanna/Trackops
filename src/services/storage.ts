/**
 * TrackOps Storage Service
 *
 * All persistent business data is managed via the REST API and PostgreSQL database.
 * No sample or seed data is written to localStorage.
 * Legacy localStorage keys from earlier versions are cleaned up on startup.
 */

import { Product, SaleRecord, PurchaseRecord, FinanceRecord, StockMovement } from '../types';

export const LEGACY_STORAGE_KEYS = [
  'trackops_version_v2',
  'trackops_products_v2',
  'trackops_sales_v2',
  'trackops_purchases_v2',
  'trackops_finances_v2',
  'trackops_movements_v2',
  'trackops_products_v1',
  'trackops_sales_v1',
  'trackops_purchases_v1',
  'trackops_finances_v1',
  'trackops_movements_v1',
  'trackops_data_version'
];

/**
 * Task 7: One-time startup cleanup to delete old localStorage keys
 * that earlier versions of the app wrote, so sample data disappears.
 */
export function cleanupLegacyLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    // Remove specific legacy keys
    for (const key of LEGACY_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }

    // Remove any other trackops_* key, preserving optional settings like theme
    const allKeys = Object.keys(window.localStorage);
    for (const key of allKeys) {
      if (key.startsWith('trackops_') && key !== 'trackops_theme') {
        window.localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.warn('LocalStorage cleanup failed:', err);
  }
}

function generateUniqueId(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  let rand = '';
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    rand = crypto.randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase();
  } else {
    rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  return `${prefix}-${ts}-${rand}`;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  data: {
    products: Product[];
    sales: SaleRecord[];
    purchases: PurchaseRecord[];
    finances: FinanceRecord[];
    movements: StockMovement[];
  };
}

class StorageService {
  private products: Product[] = [];
  private sales: SaleRecord[] = [];
  private purchases: PurchaseRecord[] = [];
  private finances: FinanceRecord[] = [];
  private movements: StockMovement[] = [];

  constructor() {
    // Clean up legacy localStorage keys on initialization
    cleanupLegacyLocalStorage();
  }

  private notifyUpdate() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('trackops:data_updated'));
    }
  }

  // --- PRODUCTS ---

  public async getProducts(): Promise<Product[]> {
    return [...this.products];
  }

  public async getProductById(id: number): Promise<Product | null> {
    return this.products.find(p => p.id === id) || null;
  }

  public async saveProduct(product: Omit<Product, 'id' | 'sku'> & { id?: number; sku?: string }): Promise<Product> {
    let saved: Product;

    if (product.id) {
      const idx = this.products.findIndex(p => p.id === product.id);
      if (idx >= 0) {
        saved = {
          ...this.products[idx],
          ...product,
          id: product.id,
          sku: product.sku || this.products[idx].sku
        };
        this.products[idx] = saved;
      } else {
        saved = {
          ...product,
          id: product.id,
          sku: product.sku || `SKU-${1000 + product.id}`
        };
        this.products.unshift(saved);
      }
    } else {
      const maxId = this.products.length ? Math.max(...this.products.map(p => p.id)) : 0;
      const newId = maxId + 1;
      saved = {
        ...product,
        id: newId,
        sku: product.sku || `SKU-${1000 + newId}`
      };
      this.products.unshift(saved);
    }

    this.notifyUpdate();
    return saved;
  }

  public async deleteProduct(id: number): Promise<boolean> {
    const prevLen = this.products.length;
    this.products = this.products.filter(p => p.id !== id);
    if (this.products.length !== prevLen) {
      this.notifyUpdate();
      return true;
    }
    return false;
  }

  public async adjustStock(
    id: number,
    delta: number,
    reason: string = 'Correction',
    note?: string
  ): Promise<Product> {
    const product = this.products.find(p => p.id === id);
    if (!product) {
      throw new Error(`Product with ID ${id} not found.`);
    }

    const newQty = product.qty + delta;
    if (newQty < 0) {
      throw new Error(`Adjustment would result in negative stock (${newQty}). Current stock is ${product.qty}.`);
    }

    product.qty = newQty;
    const movement: StockMovement = {
      id: generateUniqueId('MOV'),
      timestamp: new Date().toISOString(),
      productId: product.id,
      productName: product.name,
      type: 'adjustment',
      changeQty: delta,
      balanceAfter: product.qty,
      reason,
      note: note || `Stock adjustment (${reason})`
    };

    this.movements.unshift(movement);
    this.notifyUpdate();
    return product;
  }

  // --- SALES ---

  public async getSales(): Promise<SaleRecord[]> {
    return [...this.sales];
  }

  public async getSaleById(id: string): Promise<SaleRecord | null> {
    return this.sales.find(s => s.id === id) || null;
  }

  public async recordSale(saleData: {
    items: { productId: number; name: string; unit: string; qty: number; price: number; total: number }[];
    discount?: number;
    paymentMethod: 'Cash' | 'UPI';
  }): Promise<SaleRecord> {
    if (!saleData.items || saleData.items.length === 0) {
      throw new Error('Sale must contain at least one line item.');
    }

    for (const item of saleData.items) {
      const product = this.products.find(p => p.id === item.productId);
      if (!product) {
        throw new Error(`Product "${item.name}" not found in inventory.`);
      }
      if (item.qty > product.qty) {
        throw new Error(`Insufficient stock for "${product.name}". Available: ${product.qty} ${product.unit}, requested: ${item.qty} ${item.unit}.`);
      }
      if (item.qty <= 0) {
        throw new Error(`Quantity for "${item.name}" must be greater than zero.`);
      }
    }

    const saleId = generateUniqueId('S');
    const timestamp = new Date().toISOString();

    const processedItems = saleData.items.map(item => {
      const product = this.products.find(p => p.id === item.productId)!;
      product.qty -= item.qty;

      this.movements.unshift({
        id: generateUniqueId('MOV'),
        timestamp,
        productId: product.id,
        productName: product.name,
        type: 'sale',
        changeQty: -item.qty,
        balanceAfter: product.qty,
        referenceId: saleId,
        note: `Sold via Bill ${saleId}`
      });

      return {
        productId: item.productId,
        name: item.name,
        unit: item.unit,
        qty: item.qty,
        cost: product.cost,
        price: item.price,
        total: item.total
      };
    });

    const subtotal = processedItems.reduce((acc, i) => acc + i.total, 0);
    const discount = Math.min(subtotal, Math.max(0, saleData.discount || 0));
    const grandTotal = Math.max(0, subtotal - discount);

    const saleRecord: SaleRecord = {
      id: saleId,
      timestamp,
      items: processedItems,
      subtotal,
      discount,
      grandTotal,
      paymentMethod: saleData.paymentMethod
    };

    const financeRecord: FinanceRecord = {
      id: generateUniqueId('FIN'),
      timestamp,
      type: 'income',
      category: 'Sales Revenue',
      description: `Counter Sale Bill #${saleId} (${processedItems.length} items)`,
      amount: grandTotal,
      paymentMethod: saleData.paymentMethod,
      referenceType: 'sale',
      referenceId: saleId
    };

    this.sales.unshift(saleRecord);
    this.finances.unshift(financeRecord);
    this.notifyUpdate();
    return saleRecord;
  }

  // --- PURCHASES ---

  public async getPurchases(): Promise<PurchaseRecord[]> {
    return [...this.purchases];
  }

  public async getPurchaseById(id: string): Promise<PurchaseRecord | null> {
    return this.purchases.find(p => p.id === id) || null;
  }

  public async recordPurchase(purchaseData: {
    items: { productId?: number; name: string; unit: string; qty: number; cost: number; total: number }[];
    paymentMethod: 'Cash' | 'UPI';
    note?: string;
  }): Promise<PurchaseRecord> {
    if (!purchaseData.items || purchaseData.items.length === 0) {
      throw new Error('Purchase must contain at least one line item.');
    }

    for (const item of purchaseData.items) {
      if (item.qty <= 0) {
        throw new Error(`Quantity for "${item.name}" must be greater than zero.`);
      }
      if (item.cost < 0) {
        throw new Error(`Cost price for "${item.name}" cannot be negative.`);
      }
    }

    const purchaseId = generateUniqueId('P');
    const timestamp = new Date().toISOString();

    const processedItems = purchaseData.items.map(item => {
      let product = item.productId ? this.products.find(p => p.id === item.productId) : null;
      if (!product) {
        const maxId = this.products.length ? Math.max(...this.products.map(p => p.id)) : 0;
        const newId = maxId + 1;
        product = {
          id: newId,
          sku: `SKU-${1000 + newId}`,
          name: item.name.trim(),
          unit: item.unit.trim() || 'Unit',
          qty: 0,
          cost: item.cost,
          sell: Math.round(item.cost * 1.3),
          reorder: 5
        };
        this.products.unshift(product);
      }

      product.qty += item.qty;
      if (item.cost > 0) {
        product.cost = item.cost;
      }

      this.movements.unshift({
        id: generateUniqueId('MOV'),
        timestamp,
        productId: product.id,
        productName: product.name,
        type: 'purchase',
        changeQty: item.qty,
        balanceAfter: product.qty,
        referenceId: purchaseId,
        note: `Restocked via Voucher ${purchaseId}`
      });

      return {
        productId: product.id,
        name: product.name,
        unit: product.unit,
        qty: item.qty,
        cost: item.cost,
        total: item.total
      };
    });

    const grandTotal = processedItems.reduce((acc, i) => acc + i.total, 0);

    const purchaseRecord: PurchaseRecord = {
      id: purchaseId,
      timestamp,
      items: processedItems,
      grandTotal,
      paymentMethod: purchaseData.paymentMethod,
      note: purchaseData.note?.trim() || undefined
    };

    const financeRecord: FinanceRecord = {
      id: generateUniqueId('FIN'),
      timestamp,
      type: 'expense',
      category: 'Stock Purchase',
      description: `Stock Procurement Voucher #${purchaseId}${purchaseData.note ? ` • ${purchaseData.note}` : ''}`,
      amount: grandTotal,
      paymentMethod: purchaseData.paymentMethod,
      referenceType: 'purchase',
      referenceId: purchaseId
    };

    this.purchases.unshift(purchaseRecord);
    this.finances.unshift(financeRecord);
    this.notifyUpdate();
    return purchaseRecord;
  }

  // --- FINANCES ---

  public async getFinances(): Promise<FinanceRecord[]> {
    return [...this.finances];
  }

  public async addFinance(entry: Omit<FinanceRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): Promise<FinanceRecord> {
    if (entry.amount <= 0) {
      throw new Error('Finance amount must be greater than zero.');
    }

    const record: FinanceRecord = {
      ...entry,
      id: entry.id || generateUniqueId('FIN'),
      timestamp: entry.timestamp || new Date().toISOString()
    };

    this.finances.unshift(record);
    this.notifyUpdate();
    return record;
  }

  public async deleteFinance(id: string): Promise<boolean> {
    const target = this.finances.find(f => f.id === id);
    if (!target) return false;

    if (target.referenceType && target.referenceType !== 'manual') {
      throw new Error('System generated records linked to sales or purchases cannot be deleted from finances.');
    }

    this.finances = this.finances.filter(f => f.id !== id);
    this.notifyUpdate();
    return true;
  }

  // --- STOCK MOVEMENTS ---

  public async getMovements(): Promise<StockMovement[]> {
    return [...this.movements];
  }

  public async getMovementsByProduct(productId: number): Promise<StockMovement[]> {
    return this.movements.filter(m => m.productId === productId);
  }

  // --- DATA SAFETY & BACKUP ---

  public async createBackup(): Promise<string> {
    const backup: BackupData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      data: {
        products: [...this.products],
        sales: [...this.sales],
        purchases: [...this.purchases],
        finances: [...this.finances],
        movements: [...this.movements]
      }
    };
    return JSON.stringify(backup, null, 2);
  }

  public async restoreBackup(jsonString: string): Promise<void> {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON file format.');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid backup file: Root must be a JSON object.');
    }

    const data = parsed.data || parsed;
    if (
      !Array.isArray(data.products) ||
      !Array.isArray(data.sales) ||
      !Array.isArray(data.purchases) ||
      !Array.isArray(data.finances)
    ) {
      throw new Error('Invalid backup format: Must contain products, sales, purchases, and finances arrays.');
    }

    this.products = [...data.products];
    this.sales = [...data.sales];
    this.purchases = [...data.purchases];
    this.finances = [...data.finances];
    this.movements = [...(data.movements || [])];
    this.notifyUpdate();
  }

  public async clearAllData(): Promise<void> {
    this.products = [];
    this.sales = [];
    this.purchases = [];
    this.finances = [];
    this.movements = [];
    cleanupLegacyLocalStorage();
    this.notifyUpdate();
  }
}

export const storage = new StorageService();
