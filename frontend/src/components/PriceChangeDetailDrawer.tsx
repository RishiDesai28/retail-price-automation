import { useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../lib/api';
import { formatCurrency, formatDate, formatPercent } from '../lib/utils';
import { StatusBadge } from './ui/StatusBadge';

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

type PriceChangeDetail = {
  id: number;
  sync_run_id: number;
  product_id: number | null;
  vendor_product_id: string;
  product_name: string;
  old_vendor_cost: number | string | null;
  new_vendor_cost: number | string;
  old_pos_price: number | string | null;
  suggested_pos_price: number | string | null;
  new_pos_price: number | string | null;
  change_pct: number | string | null;
  target_margin_pct: number | string | null;
  status: string;
  reason: string;
  reviewed_at: string | null;
  processed_at: string;
};

type PriceChangeDetailDrawerProps = {
  logId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onMutated?: () => Promise<void> | void;
};

export function PriceChangeDetailDrawer({ logId, isOpen, onClose, onMutated }: PriceChangeDetailDrawerProps) {
  const [detail, setDetail] = useState<PriceChangeDetail | null>(null);
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!isOpen || !logId) {
      setDetail(null);
      setProduct(null);
      setError(null);
      setPendingAction(null);
      setRejectReason('');
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const log = await apiFetch<PriceChangeDetail>(`/api/price-changes/${logId}`);
        if (cancelled) {
          return;
        }

        setDetail(log);

        if (log.product_id) {
          const productData = await apiFetch<ProductRecord>(`/api/products/${log.product_id}`);
          if (!cancelled) {
            setProduct(productData);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : 'Unable to load price change details.';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, logId]);

  const showActionControls = detail?.status === 'review_required';

  const summaryRows = useMemo(
    () => [
      { label: 'Product', value: detail?.product_name ?? '—' },
      { label: 'SKU', value: product?.sku ?? '—' },
      { label: 'Category', value: product?.category ?? '—' },
      { label: 'Vendor product ID', value: detail?.vendor_product_id ?? '—' },
      { label: 'Old vendor cost', value: formatCurrency(detail?.old_vendor_cost) },
      { label: 'New vendor cost', value: formatCurrency(detail?.new_vendor_cost) },
      { label: 'Cost change', value: formatPercent(detail?.change_pct) },
      { label: 'Target margin', value: formatPercent(product?.target_margin_pct ?? detail?.target_margin_pct) },
      { label: 'Old POS price', value: formatCurrency(detail?.old_pos_price) },
      { label: 'Suggested POS price', value: formatCurrency(detail?.suggested_pos_price) },
      { label: 'Current/new POS price', value: formatCurrency(detail?.new_pos_price ?? product?.current_pos_price) },
      { label: 'Status', value: detail ? <StatusBadge status={detail.status} /> : '—' },
      { label: 'Decision reason', value: detail?.reason ?? '—' },
      { label: 'Processed date', value: detail ? formatDate(detail.processed_at) : '—' },
      { label: 'Reviewed date', value: detail?.reviewed_at ? formatDate(detail.reviewed_at) : '—' },
    ],
    [detail, product],
  );

  async function refreshAfterMutation() {
    if (onMutated) {
      await onMutated();
    }
  }

  async function handleApprove() {
    if (!detail) {
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      await apiFetch<PriceChangeDetail>(`/api/price-changes/${detail.id}/approve`, { method: 'POST' });
      await refreshAfterMutation();
      onClose();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'Unable to approve this price change.';
      setError(message);
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  }

  async function handleReject() {
    if (!detail || rejectReason.trim().length === 0) {
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      await apiFetch<PriceChangeDetail>(`/api/price-changes/${detail.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejection_reason: rejectReason.trim() }),
      });
      await refreshAfterMutation();
      onClose();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'Unable to reject this price change.';
      setError(message);
    } finally {
      setActionLoading(false);
      setPendingAction(null);
      setRejectReason('');
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Price change details</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">{detail?.product_name ?? 'Loading...'}</h3>
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
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Loading price change details…</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
          ) : detail ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-500">Status</p>
                  <StatusBadge status={detail.status} />
                </div>
                <p className="mt-3 text-sm text-slate-600">{detail.reason}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {summaryRows.map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
                    <div className="mt-2 text-sm text-slate-900">{value}</div>
                  </div>
                ))}
              </div>

              {showActionControls ? (
                <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  {pendingAction === 'reject' ? (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-slate-700">
                        Rejection reason
                        <textarea
                          value={rejectReason}
                          onChange={(event) => setRejectReason(event.target.value)}
                          rows={4}
                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                          placeholder="Provide a non-empty reason for the rejection"
                        />
                      </label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => void handleReject()}
                          disabled={actionLoading || rejectReason.trim().length === 0}
                          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-red-400"
                        >
                          {actionLoading ? 'Submitting rejection…' : 'Confirm reject'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingAction(null);
                            setRejectReason('');
                          }}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setPendingAction('approve')}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingAction('reject')}
                        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {pendingAction === 'approve' ? (
                    <div className="rounded-xl border border-emerald-200 bg-white p-3">
                      <p className="text-sm text-slate-700">Approve this recommended price change?</p>
                      <div className="mt-3 flex gap-3">
                        <button
                          type="button"
                          onClick={() => void handleApprove()}
                          disabled={actionLoading}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-400"
                        >
                          {actionLoading ? 'Approving…' : 'Confirm approval'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingAction(null)}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
