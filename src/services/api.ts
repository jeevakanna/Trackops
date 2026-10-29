import {
  ApiProduct,
  ApiFinanceRecord,
  ReportSummary,
  PnlReport,
  ExpensesReport,
  ChartsReport,
  ExpenseRegisterResponse,
  IncomeRegisterResponse
} from '../types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface CreateProductInput {
  name: string;
  unitType: 'A4' | 'A3' | 'A5' | 'Polaroid' | string;
  stockQty?: number;
  costPrice: number;
  sellPrice: number;
}

/**
 * Small fetch client for TrackOps backend.
 * Uses relative "/api" URLs only to rely on Vite proxy in dev and same-origin in prod.
 */
export async function fetchProducts(search?: string): Promise<ApiProduct[]> {
  const query = search && search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const response = await fetch(`/api/products${query}`);

  if (!response.ok) {
    let errorMessage = `Failed to fetch products (${response.status})`;
    try {
      const data = await response.json();
      if (data && data.error) {
        errorMessage = data.error;
      }
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

// Alias for fetchProducts
export const getProducts = fetchProducts;

export async function fetchProductById(id: number | string): Promise<ApiProduct> {
  const response = await fetch(`/api/products/${id}`);

  if (!response.ok) {
    let errorMessage = `Failed to fetch product ${id} (${response.status})`;
    try {
      const data = await response.json();
      if (data && data.error) {
        errorMessage = data.error;
      }
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export const getProductById = fetchProductById;

export async function createProduct(data: CreateProductInput): Promise<ApiProduct> {
  const response = await fetch('/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMessage = `Failed to create product (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.error) {
        errorMessage = body.error;
      }
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function setStock(
  id: number | string,
  data: { stockQty: number; note?: string; reason?: string }
): Promise<ApiProduct> {
  const response = await fetch(`/api/products/${id}/stock`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMessage = `Failed to update stock (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.error) {
        errorMessage = body.error;
      }
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function deleteProduct(
  id: number | string
): Promise<{ deleted: boolean; id: number; name: string }> {
  const response = await fetch(`/api/products/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    let errorMessage = `Failed to delete product (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.error) {
        errorMessage = body.error;
      }
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function createSale(data: {
  paymentMethod: 'Cash' | 'UPI';
  soldAt?: string;
  items: Array<{ productId: number; qty: number }>;
}): Promise<import('../types').ApiSale> {
  const response = await fetch('/api/sales', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMessage = `Failed to create sale (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.error) {
        errorMessage = body.error;
      }
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function updateSale(
  id: number | string,
  data: {
    paymentMethod: 'Cash' | 'UPI';
    soldAt?: string;
    items: Array<{ productId: number; qty: number }>;
  }
): Promise<import('../types').ApiSale> {
  const response = await fetch(`/api/sales/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMessage = `Failed to update sale (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.error) errorMessage = body.error;
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function deleteSale(
  id: number | string
): Promise<{ deleted: boolean; id: number; saleNo: string }> {
  const response = await fetch(`/api/sales/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    let errorMessage = `Failed to delete sale (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.error) errorMessage = body.error;
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function listSales(filter?: { from?: string; to?: string; search?: string }): Promise<import('../types').ApiSaleSummary[]> {
  const params = new URLSearchParams();
  if (filter?.from) params.set('from', filter.from);
  if (filter?.to) params.set('to', filter.to);
  if (filter?.search) params.set('search', filter.search);
  const query = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(`/api/sales${query}`);
  if (!response.ok) {
    let errorMessage = `Failed to fetch sales (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.error) errorMessage = body.error;
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export const getSales = listSales;

export async function getSale(id: number | string): Promise<import('../types').ApiSale> {
  const response = await fetch(`/api/sales/${id}`);
  if (!response.ok) {
    let errorMessage = `Failed to fetch sale ${id} (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.error) errorMessage = body.error;
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function createPurchase(data: {
  paymentMethod: 'Cash' | 'UPI';
  note?: string;
  purchasedAt?: string;
  items: Array<{ productId: number; qty: number; cost: number }>;
}): Promise<import('../types').ApiPurchase> {
  const response = await fetch('/api/purchases', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMessage = `Failed to create purchase (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.error) {
        errorMessage = body.error;
      }
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function updatePurchase(
  id: number | string,
  data: {
    paymentMethod: 'Cash' | 'UPI';
    note?: string;
    purchasedAt?: string;
    items: Array<{ productId: number; qty: number; cost: number }>;
  }
): Promise<import('../types').ApiPurchase> {
  const response = await fetch(`/api/purchases/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMessage = `Failed to update purchase (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.error) errorMessage = body.error;
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function deletePurchase(
  id: number | string
): Promise<{ deleted: boolean; id: number; purchaseNo: string }> {
  const response = await fetch(`/api/purchases/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    let errorMessage = `Failed to delete purchase (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.error) errorMessage = body.error;
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function listPurchases(filter?: { from?: string; to?: string; search?: string }): Promise<import('../types').ApiPurchaseSummary[]> {
  const params = new URLSearchParams();
  if (filter?.from) params.set('from', filter.from);
  if (filter?.to) params.set('to', filter.to);
  if (filter?.search) params.set('search', filter.search);
  const query = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(`/api/purchases${query}`);
  if (!response.ok) {
    let errorMessage = `Failed to fetch purchases (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.error) errorMessage = body.error;
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export const getPurchases = listPurchases;

export async function getPurchase(id: number | string): Promise<import('../types').ApiPurchase> {
  const response = await fetch(`/api/purchases/${id}`);
  if (!response.ok) {
    let errorMessage = `Failed to fetch purchase ${id} (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.error) errorMessage = body.error;
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function checkHealth(): Promise<{ ok: boolean }> {
  const response = await fetch('/api/health');

  if (!response.ok) {
    throw new ApiError(`Health check failed (${response.status})`, response.status);
  }

  return response.json();
}

// ============================================================================
// FINANCES & REPORTS API CLIENT (CR-001)
// ============================================================================

export interface CreateFinanceInput {
  type: 'income' | 'expense';
  category: string;
  amount: number;
  recordDate?: string;
  paymentMethod: 'Cash' | 'UPI';
  note?: string;
}

export async function createFinanceRecord(input: CreateFinanceInput): Promise<ApiFinanceRecord> {
  const response = await fetch('/api/finances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    let errorMessage = `Failed to create finance record (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) errorMessage = body.error;
    } catch {
      // Ignore
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function getFinances(filter?: { from?: string; to?: string; type?: 'income' | 'expense' }): Promise<ApiFinanceRecord[]> {
  const params = new URLSearchParams();
  if (filter?.from) params.set('from', filter.from);
  if (filter?.to) params.set('to', filter.to);
  if (filter?.type) params.set('type', filter.type);
  const query = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(`/api/finances${query}`);
  if (!response.ok) {
    let errorMessage = `Failed to fetch finances (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) errorMessage = body.error;
    } catch {
      // Ignore
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function deleteFinanceRecord(id: number | string): Promise<{ deleted: boolean; id: number }> {
  const response = await fetch(`/api/finances/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    let errorMessage = `Failed to delete finance record (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) errorMessage = body.error;
    } catch {
      // Ignore
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function getReportSummary(from: string, to: string): Promise<ReportSummary> {
  const params = new URLSearchParams({ from, to });
  const response = await fetch(`/api/reports/summary?${params.toString()}`);

  if (!response.ok) {
    let errorMessage = `Failed to fetch report summary (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) errorMessage = body.error;
    } catch {
      // Ignore
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function getPnlReport(from: string, to: string): Promise<PnlReport> {
  const params = new URLSearchParams({ from, to });
  const response = await fetch(`/api/reports/pnl?${params.toString()}`);

  if (!response.ok) {
    let errorMessage = `Failed to fetch PnL report (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) errorMessage = body.error;
    } catch {
      // Ignore
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function getExpensesReport(from: string, to: string): Promise<ExpensesReport> {
  const params = new URLSearchParams({ from, to });
  const response = await fetch(`/api/reports/expenses?${params.toString()}`);

  if (!response.ok) {
    let errorMessage = `Failed to fetch expenses report (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) errorMessage = body.error;
    } catch {
      // Ignore
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function getChartsReport(from: string, to: string, group?: 'day' | 'month'): Promise<ChartsReport> {
  const params = new URLSearchParams({ from, to });
  if (group) params.set('group', group);
  const response = await fetch(`/api/reports/charts?${params.toString()}`);

  if (!response.ok) {
    let errorMessage = `Failed to fetch charts report (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) errorMessage = body.error;
    } catch {
      // Ignore
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

// ============================================================================
// REGISTERS API CLIENT (CR-002)
// ============================================================================

export interface RegisterQueryFilter {
  from: string;
  to: string;
  source?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getExpenseRegister(filter: RegisterQueryFilter): Promise<ExpenseRegisterResponse> {
  const params = new URLSearchParams({ from: filter.from, to: filter.to });
  if (filter.source && filter.source !== 'all') params.set('source', filter.source);
  if (filter.search && filter.search.trim()) params.set('search', filter.search.trim());
  if (filter.limit !== undefined) params.set('limit', String(filter.limit));
  if (filter.offset !== undefined) params.set('offset', String(filter.offset));

  const response = await fetch(`/api/registers/expenses?${params.toString()}`);
  if (!response.ok) {
    let errorMessage = `Failed to fetch expenses register (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) errorMessage = body.error;
    } catch {
      // Ignore
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function getIncomeRegister(filter: RegisterQueryFilter): Promise<IncomeRegisterResponse> {
  const params = new URLSearchParams({ from: filter.from, to: filter.to });
  if (filter.source && filter.source !== 'all') params.set('source', filter.source);
  if (filter.search && filter.search.trim()) params.set('search', filter.search.trim());
  if (filter.limit !== undefined) params.set('limit', String(filter.limit));
  if (filter.offset !== undefined) params.set('offset', String(filter.offset));

  const response = await fetch(`/api/registers/income?${params.toString()}`);
  if (!response.ok) {
    let errorMessage = `Failed to fetch income register (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) errorMessage = body.error;
    } catch {
      // Ignore
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}


