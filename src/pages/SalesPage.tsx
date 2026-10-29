import React, { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ApiProduct, ApiSale, ApiSaleSummary } from '../types';
import {
  fetchProducts,
  createSale,
  updateSale,
  deleteSale,
  listSales,
  getSale,
} from '../services/api';
import { formatINR, formatDateTime, formatRs } from '../utils/formatters';

interface SalesPageProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

interface CartItem {
  productId: number;
  name: string;
  unit: string;
  qty: number;
  price: number;
  cost: number;
  total: number;
}

export const SalesPage: React.FC<SalesPageProps> = ({ onShowToast }) => {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [sales, setSales] = useState<ApiSaleSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [salesSearch, setSalesSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI'>('UPI');
  const [stockAlert, setStockAlert] = useState<string | null>(null);

  // Edit sale state
  const [editingSale, setEditingSale] = useState<ApiSale | null>(null);

  // Delete sale state
  const [deletingSale, setDeletingSale] = useState<ApiSaleSummary | null>(null);

  // Expandable sale history vouchers
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [saleDetails, setSaleDetails] = useState<Record<string, ApiSale>>({});
  const [isLoadingSaleDetails, setIsLoadingSaleDetails] = useState<string | null>(null);

  // Today's summary metrics
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayCompletedBills, setTodayCompletedBills] = useState(0);

  // Completed sale receipt modal
  const [completedSale, setCompletedSale] = useState<ApiSale | null>(null);

  const loadData = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [prodList, salesList] = await Promise.all([
        fetchProducts(),
        listSales(),
      ]);
      setProducts(prodList);
      setSales(salesList);

      const salesToday = salesList.filter(
        (s) =>
          s.date === todayStr ||
          (s.soldAt && String(s.soldAt).startsWith(todayStr)) ||
          (s.createdAt && String(s.createdAt).startsWith(todayStr))
      );
      setTodayCompletedBills(salesToday.length);
      const rev = salesToday.reduce((acc, s) => acc + (s.total || s.totalAmount || 0), 0);
      setTodayRevenue(rev);
    } catch (err: unknown) {
      console.error('Failed to load sales counter data:', err);
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

  // Filtered products for quick tiles
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.unitType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filtered sales history
  const filteredSales = sales.filter((s) => {
    if (!salesSearch.trim()) return true;
    const q = salesSearch.toLowerCase().trim();
    return (
      (s.saleNo && s.saleNo.toLowerCase().includes(q)) ||
      s.number.toLowerCase().includes(q) ||
      s.paymentMethod.toLowerCase().includes(q)
    );
  });

  // Cart Calculations
  const grandTotal = cart.reduce((sum, item) => sum + item.total, 0);
  const totalItemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  // Helper to determine available stock for a product, factoring in what the current editing sale holds
  const getEffectiveAvailableStock = (product: ApiProduct) => {
    const originalItem = editingSale ? editingSale.items.find((i) => i.productId === product.id) : null;
    const originalQty = originalItem ? originalItem.qty : 0;
    return product.stockQty + originalQty;
  };

  const handleAddToCart = (product: ApiProduct) => {
    setStockAlert(null);
    const maxAvailable = getEffectiveAvailableStock(product);

    if (maxAvailable <= 0) {
      setStockAlert(`"${product.name} (${product.unitType})" is completely out of stock.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.qty + 1 > maxAvailable) {
          setStockAlert(
            `Cannot exceed available stock for "${product.name} (${product.unitType})" (Max ${maxAvailable}).`
          );
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, qty: item.qty + 1, total: Number(((item.qty + 1) * item.price).toFixed(2)) }
            : item
        );
      } else {
        // If in edit mode and product was on the original sale, preserve original price
        const originalItem = editingSale
          ? editingSale.items.find((i) => i.productId === product.id)
          : null;
        const price = originalItem ? (originalItem.price ?? originalItem.unitPrice) : product.sellPrice;
        const cost = originalItem ? (originalItem.cost ?? originalItem.unitCost) : product.costPrice;

        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unit: product.unitType,
            qty: 1,
            cost,
            price,
            total: price,
          },
        ];
      }
    });
  };

  const handleUpdateQty = (productId: number, delta: number) => {
    setStockAlert(null);
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const maxAvailable = getEffectiveAvailableStock(product);

    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.qty + delta;
            if (newQty > maxAvailable) {
              setStockAlert(
                `Cannot exceed available stock for "${product.name} (${product.unitType})" (Max ${maxAvailable}).`
              );
              return item;
            }
            if (newQty <= 0) return null;
            return { ...item, qty: newQty, total: Number((newQty * item.price).toFixed(2)) };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveFromCart = (productId: number) => {
    setStockAlert(null);
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleClearCart = () => {
    if (cart.length > 0 && window.confirm('Clear all items from the current active bill?')) {
      setCart([]);
      setStockAlert(null);
      if (editingSale) {
        setEditingSale(null);
      }
    }
  };

  const handleEditSale = async (saleSummary: ApiSaleSummary | ApiSale) => {
    setStockAlert(null);
    setIsSubmitting(true);
    try {
      const key = String(saleSummary.id);
      let detail = saleDetails[key];
      if (!detail) {
        detail = await getSale(saleSummary.id);
        setSaleDetails((prev) => ({ ...prev, [key]: detail }));
      }

      setEditingSale(detail);
      setPaymentMethod(detail.paymentMethod);
      setCart(
        detail.items.map((i) => ({
          productId: i.productId!,
          name: i.productName,
          unit: i.unitType,
          qty: i.qty,
          price: i.price ?? i.unitPrice,
          cost: i.cost ?? i.unitCost,
          total: i.lineTotal,
        }))
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load sale for editing';
      onShowToast('Error', msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingSale(null);
    setCart([]);
    setStockAlert(null);
  };

  const handleConfirmDeleteSale = async () => {
    if (!deletingSale) return;
    setIsDeleting(true);
    try {
      const result = await deleteSale(deletingSale.id);
      onShowToast(
        'Deleted',
        `Sale #${result.saleNo || deletingSale.number || deletingSale.saleNo} Deleted`,
        'success'
      );
      setDeletingSale(null);
      if (editingSale && editingSale.id === deletingSale.id) {
        handleCancelEdit();
      }
      await loadData();
      window.dispatchEvent(new CustomEvent('trackops:data_updated'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete sale';
      onShowToast('Cannot Delete', msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveSale = async () => {
    if (cart.length === 0) {
      onShowToast('Validation Error', 'Add at least one product to save the sale.', 'error');
      return;
    }

    // Double check local stock availability before calling API
    for (const item of cart) {
      const p = products.find((prod) => prod.id === item.productId);
      if (p) {
        const maxAvailable = getEffectiveAvailableStock(p);
        if (item.qty > maxAvailable) {
          setStockAlert(
            `Insufficient stock for "${item.name} (${item.unit})". Available: ${maxAvailable}`
          );
          return;
        }
      }
    }

    setIsSubmitting(true);
    setStockAlert(null);

    try {
      const itemsPayload = cart.map((i) => ({ productId: i.productId, qty: i.qty }));

      if (editingSale) {
        const updated = await updateSale(editingSale.id, {
          paymentMethod,
          items: itemsPayload,
        });

        setCart([]);
        setEditingSale(null);
        setStockAlert(null);

        // Clear cached details for this sale so it refreshes on expand
        setSaleDetails((prev) => {
          const copy = { ...prev };
          delete copy[String(updated.id)];
          return copy;
        });

        onShowToast(
          'Updated',
          `Sale #${updated.number || updated.saleNo} Updated (${formatINR(updated.total)})`,
          'success'
        );
      } else {
        const newSale = await createSale({
          paymentMethod,
          items: itemsPayload,
        });

        setCompletedSale(newSale);
        setCart([]);
        setStockAlert(null);
        onShowToast(
          'Saved',
          `Sale #${newSale.number || newSale.saleNo} Completed (${formatINR(newSale.total)})`,
          'success'
        );
      }

      await loadData();
      window.dispatchEvent(new CustomEvent('trackops:data_updated'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sale transaction failed';
      setStockAlert(message);
      onShowToast('Error Recording Sale', message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleExpandSale = async (saleId: number) => {
    const key = String(saleId);
    if (expandedSaleId === key) {
      setExpandedSaleId(null);
      return;
    }

    setExpandedSaleId(key);

    if (!saleDetails[key]) {
      setIsLoadingSaleDetails(key);
      try {
        const detail = await getSale(saleId);
        setSaleDetails((prev) => ({ ...prev, [key]: detail }));
      } catch {
        onShowToast('Error', 'Failed to load sale breakdown', 'error');
      } finally {
        setIsLoadingSaleDetails(null);
      }
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleDownloadPDFReceipt = (sale: ApiSale) => {
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 150],
    });

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('TrackOps Stall', 40, 10, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Receipt #${sale.number || sale.saleNo}`, 40, 15, { align: 'center' });
    doc.text(formatDateTime(sale.createdAt || sale.soldAt || ''), 40, 19, { align: 'center' });
    doc.text(`Paid via: ${sale.paymentMethod}`, 40, 23, { align: 'center' });

    autoTable(doc, {
      startY: 27,
      head: [['Item', 'Qty', 'Price', 'Total']],
      body: sale.items.map((i) => [
        `${i.productName} (${i.unitType})`,
        i.qty.toString(),
        formatRs(i.price ?? i.unitPrice),
        formatRs(i.lineTotal),
      ]),
      theme: 'plain',
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fontStyle: 'bold', textColor: [15, 23, 42] },
    });

    const lastY = (doc as any).lastAutoTable?.finalY || 60;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Grand Total: ${formatRs(sale.total ?? sale.totalAmount ?? 0)}`, 74, lastY + 8, { align: 'right' });

    doc.save(`TrackOps_Bill_${sale.number || sale.saleNo}.pdf`);
  };

  const handleShareReceipt = async (sale: ApiSale) => {
    const billSummary = `TrackOps Stall Bill #${sale.number || sale.saleNo}\nDate: ${formatDateTime(
      sale.createdAt || sale.soldAt || ''
    )}\nItems:\n${sale.items
      .map((i) => `- ${i.productName} (${i.unitType}) x${i.qty}: ₹${i.lineTotal}`)
      .join('\n')}\nGrand Total: ₹${sale.total ?? sale.totalAmount ?? 0} (${sale.paymentMethod})\nThank you!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bill #${sale.number || sale.saleNo}`,
          text: billSummary,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(billSummary);
      onShowToast('Bill Copied', 'Receipt details copied to clipboard for sharing', 'info');
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-on-surface-variant font-medium">Loading sales counter...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full pb-20">
      {/* Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md mb-space-lg">
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <span className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
            Today's Revenue
          </span>
          <div className="flex items-baseline justify-between mt-space-xs">
            <span className="font-headline-lg text-xl font-bold text-on-surface">
              {formatINR(todayRevenue)}
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <span className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
            Completed Bills
          </span>
          <div className="flex items-baseline justify-between mt-space-xs">
            <span className="font-headline-lg text-xl font-bold text-on-surface">
              {todayCompletedBills}
            </span>
            <span className="text-xs text-on-surface-variant">today</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <span className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
            Cart Items
          </span>
          <div className="flex items-baseline justify-between mt-space-xs">
            <span className="font-headline-lg text-xl font-bold text-on-surface">
              {totalItemCount}
            </span>
            <span className="text-xs text-on-surface-variant">units</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <span className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
            Stock Availability
          </span>
          <div className="flex items-baseline justify-between mt-space-xs">
            <span className="font-headline-lg text-xl font-bold text-secondary">
              {products.filter((p) => p.stockQty > 0).length}
            </span>
            <span className="text-xs text-on-surface-variant">/ {products.length} ready</span>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left = Product Catalog, Right = Active Cart & Bill */}
      {products.length === 0 ? (
        <div className="py-16 px-4 bg-surface-container-lowest rounded-2xl border border-surface-container-low text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-4">
            <span className="material-symbols-outlined text-3xl">point_of_sale</span>
          </div>
          <h2 className="text-lg font-bold text-on-surface">No products yet</h2>
          <p className="text-sm text-on-surface-variant max-w-sm mt-1 mb-6">
            You must add items to your inventory catalog before creating sales bills.
          </p>
          <button
            onClick={() => {
              window.location.hash = 'inventory';
            }}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/90 shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            <span>Add Product</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* Product Catalog Grid (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-space-md">
            {/* Search Box */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search products by name or format..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-9 bg-surface-container-lowest text-on-surface text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-xs border border-surface-container-low"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            {/* Product Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((p) => {
                const inCart = cart.find((i) => i.productId === p.id);
                const maxAvailable = getEffectiveAvailableStock(p);
                const isOutOfStock = maxAvailable <= 0;
                const isLow = maxAvailable > 0 && maxAvailable <= 10;

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && handleAddToCart(p)}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all select-none ${
                      isOutOfStock
                        ? 'bg-surface-container-low/40 border-surface-container-low opacity-60 cursor-not-allowed'
                        : inCart
                        ? 'bg-primary-container/20 border-primary cursor-pointer shadow-xs'
                        : 'bg-surface-container-lowest border-surface-container-low hover:border-outline hover:shadow-xs cursor-pointer active:scale-[0.98]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="text-xs font-semibold text-on-surface line-clamp-2 leading-tight">
                          {p.name}
                        </span>
                        {inCart && (
                          <span className="w-5 h-5 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                            {inCart.qty}
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                        {p.unitType}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-surface-container-low">
                      <span className="text-sm font-bold text-on-surface">
                        {formatINR(p.sellPrice)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          isOutOfStock
                            ? 'bg-error-container text-on-error-container'
                            : isLow
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {isOutOfStock ? 'Out of stock' : `${maxAvailable} left`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Cart & Bill Builder (5 cols) */}
          <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-surface-container-low flex flex-col gap-space-md">
            {/* Header / Edit Mode Banner */}
            {editingSale ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px]">
                    edit_note
                  </span>
                  <div>
                    <h2 className="font-bold text-xs text-amber-700 dark:text-amber-300">
                      Editing Sale #{editingSale.number || editingSale.saleNo}
                    </h2>
                    <span className="text-[11px] text-on-surface-variant">
                      Original: {formatINR(editingSale.total ?? editingSale.totalAmount ?? 0)} ({editingSale.paymentMethod})
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
                  <span className="material-symbols-outlined text-primary text-[18px]">receipt_long</span>
                  <span>Active Bill</span>
                </h2>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCart}
                    disabled={isSubmitting}
                    className="text-xs text-error hover:underline font-medium cursor-pointer disabled:opacity-50"
                  >
                    Clear Cart
                  </button>
                )}
              </div>
            )}

            {/* Stock Alert Warning Banner (409 or capacity error) */}
            {stockAlert && (
              <div className="p-3 bg-error-container/40 border border-error-container text-xs text-on-error-container rounded-lg flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] text-error shrink-0">warning</span>
                <span className="font-medium">{stockAlert}</span>
              </div>
            )}

            {/* Cart Items List */}
            <div className="min-h-[160px] max-h-72 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-surface-container rounded-xl flex flex-col items-center justify-center text-on-surface-variant text-center px-4">
                  <span className="material-symbols-outlined text-3xl mb-1 text-outline">shopping_basket</span>
                  <p className="text-xs font-medium">Cart is currently empty.</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Click any product from the catalog to add to bill.</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-container-low">
                  {cart.map((item) => (
                    <div key={item.productId} className="py-2.5 flex items-center justify-between text-xs gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-on-surface block truncate">{item.name}</span>
                        <span className="text-[11px] text-on-surface-variant">
                          {formatINR(item.price)} • {item.unit}
                        </span>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, -1)}
                          disabled={isSubmitting}
                          className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high flex items-center justify-center font-bold text-xs cursor-pointer disabled:opacity-50"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-bold text-xs text-on-surface">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, 1)}
                          disabled={isSubmitting}
                          className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high flex items-center justify-center font-bold text-xs cursor-pointer disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right w-16">
                        <span className="font-bold text-xs text-on-surface block">
                          {formatINR(item.total)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.productId)}
                        disabled={isSubmitting}
                        className="text-on-surface-variant hover:text-error p-1 cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Calculations & Payment Mode */}
            <div className="pt-2 border-t border-surface-container-low space-y-2 text-xs">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>Total Items</span>
                <span className="font-semibold text-on-surface">{totalItemCount} posters</span>
              </div>

              {/* Payment Mode Cash / UPI toggle */}
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                  Payment Mode *
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
                    UPI / QR
                  </button>
                </div>
              </div>

              {/* Grand Total */}
              <div className="pt-3 border-t border-surface-container-low flex items-baseline justify-between">
                <span className="font-bold text-sm text-on-surface uppercase">Grand Total</span>
                <span className="text-xl font-bold text-secondary">
                  {formatINR(grandTotal)}
                </span>
              </div>

              {/* Save / Checkout Button */}
              <div className="flex items-center gap-2 mt-2">
                {editingSale && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleCancelEdit}
                    className="px-4 h-11 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveSale}
                  disabled={cart.length === 0 || isSubmitting}
                  className="flex-1 h-11 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                      <span>{editingSale ? 'Updating Sale...' : 'Processing Sale...'}</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">
                        {editingSale ? 'save' : 'point_of_sale'}
                      </span>
                      <span>
                        {editingSale
                          ? `Update Sale (${formatINR(grandTotal)})`
                          : `Complete Sale (${formatINR(grandTotal)})`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Sales History Section */}
      <div className="mt-space-lg bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-xs mb-space-sm border-b border-surface-container-low gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">history</span>
            <h2 className="font-bold text-sm text-on-surface">Recent Sales History</h2>
            <span className="text-xs text-on-surface-variant font-medium">
              ({filteredSales.length} {filteredSales.length === 1 ? 'sale' : 'sales'})
            </span>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search bill # or payment..."
              value={salesSearch}
              onChange={(e) => setSalesSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-7 bg-surface-container-low text-on-surface text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {salesSearch && (
              <button
                type="button"
                onClick={() => setSalesSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <div className="py-12 text-center text-on-surface-variant flex flex-col items-center">
            <span className="material-symbols-outlined text-3xl mb-1 text-outline">receipt_long</span>
            <p className="text-xs font-semibold text-on-surface">No sales yet</p>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Completed sales bills will appear here with line item breakdowns.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-surface-container-low">
            {filteredSales.map((sale) => {
              const key = String(sale.id);
              const isExpanded = expandedSaleId === key;
              const detail = saleDetails[key];
              const isLoadingThis = isLoadingSaleDetails === key;

              return (
                <div key={sale.id} className="py-2.5">
                  <div
                    onClick={() => handleToggleExpandSale(sale.id)}
                    className="flex items-center justify-between cursor-pointer hover:bg-surface-container-low/50 p-2 rounded-xl transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-on-surface font-mono">
                          #{sale.number || sale.saleNo}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container font-medium text-on-surface-variant">
                          {sale.paymentMethod}
                        </span>
                      </div>
                      <span className="text-[11px] text-on-surface-variant block mt-0.5">
                        {formatDateTime(sale.createdAt || sale.soldAt || '')} • {sale.itemCount} items
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-secondary">
                        {formatINR(sale.total ?? sale.totalAmount ?? 0)}
                      </span>
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 pl-3 pr-3 py-2.5 bg-surface-container-low/60 rounded-xl text-xs space-y-2 border border-surface-container-low">
                      {isLoadingThis ? (
                        <div className="py-3 text-center text-on-surface-variant flex items-center justify-center gap-2">
                          <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <span>Loading bill breakdown...</span>
                        </div>
                      ) : detail ? (
                        <>
                          <div className="divide-y divide-surface-container-low">
                            {detail.items.map((item, idx) => (
                              <div key={idx} className="py-1.5 flex items-center justify-between text-[11px]">
                                <span>
                                  {item.productName}{' '}
                                  <span className="text-on-surface-variant">
                                    ({item.qty} {item.unitType} @ {formatINR(item.price ?? item.unitPrice)})
                                  </span>
                                </span>
                                <span className="font-semibold text-on-surface">
                                  {formatINR(item.lineTotal)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="pt-1.5 border-t border-surface-container-low flex justify-between text-xs font-bold">
                            <span>Total Amount</span>
                            <span className="text-secondary">{formatINR(detail.total ?? detail.totalAmount ?? 0)}</span>
                          </div>

                          {/* Actions: Print, PDF, Edit, Delete */}
                          <div className="pt-2 border-t border-surface-container-low flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCompletedSale(detail);
                                }}
                                className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-on-surface rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">receipt</span>
                                <span>Receipt</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadPDFReceipt(detail);
                                }}
                                className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-on-surface rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">download</span>
                                <span>PDF</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isSubmitting || isDeleting}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditSale(detail);
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
                                  setDeletingSale(sale);
                                }}
                                className="px-2.5 py-1 bg-error-container/40 hover:bg-error-container text-on-error-container rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-error">Failed to load bill breakdown.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => !isDeleting && setDeletingSale(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
          />
          <div className="relative w-full max-w-sm bg-surface-container-lowest rounded-2xl p-5 shadow-2xl border border-surface-container-low">
            <div className="flex items-center gap-3 pb-3 border-b border-surface-container-low">
              <div className="w-10 h-10 rounded-full bg-error-container/50 text-error flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div>
                <h3 className="font-bold text-sm text-on-surface">Delete Sale?</h3>
                <span className="text-xs text-on-surface-variant font-mono">
                  #{deletingSale.number || deletingSale.saleNo} • {formatINR(deletingSale.total ?? deletingSale.totalAmount ?? 0)}
                </span>
              </div>
            </div>

            <div className="py-3 text-xs text-on-surface-variant space-y-2">
              <p>
                Deleting this sale voucher will return all poster items back into inventory stock.
              </p>
              <p className="text-[11px] text-on-surface-variant">
                Compensating stock movements will be recorded to maintain complete audit history.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingSale(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteSale}
                className="px-4 py-1.5 bg-error text-on-error rounded-lg text-xs font-semibold hover:bg-error/90 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Sale Bill Modal with Print / Share / PDF */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setCompletedSale(null)} className="absolute inset-0 bg-black/40 backdrop-blur-xs" />
          <div className="relative w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-low p-5 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="text-center pb-3 border-b border-surface-container-low">
              <div className="w-10 h-10 rounded-full bg-secondary-container/40 text-secondary mx-auto flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-2xl">check_circle</span>
              </div>
              <h3 className="font-bold text-base text-on-surface">Sale Completed</h3>
              <p className="text-xs text-on-surface-variant font-mono">Bill #{completedSale.number || completedSale.saleNo}</p>
              <p className="text-[11px] text-on-surface-variant">{formatDateTime(completedSale.createdAt || completedSale.soldAt || '')}</p>
            </div>

            {/* Bill Lines */}
            <div className="py-3 max-h-48 overflow-y-auto divide-y divide-surface-container-low text-xs">
              {completedSale.items.map((item, idx) => (
                <div key={idx} className="py-1.5 flex justify-between">
                  <span>
                    {item.productName} ({item.unitType}){' '}
                    <span className="text-on-surface-variant">(x{item.qty})</span>
                  </span>
                  <span className="font-semibold text-on-surface">{formatINR(item.lineTotal)}</span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="py-2 border-t border-surface-container-low flex justify-between text-sm font-bold">
              <span>Paid via {completedSale.paymentMethod}</span>
              <span className="text-secondary">{formatINR(completedSale.total ?? completedSale.totalAmount ?? 0)}</span>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-surface-container-low">
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="py-2 bg-surface-container hover:bg-surface-container-high rounded-lg text-xs font-semibold text-on-surface flex items-center justify-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPDFReceipt(completedSale)}
                className="py-2 bg-surface-container hover:bg-surface-container-high rounded-lg text-xs font-semibold text-on-surface flex items-center justify-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handleShareReceipt(completedSale)}
                className="py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">share</span>
                <span>Share</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCompletedSale(null)}
              className="w-full mt-3 py-2 text-xs font-medium text-on-surface-variant hover:text-on-surface text-center cursor-pointer"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
