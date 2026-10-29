import React, { useState, useEffect, useCallback } from 'react';
import { ApiProduct } from '../types';
import { fetchProducts, createProduct, setStock, deleteProduct, ApiError } from '../services/api';
import { formatINR } from '../utils/formatters';

interface InventoryPageProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const POSTER_SIZES = ['A4', 'A3', 'A5', 'Polaroid'] as const;
type PosterSize = (typeof POSTER_SIZES)[number];

interface FormErrors {
  name?: string;
  unitType?: string;
  stockQty?: string;
  costPrice?: string;
  sellPrice?: string;
  general?: string;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({ onShowToast }) => {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read-only modal inspector
  const [selectedProduct, setSelectedProduct] = useState<ApiProduct | null>(null);

  // Add Product Modal & Form State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formName, setFormName] = useState('');
  const [formUnitType, setFormUnitType] = useState<PosterSize>('A4');
  const [formStock, setFormStock] = useState('0');
  const [formCost, setFormCost] = useState('');
  const [formSell, setFormSell] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // Edit Stock Modal State
  const [editingStockProduct, setEditingStockProduct] = useState<ApiProduct | null>(null);
  const [stockInput, setStockInput] = useState('');
  const [stockReason, setStockReason] = useState<'Correction' | 'Wastage' | 'Miscellaneous'>('Correction');
  const [stockNote, setStockNote] = useState('');
  const [isStockSubmitting, setIsStockSubmitting] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockInlineError, setStockInlineError] = useState<string | null>(null);

  // Delete Modal State
  const [deletingProduct, setDeletingProduct] = useState<ApiProduct | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadProducts = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await fetchProducts(searchQuery);
      setProducts(list);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not connect to database API';
      setError(message);
      if (onShowToast) {
        onShowToast('Connection Error', message, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast]);

  // Load products when debounced search term changes
  useEffect(() => {
    loadProducts(debouncedSearch);
  }, [debouncedSearch, loadProducts]);

  const handleRetry = () => {
    loadProducts(debouncedSearch);
  };

  const handleOpenAddModal = () => {
    setFormName('');
    setFormUnitType('A4');
    setFormStock('0');
    setFormCost('');
    setFormSell('');
    setFormErrors({});
    setAddModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    const trimmed = formName.trim();
    if (!trimmed) {
      errors.name = 'Name is required';
    } else if (trimmed.length > 100) {
      errors.name = 'Name must be at most 100 characters';
    }

    if (!POSTER_SIZES.includes(formUnitType)) {
      errors.unitType = 'Please select a valid poster size';
    }

    const stockNum = formStock === '' ? 0 : Number(formStock);
    if (isNaN(stockNum) || stockNum < 0) {
      errors.stockQty = 'Stock cannot be negative';
    } else if (!Number.isInteger(stockNum)) {
      errors.stockQty = 'Stock must be a whole number';
    }

    if (formCost.trim() === '') {
      errors.costPrice = 'Cost price is required';
    } else {
      const costNum = Number(formCost);
      if (isNaN(costNum) || costNum < 0) {
        errors.costPrice = 'Cost price must be 0 or more';
      }
    }

    if (formSell.trim() === '') {
      errors.sellPrice = 'Selling price is required';
    } else {
      const sellNum = Number(formSell);
      if (isNaN(sellNum) || sellNum < 0) {
        errors.sellPrice = 'Selling price must be 0 or more';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setFormErrors((prev) => ({ ...prev, general: undefined }));

    const stockNum = formStock === '' ? 0 : Number(formStock);
    const costNum = Number(formCost);
    const sellNum = Number(formSell);

    try {
      const newProd = await createProduct({
        name: formName.trim(),
        unitType: formUnitType,
        stockQty: stockNum,
        costPrice: costNum,
        sellPrice: sellNum,
      });

      if (onShowToast) {
        onShowToast('Product Created', `Added "${newProd.name} (${newProd.unitType})" to catalog`, 'success');
      }

      setAddModalOpen(false);
      // Reload products catalog
      await loadProducts(debouncedSearch);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setFormErrors((prev) => ({
            ...prev,
            general: err.message,
            unitType: 'This size is already cataloged for this poster',
          }));
        } else {
          setFormErrors((prev) => ({ ...prev, general: err.message }));
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Could not add product';
        setFormErrors((prev) => ({ ...prev, general: msg }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenStockModal = (product: ApiProduct) => {
    setEditingStockProduct(product);
    setStockInput(String(product.stockQty));
    setStockReason('Correction');
    setStockNote('');
    setStockError(null);
    setStockInlineError(null);
  };

  const handleStockInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val !== '' && Number(val) < 0) {
      setStockInlineError('Stock cannot be negative');
    } else {
      setStockInlineError(null);
    }
    setStockInput(val);
    if (stockError) setStockError(null);
  };

  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStockProduct) return;

    if (stockInput.trim() === '') {
      setStockInlineError('Stock quantity is required');
      return;
    }

    const numStock = Number(stockInput);
    if (isNaN(numStock) || numStock < 0) {
      setStockInlineError('Stock cannot be negative');
      return;
    }

    setIsStockSubmitting(true);
    setStockError(null);

    try {
      await setStock(editingStockProduct.id, {
        stockQty: numStock,
        reason: stockReason,
        note: stockNote.trim() || undefined,
      });

      if (onShowToast) {
        onShowToast('Stock updated', `Stock for "${editingStockProduct.name}" set to ${numStock}`, 'success');
      }

      setEditingStockProduct(null);
      window.dispatchEvent(new CustomEvent('trackops:data_updated'));
      await loadProducts(debouncedSearch);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update stock';
      setStockError(msg);
    } finally {
      setIsStockSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (product: ApiProduct) => {
    setDeletingProduct(product);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteProduct(deletingProduct.id);

      if (onShowToast) {
        onShowToast('Product deleted', `"${deletingProduct.name} (${deletingProduct.unitType})" deleted`, 'success');
      }

      if (selectedProduct?.id === deletingProduct.id) {
        setSelectedProduct(null);
      }
      setDeletingProduct(null);
      window.dispatchEvent(new CustomEvent('trackops:data_updated'));
      await loadProducts(debouncedSearch);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not delete product';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Metrics
  const totalCostValue = products.reduce((acc, p) => acc + (p.stockQty * p.costPrice), 0);
  const totalRetailValue = products.reduce((acc, p) => acc + (p.stockQty * p.sellPrice), 0);
  const outOfStockItems = products.filter((p) => p.stockQty === 0);
  const lowStockItems = products.filter((p) => p.stockQty > 0 && p.stockQty <= 10);
  const alertCount = outOfStockItems.length + lowStockItems.length;

  const costNumPreview = parseFloat(formCost) || 0;
  const sellNumPreview = parseFloat(formSell) || 0;
  const showLossWarning = sellNumPreview > 0 && costNumPreview > 0 && sellNumPreview < costNumPreview;

  return (
    <div className="flex flex-col w-full pb-20">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md pb-space-lg">
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-xs uppercase tracking-wider font-semibold">
            <span>Superhero Poster Catalog</span>
            <span>•</span>
            <span>{isLoading ? '...' : `${products.length} Items Listed`}</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
            Inventory Management
          </h1>
        </div>

        {/* Search Bar & Add Product Button */}
        <div className="flex flex-wrap items-center gap-space-sm w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              aria-label="Search products"
              placeholder="Search products by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-9 bg-surface-container-lowest text-on-surface text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary shadow-xs border border-surface-container-low transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Add Product Button */}
          <button
            onClick={handleOpenAddModal}
            className="h-11 px-4 bg-primary text-on-primary hover:bg-primary/90 rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap"
            title="Create a new product"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md mb-space-lg">
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <span className="text-on-surface-variant font-label-sm text-xs font-semibold uppercase tracking-wider">
            Total Cost Valuation
          </span>
          <div className="mt-2">
            <span className="font-headline-lg text-2xl font-bold text-on-surface">
              {formatINR(totalCostValue)}
            </span>
            <span className="block text-xs text-on-surface-variant mt-0.5">
              Held stock at procurement cost
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <span className="text-on-surface-variant font-label-sm text-xs font-semibold uppercase tracking-wider">
            Retail Valuation
          </span>
          <div className="mt-2">
            <span className="font-headline-lg text-2xl font-bold text-on-surface">
              {formatINR(totalRetailValue)}
            </span>
            <span className="block text-xs text-secondary mt-0.5 font-medium">
              +{formatINR(Math.max(0, totalRetailValue - totalCostValue))} potential margin
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <span className="text-on-surface-variant font-label-sm text-xs font-semibold uppercase tracking-wider">
            Stock Alert
          </span>
          <div className="mt-2">
            <span
              className={`font-headline-lg text-2xl font-bold ${
                alertCount > 0 ? (outOfStockItems.length > 0 ? 'text-error' : 'text-amber-600') : 'text-secondary'
              }`}
            >
              {alertCount} {alertCount === 1 ? 'Poster' : 'Posters'}
            </span>
            <span className="block text-xs text-on-surface-variant mt-0.5">
              {outOfStockItems.length > 0 && `${outOfStockItems.length} out of stock (0)`}
              {outOfStockItems.length > 0 && lowStockItems.length > 0 && ' • '}
              {lowStockItems.length > 0 && `${lowStockItems.length} low stock (≤10)`}
              {alertCount === 0 && 'All poster stock levels healthy'}
            </span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 bg-surface-container-lowest rounded-xl border border-surface-container-low shadow-xs">
          <div className="w-9 h-9 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-on-surface-variant font-medium">Loading products from database...</p>
        </div>
      ) : error ? (
        /* Error State with Retry */
        <div className="py-16 px-4 bg-surface-container-lowest rounded-2xl border border-error/30 text-center flex flex-col items-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-error-container/50 text-error flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl">error_outline</span>
          </div>
          <h2 className="text-lg font-bold text-on-surface">Failed to Load Products</h2>
          <p className="text-sm text-on-surface-variant max-w-md mt-1 mb-6">
            {error}
          </p>
          <button
            onClick={handleRetry}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/90 shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            <span>Retry</span>
          </button>
        </div>
      ) : products.length === 0 ? (
        /* Empty State */
        <div className="py-16 px-4 bg-surface-container-lowest rounded-2xl border border-surface-container-low text-center flex flex-col items-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-4">
            <span className="material-symbols-outlined text-3xl">
              {debouncedSearch ? 'search_off' : 'inventory_2'}
            </span>
          </div>
          <h2 className="text-lg font-bold text-on-surface">
            {debouncedSearch ? 'No Products Found' : 'No products yet'}
          </h2>
          <p className="text-sm text-on-surface-variant max-w-sm mt-1 mb-6">
            {debouncedSearch
              ? `No products found matching "${debouncedSearch}". Try a different search query.`
              : 'Your inventory catalog is currently empty. Add your first product below.'}
          </p>
          {debouncedSearch ? (
            <button
              onClick={() => setSearchTerm('')}
              className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/90 shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              <span>Clear Search</span>
            </button>
          ) : (
            <button
              onClick={handleOpenAddModal}
              className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/90 shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Add Product</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Products Table (Desktop) */}
          <div className="hidden md:block bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container-low overflow-hidden mb-space-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/70 text-on-surface-variant text-xs uppercase tracking-wider font-semibold border-b border-surface-container-low">
                    <th className="py-3.5 px-4">Product Name</th>
                    <th className="py-3.5 px-4">Size</th>
                    <th className="py-3.5 px-4 text-right">In Stock</th>
                    <th className="py-3.5 px-4 text-right">Cost Price</th>
                    <th className="py-3.5 px-4 text-right">Selling Price</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low text-sm">
                  {products.map((p) => {
                    const isOutOfStock = p.stockQty === 0;
                    const isLowStock = p.stockQty > 0 && p.stockQty <= 10;

                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedProduct(p)}
                        className="hover:bg-surface-container-low/50 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-on-surface group-hover:text-primary transition-colors">
                              {p.name}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                              {p.unitType}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-on-surface-variant font-medium text-xs">
                          {p.unitType}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-bold ${
                            isOutOfStock
                              ? 'text-error'
                              : isLowStock
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-on-surface'
                          }`}
                        >
                          {p.stockQty}
                        </td>
                        <td className="py-3.5 px-4 text-right text-on-surface-variant">
                          {formatINR(p.costPrice, { showDecimal: true })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-on-surface">
                          {formatINR(p.sellPrice, { showDecimal: true })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-error-container text-on-error-container">
                              <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Low Stock ({p.stockQty})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-container text-on-surface">
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                              In Stock
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenStockModal(p)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-surface-container-high bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center gap-1 transition-colors cursor-pointer"
                              title="Edit stock"
                            >
                              <span className="material-symbols-outlined text-[15px]">edit</span>
                              <span>Edit stock</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(p)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-error/30 bg-error/10 hover:bg-error/20 text-error flex items-center gap-1 transition-colors cursor-pointer"
                              title="Delete product"
                            >
                              <span className="material-symbols-outlined text-[15px]">delete</span>
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Products List (Mobile Cards) */}
          <div className="flex flex-col gap-3 md:hidden">
            {products.map((p) => {
              const isOutOfStock = p.stockQty === 0;
              const isLowStock = p.stockQty > 0 && p.stockQty <= 10;

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className="bg-surface-container-lowest p-4 rounded-xl shadow-xs border border-surface-container-low flex flex-col gap-2 cursor-pointer active:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm text-on-surface">{p.name}</h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                        {p.unitType}
                      </span>
                    </div>
                    <div>
                      {isOutOfStock ? (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-error-container text-on-error-container">
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Low ({p.stockQty})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-container text-on-surface">
                          {p.stockQty} in stock
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-surface-container-low text-xs">
                    <div>
                      <span className="text-on-surface-variant">Cost: </span>
                      <span className="font-medium text-on-surface">
                        {formatINR(p.costPrice, { showDecimal: true })}
                      </span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant">Selling: </span>
                      <span className="font-bold text-on-surface">
                        {formatINR(p.sellPrice, { showDecimal: true })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-low" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleOpenStockModal(p)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-surface-container-high bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                      <span>Edit stock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteModal(p)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-error/30 bg-error/10 hover:bg-error/20 text-error flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add Product Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => !isSubmitting && setAddModalOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          />

          <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-low overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-surface-container-low flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">add_box</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-on-surface">Add New Product</h2>
                  <p className="text-xs text-on-surface-variant">Register a new product in inventory</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setAddModalOpen(false)}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProduct} noValidate className="p-5 space-y-4">
              {/* General Form Error / Conflict Alert */}
              {formErrors.general && (
                <div className="p-3 rounded-lg bg-error-container/40 border border-error text-xs text-on-error-container flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-error shrink-0">error</span>
                  <span className="font-medium">{formErrors.general}</span>
                </div>
              )}

              {/* Product Name Field */}
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Product name"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  className={`w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border transition-colors ${
                    formErrors.name ? 'border-error ring-1 ring-error' : 'border-transparent'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-xs text-error mt-1 flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {formErrors.name}
                  </p>
                )}
              </div>

              {/* Poster Size Selector */}
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                  Poster Size *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {POSTER_SIZES.map((size) => {
                    const isSelected = formUnitType === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setFormUnitType(size);
                          if (formErrors.unitType) setFormErrors((prev) => ({ ...prev, unitType: undefined }));
                        }}
                        className={`h-11 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-primary text-on-primary border-primary shadow-xs'
                            : 'bg-surface-container-low text-on-surface border-surface-container-high hover:bg-surface-container'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
                {formErrors.unitType && (
                  <p className="text-xs text-error mt-1 flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {formErrors.unitType}
                  </p>
                )}
              </div>

              {/* Initial Stock */}
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                  Starting Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={formStock}
                  onChange={(e) => {
                    setFormStock(e.target.value);
                    if (formErrors.stockQty) setFormErrors((prev) => ({ ...prev, stockQty: undefined }));
                  }}
                  className={`w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border transition-colors ${
                    formErrors.stockQty ? 'border-error ring-1 ring-error' : 'border-transparent'
                  }`}
                />
                {formErrors.stockQty ? (
                  <p className="text-xs text-error mt-1 flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {formErrors.stockQty}
                  </p>
                ) : (
                  <span className="text-[11px] text-on-surface-variant mt-1 block">
                    Starting inventory count (defaults to 0 if left blank).
                  </span>
                )}
              </div>

              {/* Cost Price & Selling Price Row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Cost Price */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                    Cost Price (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-on-surface text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="0.00"
                      value={formCost}
                      onChange={(e) => {
                        setFormCost(e.target.value);
                        if (formErrors.costPrice) setFormErrors((prev) => ({ ...prev, costPrice: undefined }));
                      }}
                      className={`w-full h-11 pl-7 pr-3 rounded-lg bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border transition-colors ${
                        formErrors.costPrice ? 'border-error ring-1 ring-error' : 'border-transparent'
                      }`}
                    />
                  </div>
                  {formErrors.costPrice && (
                    <p className="text-xs text-error mt-1 flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {formErrors.costPrice}
                    </p>
                  )}
                </div>

                {/* Selling Price */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                    Selling Price (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-on-surface text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="0.00"
                      value={formSell}
                      onChange={(e) => {
                        setFormSell(e.target.value);
                        if (formErrors.sellPrice) setFormErrors((prev) => ({ ...prev, sellPrice: undefined }));
                      }}
                      className={`w-full h-11 pl-7 pr-3 rounded-lg bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border transition-colors ${
                        formErrors.sellPrice ? 'border-error ring-1 ring-error' : 'border-transparent'
                      }`}
                    />
                  </div>
                  {formErrors.sellPrice && (
                    <p className="text-xs text-error mt-1 flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {formErrors.sellPrice}
                    </p>
                  )}
                </div>
              </div>

              {/* Margin / Loss Warning */}
              {showLossWarning && (
                <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-amber-500 shrink-0">warning</span>
                  <span>
                    Selling price ({formatINR(sellNumPreview)}) is lower than cost price ({formatINR(costNumPreview)}).
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-low">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      <span>Save Product</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Read-Only Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setSelectedProduct(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          />

          <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-low overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-surface-container-low flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-on-surface">{selectedProduct.name}</h2>
                <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  {selectedProduct.unitType}
                </span>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Product Quick Stats */}
            <div className="p-4 grid grid-cols-3 gap-2 bg-surface-container-low/20 border-b border-surface-container-low text-center">
              <div className="p-3 rounded-lg bg-surface-container-lowest">
                <span className="text-[11px] text-on-surface-variant block uppercase font-medium">In Stock</span>
                <span
                  className={`text-base font-bold ${
                    selectedProduct.stockQty === 0
                      ? 'text-error'
                      : selectedProduct.stockQty <= 10
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-on-surface'
                  }`}
                >
                  {selectedProduct.stockQty}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-lowest">
                <span className="text-[11px] text-on-surface-variant block uppercase font-medium">Cost Price</span>
                <span className="text-base font-bold text-on-surface">
                  {formatINR(selectedProduct.costPrice, { showDecimal: true })}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-lowest">
                <span className="text-[11px] text-on-surface-variant block uppercase font-medium">Selling Price</span>
                <span className="text-base font-bold text-secondary">
                  {formatINR(selectedProduct.sellPrice, { showDecimal: true })}
                </span>
              </div>
            </div>

            {/* Detail Body */}
            <div className="p-4 space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-surface-container-low">
                <span className="text-on-surface-variant">Poster Identifier</span>
                <span className="font-mono font-medium text-on-surface">#{selectedProduct.id}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-surface-container-low">
                <span className="text-on-surface-variant">Size Format</span>
                <span className="font-semibold text-on-surface">{selectedProduct.unitType}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-surface-container-low">
                <span className="text-on-surface-variant">Total Held Valuation</span>
                <span className="font-semibold text-on-surface">
                  {formatINR(selectedProduct.stockQty * selectedProduct.costPrice, { showDecimal: true })}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-on-surface-variant">Potential Retail Revenue</span>
                <span className="font-bold text-secondary">
                  {formatINR(selectedProduct.stockQty * selectedProduct.sellPrice, { showDecimal: true })}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-surface-container-low bg-surface-container-low/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const prod = selectedProduct;
                    setSelectedProduct(null);
                    handleOpenStockModal(prod);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-surface-container-high bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                  <span>Edit stock</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const prod = selectedProduct;
                    setSelectedProduct(null);
                    handleOpenDeleteModal(prod);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-error/30 bg-error/10 hover:bg-error/20 text-error flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">delete</span>
                  <span>Delete</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-surface-container hover:bg-surface-container-high rounded-lg text-on-surface transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Stock Modal */}
      {editingStockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => !isStockSubmitting && setEditingStockProduct(null)}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          />

          <div className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-low overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-surface-container-low flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">edit_note</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-on-surface">Edit Stock</h2>
                  <p className="text-xs text-on-surface-variant">
                    {editingStockProduct.name} ({editingStockProduct.unitType})
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isStockSubmitting}
                onClick={() => setEditingStockProduct(null)}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveStock} noValidate className="p-5 space-y-4">
              {stockError && (
                <div className="p-3 rounded-lg bg-error-container/40 border border-error text-xs text-on-error-container flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-error shrink-0">error</span>
                  <span className="font-medium">{stockError}</span>
                </div>
              )}

              <div className="p-3 rounded-lg bg-surface-container-low/50 border border-surface-container-low flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-medium">Current Stock Level:</span>
                <span className="font-bold text-sm text-on-surface">{editingStockProduct.stockQty} units</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                  New Stock Quantity *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  autoFocus
                  required
                  placeholder="0"
                  value={stockInput}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === 'e') e.preventDefault();
                  }}
                  onChange={handleStockInputChange}
                  className={`w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border transition-colors ${
                    stockInlineError ? 'border-error ring-1 ring-error' : 'border-transparent'
                  }`}
                />
                {stockInlineError ? (
                  <p className="text-xs text-error mt-1 flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {stockInlineError}
                  </p>
                ) : (
                  <div className="text-xs mt-1.5 flex items-center gap-1.5 font-medium">
                    <span className="text-on-surface-variant">Change:</span>
                    {stockInput.trim() !== '' && !isNaN(Number(stockInput)) ? (
                      (() => {
                        const delta = Number(stockInput) - editingStockProduct.stockQty;
                        if (delta > 0) {
                          return <span className="text-secondary font-bold">+{delta}</span>;
                        } else if (delta < 0) {
                          return <span className="text-amber-600 dark:text-amber-400 font-bold">{delta}</span>;
                        } else {
                          return <span className="text-on-surface-variant font-medium">0 (no change)</span>;
                        }
                      })()
                    ) : (
                      <span className="text-on-surface-variant">—</span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="stock-reason-select"
                  className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider"
                >
                  Reason *
                </label>
                <div className="relative">
                  <select
                    id="stock-reason-select"
                    value={stockReason}
                    onChange={(e) =>
                      setStockReason(e.target.value as 'Correction' | 'Wastage' | 'Miscellaneous')
                    }
                    className="w-full h-11 px-3 pr-9 rounded-lg bg-surface-container-low text-on-surface text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary border border-transparent transition-colors cursor-pointer appearance-none"
                  >
                    <option value="Correction">Correction</option>
                    <option value="Wastage">Wastage</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">
                    arrow_drop_down
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Additional note (optional)"
                  value={stockNote}
                  onChange={(e) => setStockNote(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border border-transparent transition-colors"
                />
                <span className="text-[11px] text-on-surface-variant mt-1 block text-right">
                  {stockNote.length}/200
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-low">
                <button
                  type="button"
                  disabled={isStockSubmitting}
                  onClick={() => setEditingStockProduct(null)}
                  className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isStockSubmitting ||
                    stockInlineError !== null ||
                    stockInput.trim() === '' ||
                    isNaN(Number(stockInput)) ||
                    Number(stockInput) < 0
                  }
                  className="px-5 py-2.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isStockSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => !isDeleting && setDeletingProduct(null)}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          />

          <div className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-low overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-surface-container-low flex items-center justify-between bg-error/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-error/15 text-error flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-on-surface">Delete Product</h2>
                  <p className="text-xs text-on-surface-variant">Confirm catalog removal</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingProduct(null)}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {deleteError && (
                <div className="p-3 rounded-lg bg-error-container/40 border border-error text-xs text-on-error-container flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-error shrink-0">error</span>
                  <span className="font-medium">{deleteError}</span>
                </div>
              )}

              <div className="text-sm text-on-surface">
                Are you sure you want to delete <span className="font-bold text-primary">{deletingProduct.name}</span> (<span className="font-bold">{deletingProduct.unitType}</span>)?
              </div>

              <div className="p-3 rounded-lg bg-surface-container-low/60 border border-surface-container-low text-xs text-on-surface-variant space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] text-secondary shrink-0 mt-0.5">verified</span>
                  <span>Existing sales, purchases, and stock movement history will stay intact with the product name preserved.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">info</span>
                  <span>Deleting frees the name and size, so the same poster can be added again later if needed.</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-low">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingProduct(null)}
                  className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 bg-error text-on-error rounded-lg text-xs font-semibold hover:bg-error/90 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-on-error border-t-transparent rounded-full animate-spin"></div>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      <span>Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
