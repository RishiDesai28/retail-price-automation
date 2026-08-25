import { useCallback, useEffect, useState } from 'react';

import { PriceChangeDetailDrawer } from '../components/PriceChangeDetailDrawer';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { Pagination } from '../components/ui/Pagination';
import { StatusBadge } from '../components/ui/StatusBadge';
import { apiFetch } from '../lib/api';
import { formatCurrency, formatDate, formatPercent } from '../lib/utils';

type PriceChangeRecord = {
  id: number;
  product_name: string;
  vendor_product_id: string;
  old_vendor_cost: number | string | null;
  new_vendor_cost: number | string;
  old_pos_price: number | string | null;
  suggested_pos_price: number | string | null;
  change_pct: number | string | null;
  status: string;
  reason: string;
  processed_at: string;
};

type PriceChangeResponse = {
  items: PriceChangeRecord[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

type ProductListResponse = {
  items: Array<{ category: string | null }>;
};

function buildQueryString(params: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      query.set(key, String(value));
    }
  });

  return query.toString() ? `?${query.toString()}` : '';
}

const statusOptions = ['updated', 'review_required', 'rejected', 'no_change', 'failed', 'unmatched'];
const sortOptions = [
  { value: 'processed_at', label: 'Processed date' },
  { value: 'product_name', label: 'Product name' },
  { value: 'status', label: 'Status' },
  { value: 'change_pct', label: 'Change %' },
] as const;

export default function AuditLogPage() {
  const [records, setRecords] = useState<PriceChangeRecord[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState<(typeof sortOptions)[number]['value']>('processed_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [pageInfo, setPageInfo] = useState({ page: 1, page_size: 10, total: 0, total_pages: 1 });

  const fetchCategoryOptions = useCallback(async () => {
    try {
      const response = await apiFetch<ProductListResponse>('/api/products?page=1&page_size=100');
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

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryString = buildQueryString({
        search,
        category: categoryFilter,
        status: statusFilter,
        from_date: fromDate,
        to_date: toDate,
        page,
        page_size: 10,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      const response = await apiFetch<PriceChangeResponse>(`/api/price-changes${queryString}`);
      setRecords(response.items);
      setPageInfo(response.pagination);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load audit log.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, fromDate, page, search, sortBy, sortOrder, statusFilter, toDate]);

  useEffect(() => {
    void fetchCategoryOptions();
  }, [fetchCategoryOptions]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const hasFilters = Boolean(search || categoryFilter || statusFilter || fromDate || toDate);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">Audit log</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Review history</h2>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            aria-label="Search audit log"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search product or vendor ID"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          />

          <select
            aria-label="Filter audit by category"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          >
            <option value="">All categories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <select
            aria-label="Filter audit by status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          >
            <option value="">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <input
            aria-label="From date"
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          />

          <input
            aria-label="To date"
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <select
            aria-label="Sort audit log"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as (typeof sortOptions)[number]['value'])}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'))}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          </button>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategoryFilter('');
                setStatusFilter('');
                setFromDate('');
                setToDate('');
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm text-slate-600" aria-live="polite">{pageInfo.total} {pageInfo.total === 1 ? 'result' : 'results'}</p>
        {loading ? (
          <LoadingState message="Loading audit history…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void fetchRecords()} />
        ) : records.length === 0 ? (
          <EmptyState title="No audit records found" description="Adjust filters or run vendor sync to populate this view." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full border-separate border-spacing-0 text-left text-sm text-slate-700">
                <caption className="sr-only">Price-change audit history</caption>
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th scope="col" className="border-b border-slate-200 px-3 py-3 font-medium">Product</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-3 font-medium">Vendor product ID</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-3 text-right font-medium">Old cost</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-3 text-right font-medium">New cost</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-3 text-right font-medium">Change %</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-3 text-right font-medium">Suggested POS</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-3 font-medium">Status</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-3 font-medium">Reason</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-3 font-medium">Processed date</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-3 text-right font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="align-top">
                      <td className="border-b border-slate-200 px-3 py-3 font-medium text-slate-900">{record.product_name}</td>
                      <td className="border-b border-slate-200 px-3 py-3">{record.vendor_product_id}</td>
                      <td className="border-b border-slate-200 px-3 py-3 text-right">{formatCurrency(record.old_vendor_cost)}</td>
                      <td className="border-b border-slate-200 px-3 py-3 text-right">{formatCurrency(record.new_vendor_cost)}</td>
                      <td className="border-b border-slate-200 px-3 py-3 text-right">{formatPercent(record.change_pct)}</td>
                      <td className="border-b border-slate-200 px-3 py-3 text-right">{formatCurrency(record.suggested_pos_price)}</td>
                      <td className="border-b border-slate-200 px-3 py-3"><StatusBadge status={record.status} /></td>
                      <td className="border-b border-slate-200 px-3 py-3 text-slate-600">{record.reason}</td>
                      <td className="border-b border-slate-200 px-3 py-3">{formatDate(record.processed_at)}</td>
                      <td className="border-b border-slate-200 px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLogId(record.id)}
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
              onPageChange={(nextPage) => setPage(nextPage)}
            />
          </>
        )}
      </div>

      <PriceChangeDetailDrawer
        logId={selectedLogId}
        isOpen={selectedLogId !== null}
        onClose={() => setSelectedLogId(null)}
        onMutated={async () => {
          await fetchRecords();
        }}
      />
    </div>
  );
}
