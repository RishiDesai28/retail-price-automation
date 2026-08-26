import { useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../lib/api';
import { formatCurrency, formatPercent } from '../lib/utils';

type ProductRecord = {
  id: number;
  sku: string;
  name: string;
  category: string | null;
  vendor_product_id: string;
  current_vendor_cost: number | string | null;
  current_pos_price: number | string | null;
  target_margin_pct: number | string;
  auto_update_enabled: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type PricingMode = 'margin_based' | 'manual_price';

type PricingPreview = {
  suggested_pos_price: number | string | null;
  resulting_gross_margin_pct: number | string;
  gross_profit_per_unit: number | string;
};

type ProductEditorDrawerProps = {
  productId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

function toNumber(value: string | number | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function ProductEditorDrawer({ productId, isOpen, onClose, onSaved }: ProductEditorDrawerProps) {
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [mode, setMode] = useState<PricingMode>('margin_based');
  const [vendorCost, setVendorCost] = useState('');
  const [targetMargin, setTargetMargin] = useState('');
  const [posPrice, setPosPrice] = useState('');
  const [reason, setReason] = useState('');
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [active, setActive] = useState(true);
  const [preview, setPreview] = useState<PricingPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || productId === null) {
      setProduct(null);
      setError(null);
      setReason('');
      setPreview(null);
      setMode('margin_based');
      return;
    }

    let cancelled = false;
    async function loadProduct() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<ProductRecord>(`/api/products/${productId}`);
        if (cancelled) return;
        setProduct(response);
        setMode('margin_based');
        setPreview(null);
        setVendorCost(response.current_vendor_cost === null ? '' : String(response.current_vendor_cost));
        setPosPrice(response.current_pos_price === null ? '' : String(response.current_pos_price));
        setTargetMargin(String(response.target_margin_pct));
        setAutoUpdateEnabled(response.auto_update_enabled);
        setActive(response.active);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load product details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadProduct();
    return () => { cancelled = true; };
  }, [isOpen, productId]);

  useEffect(() => {
    const cost = toNumber(vendorCost);
    const margin = toNumber(targetMargin);
    const manualPrice = toNumber(posPrice);
    const validInputs = cost !== null && cost > 0 && (
      mode === 'margin_based'
        ? margin !== null && margin >= 0 && margin < 100
        : manualPrice !== null && manualPrice > 0
    );

    if (!isOpen || !validInputs) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    setPreviewLoading(true);
    void apiFetch<PricingPreview>('/api/pricing/calculate', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({
        vendor_cost: vendorCost,
        target_margin_pct: targetMargin.trim() ? targetMargin : undefined,
        pos_price: mode === 'manual_price' ? posPrice : undefined,
        pricing_mode: mode,
        reason: 'Preview pricing change',
      }),
    }).then((response) => {
      if (!controller.signal.aborted) setPreview(response);
    }).catch(() => {
      if (!controller.signal.aborted) setPreview(null);
    }).finally(() => {
      if (!controller.signal.aborted) setPreviewLoading(false);
    });

    return () => controller.abort();
  }, [isOpen, mode, posPrice, targetMargin, vendorCost]);

  const values = useMemo(() => {
    if (!preview) return null;
    const manualPrice = toNumber(posPrice);
    const newPrice = mode === 'margin_based' ? toNumber(preview.suggested_pos_price) : manualPrice;
    const profit = toNumber(preview.gross_profit_per_unit);
    const margin = toNumber(preview.resulting_gross_margin_pct);
    if (newPrice === null || profit === null || margin === null) return null;
    return { newPrice, profit, margin };
  }, [mode, posPrice, preview]);

  const validationMessage = useMemo(() => {
    const cost = toNumber(vendorCost);
    if (cost === null || cost <= 0) return 'Vendor cost must be greater than 0.';
    if (mode === 'margin_based') {
      const margin = toNumber(targetMargin);
      if (margin === null || margin < 0 || margin >= 100) return 'Target margin must be at least 0 and less than 100.';
    } else {
      const price = toNumber(posPrice);
      if (price === null || price <= 0) return 'POS price must be greater than 0.';
    }
    if (!reason.trim()) return 'Reason is required.';
    return null;
  }, [mode, posPrice, reason, targetMargin, vendorCost]);

  const comparison = useMemo(() => {
    const oldPrice = toNumber(product?.current_pos_price ?? null);
    if (!values || oldPrice === null) return null;
    return { difference: money(values.newPrice - oldPrice), percent: money(((values.newPrice - oldPrice) / oldPrice) * 100) };
  }, [product?.current_pos_price, values]);

  async function handleSave() {
    if (!product || validationMessage || !values) {
      setError(validationMessage ?? 'Enter valid pricing values.');
      return;
    }
    const confirmed = window.confirm(
      `${product.name}\n\nVendor cost: ${formatCurrency(product.current_vendor_cost)} -> ${formatCurrency(vendorCost)}\nPOS price: ${formatCurrency(product.current_pos_price)} -> ${formatCurrency(values.newPrice)}\nMargin: ${formatPercent(product.target_margin_pct)} -> ${formatPercent(values.margin)}\n\nReason: ${reason.trim()}\n\nSave this pricing change?`,
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/products/${product.id}/pricing`, {
        method: 'POST',
        body: JSON.stringify({
          vendor_cost: vendorCost,
          target_margin_pct: mode === 'margin_based' || targetMargin.trim() ? targetMargin : undefined,
          pos_price: mode === 'manual_price' ? posPrice : undefined,
          pricing_mode: mode,
          reason: reason.trim(),
          auto_update_enabled: autoUpdateEnabled,
          active,
        }),
      });
      await onSaved?.();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Pricing update failed.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;
  const currentCost = toNumber(product?.current_vendor_cost ?? null);
  const currentPrice = toNumber(product?.current_pos_price ?? null);
  const currentProfit = currentCost !== null && currentPrice !== null ? money(currentPrice - currentCost) : null;
  const currentMargin = currentCost !== null && currentPrice !== null ? money(((currentPrice - currentCost) / currentPrice) * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Edit pricing</p><h3 className="mt-1 text-xl font-semibold text-slate-900">{product?.name ?? 'Loading...'}</h3></div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400">Close</button>
        </div>
        <div className="space-y-5 p-5">
          {loading ? <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Loading product details...</div> : error && !product ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : product ? <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><p className="text-xs uppercase tracking-[0.12em] text-slate-500">SKU</p><p className="mt-1 text-sm font-medium">{product.sku}</p></div>
              <div><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Category</p><p className="mt-1 text-sm font-medium">{product.category ?? '—'}</p></div>
              <div><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Vendor ID</p><p className="mt-1 text-sm font-medium">{product.vendor_product_id}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 text-sm"><div><p className="text-slate-500">Current cost</p><p className="mt-1 font-semibold">{formatCurrency(product.current_vendor_cost)}</p></div><div><p className="text-slate-500">Current POS</p><p className="mt-1 font-semibold">{formatCurrency(product.current_pos_price)}</p></div><div><p className="text-slate-500">Current margin</p><p className="mt-1 font-semibold">{formatPercent(currentMargin)}</p><p className="text-xs text-slate-500">Profit {formatCurrency(currentProfit)}</p></div></div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Pricing mode"><button type="button" role="tab" aria-selected={mode === 'margin_based'} onClick={() => setMode('margin_based')} className={`rounded-lg px-3 py-2 text-sm font-medium ${mode === 'margin_based' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>Set from target margin</button><button type="button" role="tab" aria-selected={mode === 'manual_price'} onClick={() => setMode('manual_price')} className={`rounded-lg px-3 py-2 text-sm font-medium ${mode === 'manual_price' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>Set manual POS price</button></div>
            <div className="space-y-4 rounded-xl border border-slate-200 p-4">
              <label className="block text-sm font-medium">New vendor cost<input aria-label="New vendor cost" type="number" min="0.01" step="0.01" value={vendorCost} onChange={(event) => setVendorCost(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-slate-400" />{toNumber(vendorCost) !== null && toNumber(vendorCost)! <= 0 ? <span className="mt-1 block text-xs text-red-700">Vendor cost must be greater than 0.</span> : null}</label>
              {mode === 'margin_based' ? <label className="block text-sm font-medium">Target gross margin (%)<input aria-label="Target gross margin" type="number" min="0" max="99.99" step="0.01" value={targetMargin} onChange={(event) => setTargetMargin(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-slate-400" /></label> : <><label className="block text-sm font-medium">Manual POS selling price<input aria-label="Manual POS price" type="number" min="0.01" step="0.01" value={posPrice} onChange={(event) => setPosPrice(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-slate-400" /></label><label className="block text-sm font-medium">Optional target margin (%)<input aria-label="Optional target margin" type="number" min="0" max="99.99" step="0.01" value={targetMargin} onChange={(event) => setTargetMargin(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-slate-400" /></label></>}
              <label className="block text-sm font-medium">Reason for change<textarea aria-label="Reason for pricing change" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="Explain this pricing change" /></label>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4"><p className="text-sm font-semibold text-sky-950">Live preview</p>{values ? <div className="mt-3 grid grid-cols-3 gap-3 text-sm"><div><p className="text-slate-600">New POS price</p><p className="mt-1 font-semibold">{formatCurrency(values.newPrice)}</p></div><div><p className="text-slate-600">Gross profit</p><p className="mt-1 font-semibold">{formatCurrency(values.profit)}</p></div><div><p className="text-slate-600">Gross margin</p><p className="mt-1 font-semibold">{formatPercent(values.margin)}</p></div></div> : <p className="mt-2 text-sm text-slate-600">Enter valid values to see the preview.</p>}{comparison ? <p className="mt-3 text-sm text-slate-700">Previous POS {formatCurrency(product.current_pos_price)} → {formatCurrency(values?.newPrice ?? null)} ({comparison.difference >= 0 ? '+' : ''}{formatCurrency(comparison.difference)} / {comparison.percent >= 0 ? '+' : ''}{comparison.percent.toFixed(2)}%)</p> : null}{mode === 'manual_price' && values && toNumber(targetMargin) !== null && values.margin < Number(targetMargin) ? <p className="mt-3 text-sm font-medium text-amber-800">Warning: resulting margin is below the target margin.</p> : null}</div>
            <div className="flex items-center justify-between gap-3"><div className="flex gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={autoUpdateEnabled} onChange={(event) => setAutoUpdateEnabled(event.target.checked)} />Auto-update</label><label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />Active</label></div><div className="flex gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium">Cancel</button><button type="button" onClick={() => void handleSave()} disabled={saving || Boolean(validationMessage) || !values} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400">{saving ? 'Saving...' : 'Save pricing'}</button></div></div>
            {error && product ? <p className="text-sm text-red-700">{error}</p> : validationMessage ? <p className="text-sm text-slate-600">{validationMessage}</p> : null}
          </> : null}
        </div>
      </div>
    </div>
  );
}
