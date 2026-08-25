import { useCallback, useEffect, useMemo, useState } from 'react';

import { PriceChangeDetailDrawer } from '../components/PriceChangeDetailDrawer';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { MetricCard } from '../components/ui/MetricCard';
import { Pagination } from '../components/ui/Pagination';
import { StatusBadge } from '../components/ui/StatusBadge';
import { apiFetch } from '../lib/api';
import { formatCurrency, formatDate, formatPercent } from '../lib/utils';

type DashboardSummary = {
  products_monitored: number;
  changes_today: number;
  auto_updated_today: number;
  review_required_count: number;
  unmatched_vendor_products: number;
  most_recent_sync: SyncRun | null;
  total_price_change_logs: number;
};

type SyncRun = {
  id: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  vendor_records_received: number;
  products_matched: number;
  prices_changed: number;
  prices_updated: number;
  review_required: number;
  unmatched_vendor_products: number;
  error_message: string | null;
};

type PriceChange = {
  id: number;
  product_name: string;
  vendor_product_id: string;
  old_vendor_cost: number | string | null;
  new_vendor_cost: number | string;
  old_pos_price: number | string | null;
  suggested_pos_price: number | string | null;
  change_pct: number | string | null;
  status: string;
  processed_at: string;
};

type PriceChangeListResponse = {
  items: PriceChange[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

type CategoryListResponse = {
  items: Array<{ category: string | null }>;
};

const sortOptions = [
  { value: 'processed_at', label: 'Processed date' },
  { value: 'product_name', label: 'Product name' },
  { value: 'status', label: 'Status' },
  { value: 'change_pct', label: 'Change %' },
] as const;

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<(typeof sortOptions)[number]['value']>('processed_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pageInfo, setPageInfo] = useState({ page: 1, total_pages: 1, total: 0, page_size: 25 });
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);

    try {
      const response = await apiFetch<DashboardSummary>('/api/dashboard/summary');
      setSummary(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load dashboard summary.';
      setSummaryError(message);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchCategoryOptions = useCallback(async () => {
    try {
      const response = await apiFetch<CategoryListResponse>('/api/products?page=1&page_size=100');
      const categories = Array.from(
        new Set(
          response.items
            .map((item) => item.category)
            .filter((category): category is string => Boolean(category && category.trim())),
        ),
      ).sort((a, b) => a.localeCompare(b));

      setCategoryOptions(categories);
    } catch {
      setCategoryOptions([]);
    }
  }, []);

  const fetchPriceChanges = useCallback(async () => {
    setTableLoading(true);
    setTableError(null);

    try {
      const query = buildQueryString({
        search: searchQuery,
        category: selectedCategory,
        status: statusFilter,
        page: tablePage,
        page_size: 10,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      const response = await apiFetch<PriceChangeListResponse>(`/api/price-changes${query}`);
      setPriceChanges(response.items);
      setPageInfo(response.pagination);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load recent price changes.';
      setTableError(message);
    } finally {
      setTableLoading(false);
    }
  }, [searchQuery, selectedCategory, statusFilter, tablePage, sortBy, sortOrder]);

  useEffect(() => {
    void fetchSummary();
    void fetchCategoryOptions();
  }, [fetchSummary, fetchCategoryOptions]);

  useEffect(() => {
    void fetchPriceChanges();
  }, [fetchPriceChanges]);

  const metrics = useMemo(() => {
    return [
      { title: 'Products monitored', value: summary?.products_monitored ?? 0 },
      { title: 'Changes today', value: summary?.changes_today ?? 0 },
      { title: 'Auto-updated today', value: summary?.auto_updated_today ?? 0 },
      { title: 'Needs review', value: summary?.review_required_count ?? 0 },
      { title: 'Unmatched vendor products', value: summary?.unmatched_vendor_products ?? 0 },
    ];
  }, [summary]);

  const statusOptions = ['', 'updated', 'review_required', 'rejected', 'no_change', 'failed', 'unmatched'];

  async function handleSync() {
    setSyncError(null);
    setSyncSuccess(null);
    setSyncing(true);

    try {
      const response = await apiFetch<SyncRun>('/api/sync/vendor-prices', { method: 'POST' });
      setSyncSuccess(
        `Sync completed: ${response.vendor_records_received} vendor records processed, ${response.prices_updated} prices updated, ${response.review_required} requiring review.`,
      );
      await Promise.all([fetchSummary(), fetchPriceChanges()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Vendor sync failed.';
      setSyncError(message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">Overview</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Dashboard</h2>
        </div>

        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={syncing}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {syncing ? 'Running sync…' : 'Run Vendor Sync'}
        </button>
      </div>

      {(syncSuccess || syncError) ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {syncSuccess ? <p className="text-sm font-medium text-emerald-700">{syncSuccess}</p> : null}
          {syncError ? <p className="text-sm font-medium text-red-700">{syncError}</p> : null}
        </div>
      ) : null}

      {summaryLoading ? (
        <LoadingState message="Loading dashboard summary…" />
      ) : summaryError ? (
        <ErrorState message={summaryError} onRetry={() => void fetchSummary()} />
      ) : summary ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {metrics.map((metric) => (
              <MetricCard key={metric.title} title={metric.title} value={metric.value} />
            ))}
          </section>

          {summary.most_recent_sync ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Most recent sync</h3>
                <StatusBadge status={summary.most_recent_sync.status} />
              </div>
              <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-3">
                <div>
                  <p className="text-slate-500">Started</p>
                  <p className="mt-1 font-medium text-slate-900">{formatDate(summary.most_recent_sync.started_at)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Completed</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {summary.most_recent_sync.completed_at ? formatDate(summary.most_recent_sync.completed_at) : 'In progress'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Processed</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {summary.most_recent_sync.prices_changed} price changes • {summary.most_recent_sync.prices_updated} updated
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">Price changes</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Recent updates</h3>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <input
              aria-label="Search recent price changes"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setTablePage(1);
              }}
              placeholder="Search product or SKU"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-slate-500"
            />
            <select
              aria-label="Filter by category"
              value={selectedCategory}
              onChange={(event) => {
                setSelectedCategory(event.target.value);
                setTablePage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            >
              <option value="">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setTablePage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            >
              <option value="">All statuses</option>
              {statusOptions.filter(Boolean).map((status) => (
                <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <select
            aria-label="Sort by"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as (typeof sortOptions)[number]['value'])}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'))}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          </button>
        </div>

        {tableLoading ? (
          <div className="mt-5"><LoadingState message="Loading recent price changes…" /></div>
        ) : tableError ? (
          <div className="mt-5"><ErrorState message={tableError} onRetry={() => void fetchPriceChanges()} /></div>
        ) : priceChanges.length === 0 ? (
          <div className="mt-5"><EmptyState title="No price changes found" description="Adjust filters or run a vendor sync to populate the dashboard." /></div>
        ) : (
          <>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-[1200px] w-full border-separate border-spacing-0 text-left text-sm text-slate-700">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Product</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">SKU / vendor product ID</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Old Cost</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">New Cost</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Change %</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Old POS Price</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Suggested POS Price</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Status</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Processed Date</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium text-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {priceChanges.map((change) => (
                    <tr key={change.id} className="align-top">
                      <td className="border-b border-slate-200 px-3 py-3 font-medium text-slate-900">{change.product_name}</td>
                      <td className="border-b border-slate-200 px-3 py-3">{change.vendor_product_id}</td>
                      <td className="border-b border-slate-200 px-3 py-3">{formatCurrency(change.old_vendor_cost)}</td>
                      <td className="border-b border-slate-200 px-3 py-3">{formatCurrency(change.new_vendor_cost)}</td>
                      <td className="border-b border-slate-200 px-3 py-3">{formatPercent(change.change_pct)}</td>
                      <td className="border-b border-slate-200 px-3 py-3">{formatCurrency(change.old_pos_price)}</td>
                      <td className="border-b border-slate-200 px-3 py-3">{formatCurrency(change.suggested_pos_price)}</td>
                      <td className="border-b border-slate-200 px-3 py-3"><StatusBadge status={change.status} /></td>
                      <td className="border-b border-slate-200 px-3 py-3">{formatDate(change.processed_at)}</td>
                      <td className="border-b border-slate-200 px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLogId(change.id)}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={pageInfo.page}
              totalPages={pageInfo.total_pages}
              onPageChange={(page) => setTablePage(page)}
            />
          </>
        )}
      </section>

      <PriceChangeDetailDrawer
        logId={selectedLogId}
        isOpen={selectedLogId !== null}
        onClose={() => setSelectedLogId(null)}
        onMutated={async () => {
          await fetchSummary();
          await fetchPriceChanges();
        }}
      />
    </div>
  );
}
