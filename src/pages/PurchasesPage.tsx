import React, { useState, useEffect, useCallback } from 'react';
import { ApiProduct, ApiPurchaseSummary, ApiPurchase } from '../types';
import {
  fetchProducts,
  createPurchase,
  updatePurchase,
  deletePurchase,
  listPurchases,
  getPurchase,
  createProduct,
} from '../services/api';
import { formatINR, formatDateTime } from '../utils/formatters';

interface PurchasesPageProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

interface ActivePurchaseLine {
  productId: number;
  name: string;
  unit: string;
  qty: number;
  cost: number;
  total: number;
}

const POSTER_SIZES = ['A4', 'A3', 'A5', 'Polaroid'] as const;
type PosterSize = (typeof POSTER_SIZES)[number];

export const PurchasesPage: React.FC<PurchasesPageProps> = ({ onShowToast }) => {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [purchases, setPurchases] = useState<ApiPurchaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search & Auto-suggest for product picker
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Active line items & form
  const [lines, setLines] = useState<ActivePurchaseLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI'>('UPI');
  const [purchaseNote, setPurchaseNote] = useState('');
  const [stockError, setStockError] = useState<string | null>(null);

  // Edit mode
  const [editingPurchase, setEditingPurchase] = useState<ApiPurchase | null>(null);

  // Delete modal state
  const [deletingPurchase, setDeletingPurchase] = useState<ApiPurchaseSummary | null>(null);

  // Search in history
  const [historySearch, setHistorySearch] = useState('');

  // Expandable history voucher with getPurchase details
  const [expandedVoucherId, setExpandedVoucherId] = useState<string | null>(null);
  const [voucherDetails, setVoucherDetails] = useState<Record<string, ApiPurchase>>({});
  const [isLoadingDetails, setIsLoadingDetails] = useState<string | null>(null);

  // Quick add product modal
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickUnit, setQuickUnit] = useState<PosterSize>('A4');
  const [quickCost, setQuickCost] = useState('');
  const [quickSell, setQuickSell] = useState('');
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [prodList, purchList] = await Promise.all([
        fetchProducts(),
        listPurchases(),
      ]);
      setProducts(prodList);
      setPurchases(purchList);
    } catch (err: unknown) {
      console.error('Failed to load purchases data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('trackops:data_updated', handleUpdate);
    return () => window.removeEventListener('trackops:data_updated', handleUpdate);
  }, [loadData]);

  // Filtered dropdown products
  const searchResults = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.unitType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filtered purchase history
  const filteredPurchases = purchases.filter((p) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase().trim();
    return (
      (p.purchaseNo && p.purchaseNo.toLowerCase().includes(q)) ||
      p.number.toLowerCase().includes(q) ||
      (p.note && p.note.toLowerCase().includes(q))
    );
  });

  // Add line item to active purchase
  const handleAddLineItem = (p: ApiProduct) => {
    setStockError(null);
    const existingIndex = lines.findIndex((item) => item.productId === p.id);
    if (existingIndex >= 0) {
      const updated = [...lines];
      updated[existingIndex].qty += 1;
      updated[existingIndex].total = Number(
        (updated[existingIndex].qty * updated[existingIndex].cost).toFixed(2)
      );
      setLines(updated);
    } else {
      setLines([
        ...lines,
        {
          productId: p.id,
          name: p.name,
          unit: p.unitType,
          qty: 1,
          cost: p.costPrice,
          total: p.costPrice,
        },
      ]);
    }
    setSearchQuery('');
    setDropdownOpen(false);
  };

  const handleUpdateQty = (productId: number, delta: number) => {
    setStockError(null);
    setLines((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.qty + delta;
            if (newQty <= 0) return null;
            return { ...item, qty: newQty, total: Number((newQty * item.cost).toFixed(2)) };
          }
          return item;
        })
        .filter(Boolean) as ActivePurchaseLine[]
    );
  };

  const handleUpdateCost = (productId: number, costValue: number) => {
    setStockError(null);
    setLines((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const validCost = Math.max(0, costValue);
          return { ...item, cost: validCost, total: Number((item.qty * validCost).toFixed(2)) };
        }
        return item;
      })
    );
  };

  const handleRemoveLine = (productId: number) => {
    setStockError(null);
    setLines((prev) => prev.filter((item) => item.productId !== productId));
  };

  const grandTotal = lines.reduce((acc, item) => acc + item.total, 0);

  const handleSavePurchase = async () => {
    if (lines.length === 0) {
      onShowToast('Validation Error', 'Add at least one item to record a purchase.', 'error');
      return;
    }

    setIsSubmitting(true);
    setStockError(null);
    try {
      const payload = {
        paymentMethod,
        note: purchaseNote.trim() || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          cost: l.cost,
        })),
      };

      if (editingPurchase) {
        const updated = await updatePurchase(editingPurchase.id, payload);
        setLines([]);
        setPurchaseNote('');
        setEditingPurchase(null);
        // Clear cached details for this purchase so it refreshes on expand
        setVoucherDetails((prev) => {
          const copy = { ...prev };
          delete copy[String(updated.id)];
          return copy;
        });
        onShowToast(
          'Updated',
          `Purchase #${updated.number || updated.purchaseNo} Updated (${formatINR(updated.total)})`,
          'success'
        );
      } else {
        const saved = await createPurchase(payload);
        setLines([]);
        setPurchaseNote('');
        onShowToast(
          'Saved',
          `Purchase #${saved.number || saved.purchaseNo} Saved (${formatINR(saved.total)})`,
          'success'
        );
      }

      await loadData();
      window.dispatchEvent(new CustomEvent('trackops:data_updated'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save purchase';
      setStockError(message);
      onShowToast('Error', message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPurchase = async (pSummary: ApiPurchaseSummary) => {
    setStockError(null);
    setIsSubmitting(true);
    try {
      const key = String(pSummary.id);
      let detail = voucherDetails[key];
      if (!detail) {
        detail = await getPurchase(pSummary.id);
        setVoucherDetails((prev) => ({ ...prev, [key]: detail }));
      }
      setEditingPurchase(detail);
      setPaymentMethod(detail.paymentMethod);
      setPurchaseNote(detail.note || '');
      setLines(
        detail.items.map((i) => ({
          productId: i.productId!,
          name: i.productName,
          unit: i.unitType,
          qty: i.qty,
          cost: i.cost,
          total: i.lineTotal,
        }))
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load purchase details for editing';
      onShowToast('Error', msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingPurchase(null);
    setLines([]);
    setPurchaseNote('');
    setStockError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPurchase) return;
    setIsDeleting(true);
    try {
      const result = await deletePurchase(deletingPurchase.id);
      onShowToast(
        'Deleted',
        `Purchase #${result.purchaseNo || deletingPurchase.number || deletingPurchase.purchaseNo} Deleted`,
        'success'
      );
      setDeletingPurchase(null);
      if (editingPurchase && editingPurchase.id === deletingPurchase.id) {
        handleCancelEdit();
      }
      await loadData();
      window.dispatchEvent(new CustomEvent('trackops:data_updated'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete purchase';
      onShowToast('Cannot Delete', msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleExpandVoucher = async (voucherId: number) => {
    const key = String(voucherId);
    if (expandedVoucherId === key) {
      setExpandedVoucherId(null);
      return;
    }

    setExpandedVoucherId(key);

    if (!voucherDetails[key]) {
      setIsLoadingDetails(key);
      try {
        const detail = await getPurchase(voucherId);
        setVoucherDetails((prev) => ({ ...prev, [key]: detail }));
      } catch {
        onShowToast('Error', 'Failed to load purchase voucher breakdown', 'error');
      } finally {
        setIsLoadingDetails(null);
      }
    }
  };

  const handleCreateQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrimmed = quickName.trim();
    if (!nameTrimmed) {
      setQuickError('Product name is required');
      return;
    }

    setQuickSubmitting(true);
    setQuickError(null);

    const costNum = quickCost.trim() === '' ? 0 : Number(quickCost);
    const sellNum = quickSell.trim() === '' ? 0 : Number(quickSell);

    try {
      const newProd = await createProduct({
        name: nameTrimmed,
        unitType: quickUnit,
        costPrice: isNaN(costNum) ? 0 : costNum,
        sellPrice: isNaN(sellNum) ? 0 : sellNum,
        stockQty: 0,
      });

      setShowQuickAddModal(false);
      setQuickName('');
      setQuickCost('');
      setQuickSell('');
      setQuickUnit('A4');
      handleAddLineItem(newProd);
      onShowToast('Product Created', `Added "${newProd.name} (${newProd.unitType})" to purchase form`, 'success');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not create product';
      setQuickError(msg);
    } finally {
      setQuickSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-on-surface-variant font-medium">Loading purchases...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full pb-20">
      {/* Page Title & Metrics */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md pb-space-lg">
        <div>
          <span className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
            Procurement & Inward Stock
          </span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
            Purchases & Restock
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setQuickError(null);
              setShowQuickAddModal(true);
            }}
            className="px-3.5 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-surface-container-low transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add_box</span>
            <span>New Item Catalog</span>
          </button>
        </div>
      </div>

      {/* Two-Column Layout: Left = Purchase Entry Form, Right = Purchase History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Left Column: Form (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low flex flex-col gap-space-md">
            {/* Header / Edit Banner */}
            {editingPurchase ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px]">
                    edit_note
                  </span>
                  <div>
                    <h2 className="font-bold text-xs text-amber-700 dark:text-amber-300">
                      Editing Purchase #{editingPurchase.number || editingPurchase.purchaseNo}
                    </h2>
                    <span className="text-[11px] text-on-surface-variant">
                      Original: {formatINR(editingPurchase.total)} ({editingPurchase.paymentMethod})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                  className="px-2.5 py-1 text-xs font-semibold text-on-surface bg-surface-container hover:bg-surface-container-high rounded-md transition-colors cursor-pointer"
                >
                  Cancel Edit
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low">
                <h2 className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[18px]">add_shopping_cart</span>
                  <span>Record Stock Inward</span>
                </h2>
                <span className="text-xs text-on-surface-variant font-medium">
                  {lines.length} {lines.length === 1 ? 'item' : 'items'} in voucher
                </span>
              </div>
            )}

            {/* Error Banner (409 or other server errors) */}
            {stockError && (
              <div className="p-3 bg-error-container/40 border border-error text-xs text-on-error-container rounded-lg flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] text-error shrink-0">error</span>
                <span className="font-medium">{stockError}</span>
              </div>
            )}

            {/* Product Auto-suggest Dropdown Search */}
            <div className="relative">
              <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                Select Product to Restock
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Type product name or size..."
                  value={searchQuery}
                  onFocus={() => setDropdownOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setDropdownOpen(true);
                  }}
                  className="w-full h-10 pl-9 pr-4 rounded-lg bg-surface-container-low text-on-surface text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {dropdownOpen && searchQuery.trim().length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-surface-container-lowest rounded-xl shadow-lg border border-surface-container-low divide-y divide-surface-container-low">
                  {searchResults.length === 0 ? (
                    <div className="p-3 text-center text-xs text-on-surface-variant">
                      No matching product found. Click "+ New Item Catalog" to create it.
                    </div>
                  ) : (
                    searchResults.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddLineItem(p)}
                        className="p-2.5 hover:bg-surface-container-low flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div>
                          <span className="text-xs font-semibold text-on-surface block">{p.name}</span>
                          <span className="text-[11px] text-on-surface-variant">
                            Format: {p.unitType} • Current Stock: {p.stockQty}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-primary">
                          Cost: {formatINR(p.costPrice)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Lines List Table */}
            <div className="flex flex-col gap-2">
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Voucher Line Items
              </label>

              {lines.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-surface-container rounded-xl flex flex-col items-center justify-center text-on-surface-variant text-center px-4">
                  <span className="material-symbols-outlined text-3xl mb-1 text-outline">inventory_2</span>
                  <p className="text-xs font-medium">No items added to this purchase yet.</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Search and pick products from above to record stock inward.
                  </p>
                </div>
              ) : (
                <div className="border border-surface-container-low rounded-xl overflow-hidden divide-y divide-surface-container-low">
                  <div className="grid grid-cols-12 bg-surface-container-low/60 px-3 py-2 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                    <div className="col-span-5">Product & Size</div>
                    <div className="col-span-3 text-center">Inward Qty</div>
                    <div className="col-span-2 text-right">Unit Cost</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>

                  {lines.map((line) => (
                    <div key={line.productId} className="grid grid-cols-12 px-3 py-2.5 items-center gap-1 text-xs">
                      <div className="col-span-5 min-w-0 pr-1">
                        <span className="font-semibold text-on-surface block truncate">{line.name}</span>
                        <span className="text-[11px] text-on-surface-variant">{line.unit}</span>
                      </div>

                      {/* Qty Stepper */}
                      <div className="col-span-3 flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(line.productId, -1)}
                          disabled={isSubmitting}
                          className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high flex items-center justify-center font-bold text-xs cursor-pointer disabled:opacity-50"
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-bold text-xs text-on-surface">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(line.productId, 1)}
                          disabled={isSubmitting}
                          className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high flex items-center justify-center font-bold text-xs cursor-pointer disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>

                      {/* Cost input */}
                      <div className="col-span-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.cost}
                          disabled={isSubmitting}
                          onChange={(e) => handleUpdateCost(line.productId, Number(e.target.value))}
                          className="w-16 h-7 text-right px-1 bg-surface-container-low rounded text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                        />
                      </div>

                      {/* Line total & remove */}
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <span className="font-bold text-xs text-on-surface">
                          {formatINR(line.total)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.productId)}
                          disabled={isSubmitting}
                          className="text-on-surface-variant hover:text-error p-0.5 cursor-pointer disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Note & Payment Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-surface-container-low">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                  Payment Method *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setPaymentMethod('Cash')}
                    className={`h-9 rounded-lg text-xs font-semibold transition-all border cursor-pointer disabled:opacity-50 ${
                      paymentMethod === 'Cash'
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container-low text-on-surface border-transparent hover:bg-surface-container'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setPaymentMethod('UPI')}
                    className={`h-9 rounded-lg text-xs font-semibold transition-all border cursor-pointer disabled:opacity-50 ${
                      paymentMethod === 'UPI'
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container-low text-on-surface border-transparent hover:bg-surface-container'
                    }`}
                  >
                    UPI / Bank
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                  Voucher Note (Optional)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Voucher note (optional)..."
                  value={purchaseNote}
                  disabled={isSubmitting}
                  onChange={(e) => setPurchaseNote(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
              </div>
            </div>

            {/* Total & Submit Button */}
            <div className="pt-3 border-t border-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-on-surface-variant uppercase">
                  Total Outflow:
                </span>
                <span className="text-xl font-bold text-on-surface">
                  {formatINR(grandTotal)}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {editingPurchase && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleCancelEdit}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSavePurchase}
                  disabled={lines.length === 0 || isSubmitting}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving Purchase...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">
                        {editingPurchase ? 'save' : 'done_all'}
                      </span>
                      <span>
                        {editingPurchase
                          ? `Update Purchase (${formatINR(grandTotal)})`
                          : `Save Purchase (${formatINR(grandTotal)})`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: History with Expand-in-place rows (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low">
            <div className="flex items-center justify-between pb-space-xs mb-space-sm border-b border-surface-container-low">
              <h2 className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">history</span>
                <span>Recent Purchases</span>
              </h2>
              <span className="text-xs text-on-surface-variant font-medium">
                {filteredPurchases.length} total
              </span>
            </div>

            {/* Filter Search Input */}
            <div className="mb-3 relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
                search
              </span>
              <input
                type="text"
                placeholder="Filter by voucher # or note..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full h-8 pl-8 pr-7 bg-surface-container-low text-on-surface text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>

            {filteredPurchases.length === 0 ? (
              <div className="py-12 text-center text-on-surface-variant flex flex-col items-center">
                <span className="material-symbols-outlined text-3xl mb-1 text-outline">receipt</span>
                <p className="text-xs font-semibold text-on-surface">No purchases yet</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Saved purchases will appear here with line item breakdowns.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-surface-container-low">
                {filteredPurchases.map((p) => {
                  const key = String(p.id);
                  const isExpanded = expandedVoucherId === key;
                  const detail = voucherDetails[key];
                  const isLoadingThis = isLoadingDetails === key;

                  return (
                    <div key={p.id} className="py-2.5">
                      {/* Row Header */}
                      <div
                        onClick={() => handleToggleExpandVoucher(p.id)}
                        className="flex items-center justify-between cursor-pointer hover:bg-surface-container-low/50 p-1.5 rounded-lg transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-on-surface font-mono">
                              #{p.number || p.purchaseNo}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container font-medium text-on-surface-variant">
                              {p.paymentMethod}
                            </span>
                          </div>
                          <span className="text-[11px] text-on-surface-variant block mt-0.5">
                            {formatDateTime(p.createdAt || p.purchasedAt || '')} • {p.itemCount} items
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-on-surface">
                            {formatINR(p.total ?? p.totalCost ?? 0)}
                          </span>
                          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </div>
                      </div>

                      {/* Expand In-Place Breakdown from getPurchase */}
                      {isExpanded && (
                        <div className="mt-2 pl-3 pr-2 py-2 bg-surface-container-low/60 rounded-lg text-xs space-y-1.5 border border-surface-container-low">
                          {isLoadingThis ? (
                            <div className="py-2 text-center text-on-surface-variant flex items-center justify-center gap-2">
                              <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                              <span>Loading voucher items...</span>
                            </div>
                          ) : detail ? (
                            <>
                              {detail.note && (
                                <p className="text-[11px] italic text-on-surface-variant pb-1 border-b border-surface-container-low">
                                  Note: {detail.note}
                                </p>
                              )}
                              <div className="divide-y divide-surface-container-low">
                                {detail.items.map((item, idx) => (
                                  <div key={idx} className="py-1 flex items-center justify-between text-[11px]">
                                    <span>
                                      {item.productName}{' '}
                                      <span className="text-on-surface-variant">
                                        ({item.qty} {item.unitType} @ {formatINR(item.cost ?? item.unitCost ?? 0)})
                                      </span>
                                    </span>
                                    <span className="font-semibold text-on-surface">
                                      {formatINR(item.lineTotal ?? item.totalCost ?? 0)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="pt-1 border-t border-surface-container-low flex justify-between text-[11px] font-bold">
                                <span>Voucher Total</span>
                                <span>{formatINR(detail.total ?? detail.totalCost ?? 0)}</span>
                              </div>

                              {/* Edit & Delete Actions */}
                              <div className="pt-2 border-t border-surface-container-low flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={isSubmitting || isDeleting}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditPurchase(p);
                                  }}
                                  className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-on-surface rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-[14px]">edit</span>
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isSubmitting || isDeleting}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingPurchase(p);
                                  }}
                                  className="px-2.5 py-1 bg-error-container/40 hover:bg-error-container text-on-error-container rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-[14px]">delete</span>
                                  <span>Delete</span>
                                </button>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-error">Failed to load voucher details.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => !isDeleting && setDeletingPurchase(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
          />
          <div className="relative w-full max-w-sm bg-surface-container-lowest rounded-2xl p-5 shadow-2xl border border-surface-container-low">
            <div className="flex items-center gap-3 pb-3 border-b border-surface-container-low">
              <div className="w-10 h-10 rounded-full bg-error-container/50 text-error flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div>
                <h3 className="font-bold text-sm text-on-surface">Delete Purchase?</h3>
                <span className="text-xs text-on-surface-variant font-mono">
                  #{deletingPurchase.number || deletingPurchase.purchaseNo} • {formatINR(deletingPurchase.total ?? deletingPurchase.totalCost ?? 0)}
                </span>
              </div>
            </div>

            <div className="py-3 text-xs text-on-surface-variant space-y-2">
              <p>
                Deleting this purchase voucher will reverse the stock increase for all contained items.
              </p>
              <p className="text-[11px] text-error font-medium">
                If any units have already been sold such that stock would fall below 0, the deletion will be rejected.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingPurchase(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-error text-on-error rounded-lg text-xs font-semibold hover:bg-error/90 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Product Modal */}
      {showQuickAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => !quickSubmitting && setShowQuickAddModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-xs" />
          <div className="relative w-full max-w-sm bg-surface-container-lowest rounded-2xl p-5 shadow-2xl border border-surface-container-low">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-low">
              <h3 className="font-bold text-sm text-on-surface">Quick Add Poster</h3>
              <button
                type="button"
                disabled={quickSubmitting}
                onClick={() => setShowQuickAddModal(false)}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateQuickProduct} className="py-3 space-y-3">
              {quickError && (
                <div className="p-2 bg-error-container/40 border border-error text-xs text-on-error-container rounded-lg">
                  {quickError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Product name"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                  Size Format *
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {POSTER_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setQuickUnit(size)}
                      className={`h-9 rounded-lg text-xs font-bold border cursor-pointer ${
                        quickUnit === size
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-low text-on-surface border-surface-container-high'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={quickCost}
                    onChange={(e) => setQuickCost(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-surface-container-low text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                    Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={quickSell}
                    onChange={(e) => setQuickSell(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-surface-container-low text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
                <button
                  type="button"
                  disabled={quickSubmitting}
                  onClick={() => setShowQuickAddModal(false)}
                  className="px-3 py-1.5 rounded text-xs font-medium text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickSubmitting}
                  className="px-4 py-1.5 bg-primary text-on-primary rounded text-xs font-semibold hover:bg-primary/90 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {quickSubmitting ? 'Creating...' : 'Create & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
