import { useEffect, useState } from 'react';

import { apiFetch } from '../lib/api';
import { formatCurrency } from '../lib/utils';

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

type ProductEditorDrawerProps = {
  productId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

export function ProductEditorDrawer({ productId, isOpen, onClose, onSaved }: ProductEditorDrawerProps) {
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [targetMargin, setTargetMargin] = useState('');
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !productId) {
      setProduct(null);
      setTargetMargin('');
      setAutoUpdateEnabled(false);
      setActive(true);
      setError(null);
      return;
    }

    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setError(null);

      try {
        const response = await apiFetch<ProductRecord>(`/api/products/${productId}`);
        if (cancelled) {
          return;
        }

        setProduct(response);
        setTargetMargin(String(response.target_margin_pct));
        setAutoUpdateEnabled(Boolean(response.auto_update_enabled));
        setActive(Boolean(response.active));
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : 'Unable to load product details.';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProduct();

    return () => {
      cancelled = true;
    };
  }, [isOpen, productId]);

  async function handleSave() {
    if (!product) {
      return;
    }

    const parsedMargin = Number(targetMargin);
    if (!Number.isFinite(parsedMargin) || parsedMargin < 0 || parsedMargin >= 100) {
      setError('Target margin must be a number between 0 and 100.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch<ProductRecord>(`/api/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          target_margin_pct: parsedMargin,
          auto_update_enabled: autoUpdateEnabled,
          active,
        }),
      });

      if (onSaved) {
        await onSaved();
      }
      onClose();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Product update failed.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Edit product</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">{product?.name ?? 'Loading...'}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 p-5">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Loading product details…</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
          ) : product ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">SKU</p>
                  <p className="mt-2 text-sm text-slate-900">{product.sku}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Vendor product</p>
                  <p className="mt-2 text-sm text-slate-900">{product.vendor_product_id}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Current vendor cost</p>
                  <p className="mt-2 text-sm text-slate-900">{formatCurrency(product.current_vendor_cost)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Current POS price</p>
                  <p className="mt-2 text-sm text-slate-900">{formatCurrency(product.current_pos_price)}</p>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <label className="block text-sm font-medium text-slate-700">
                  Target margin (%)
                  <input
                    type="number"
                    min={0}
                    max={99.99}
                    step="0.01"
                    value={targetMargin}
                    onChange={(event) => setTargetMargin(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </label>

                <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span>Auto-update enabled</span>
                  <input
                    type="checkbox"
                    checked={autoUpdateEnabled}
                    onChange={(event) => setAutoUpdateEnabled(event.target.checked)}
                    className="h-4 w-4"
                  />
                </label>

                <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span>Active</span>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(event) => setActive(event.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
