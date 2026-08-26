import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ProductEditorDrawer } from '../components/ProductEditorDrawer';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { Pagination } from '../components/ui/Pagination';
import { apiFetch } from '../lib/api';
import { formatCurrency } from '../lib/utils';

type Product = {
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
};

type ProductListResponse = {
  items: Product[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
};
type CategoryListResponse = { items: string[] };

function buildQueryString(params: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') query.set(key, String(value));
  });
  return query.toString() ? `?${query.toString()}` : '';
}

function normalizeSearch(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') ?? '');
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') ?? '');
  const [activeFilter, setActiveFilter] = useState(() => searchParams.get('active') ?? '');
  const [autoUpdateFilter, setAutoUpdateFilter] = useState(() => searchParams.get('auto_update_enabled') ?? '');
  const [page, setPage] = useState(() => Number(searchParams.get('page')) || 1);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState({ page: 1, page_size: 10, total: 0, total_pages: 1 });

  const fetchCategoryOptions = useCallback(async () => {
    try {
      const response = await apiFetch<CategoryListResponse>('/api/products/categories');
      setCategoryOptions(response.items);
    } catch {
      setCategoryOptions([]);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = buildQueryString({
        search,
        category: categoryFilter,
        active: activeFilter || undefined,
        auto_update_enabled: autoUpdateFilter || undefined,
        page,
        page_size: 10,
      });
      const response = await apiFetch<ProductListResponse>(`/api/products${query}`);
      setProducts(response.items);
      setPageInfo(response.pagination);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  }, [activeFilter, autoUpdateFilter, categoryFilter, page, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalized = normalizeSearch(searchInput);
      setSearch((current) => (current === normalized ? current : normalized));
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (search) nextParams.set('search', search);
    if (categoryFilter) nextParams.set('category', categoryFilter);
    if (activeFilter) nextParams.set('active', activeFilter);
    if (autoUpdateFilter) nextParams.set('auto_update_enabled', autoUpdateFilter);
    if (page > 1) nextParams.set('page', String(page));
    setSearchParams(nextParams, { replace: true });
  }, [activeFilter, autoUpdateFilter, categoryFilter, page, search, setSearchParams]);

  useEffect(() => {
    void fetchCategoryOptions();
  }, [fetchCategoryOptions]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const hasFilters = Boolean(searchInput || categoryFilter || activeFilter || autoUpdateFilter);
  const firstResult = pageInfo.total === 0 ? 0 : (pageInfo.page - 1) * pageInfo.page_size + 1;
  const lastResult = Math.min(pageInfo.page * pageInfo.page_size, pageInfo.total);

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setCategoryFilter('');
    setActiveFilter('');
    setAutoUpdateFilter('');
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">Products</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Product catalog</h2>
          </div>
          {successMessage ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{successMessage}</p> : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="sr-only" htmlFor="product-search">Search products</label>
          <input id="product-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by name, SKU, vendor ID, or category" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
          <label className="sr-only" htmlFor="product-category">Filter category</label>
          <select id="product-category" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200">
            <option value="">All categories</option>
            {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <label className="sr-only" htmlFor="product-active">Filter active status</label>
          <select id="product-active" value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1); }} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200">
            <option value="">All active states</option><option value="true">Active only</option><option value="false">Inactive only</option>
          </select>
          <label className="sr-only" htmlFor="product-auto-update">Filter auto update</label>
          <select id="product-auto-update" value={autoUpdateFilter} onChange={(event) => { setAutoUpdateFilter(event.target.value); setPage(1); }} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200">
            <option value="">All update settings</option><option value="true">Auto-update enabled</option><option value="false">Auto-update disabled</option>
          </select>
        </div>

        {hasFilters ? (
          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
            {searchInput ? <button type="button" onClick={() => setSearchInput('')} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">Search: {searchInput} x</button> : null}
            {categoryFilter ? <button type="button" onClick={() => { setCategoryFilter(''); setPage(1); }} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">Category: {categoryFilter} x</button> : null}
            {activeFilter ? <button type="button" onClick={() => { setActiveFilter(''); setPage(1); }} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">Active: {activeFilter === 'true' ? 'yes' : 'no'} x</button> : null}
            {autoUpdateFilter ? <button type="button" onClick={() => { setAutoUpdateFilter(''); setPage(1); }} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">Auto-update: {autoUpdateFilter === 'true' ? 'yes' : 'no'} x</button> : null}
            <button type="button" onClick={clearFilters} className="rounded-xl px-2 py-1 text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900">Clear all filters</button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <p aria-live="polite">{search ? `${pageInfo.total} products found for “${search}”` : `${pageInfo.total} products found`}</p>
          {pageInfo.total > 0 ? <p>Showing {firstResult}-{lastResult} of {pageInfo.total}</p> : null}
        </div>
        {loading ? <LoadingState message="Loading products..." /> : error ? <ErrorState message={error} onRetry={() => void fetchProducts()} /> : products.length === 0 ? (
          <div className="space-y-3"><EmptyState title="No products found" description={search ? `No products match “${search}”.` : 'Try a different filter or search term.'} />{hasFilters ? <button type="button" onClick={clearFilters} className="mx-auto block rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Clear search and filters</button> : null}</div>
        ) : (
          <>
            <div className="hidden w-full overflow-x-auto md:block">
              <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm text-slate-700">
                <caption className="sr-only">Product catalog with pricing and automation settings</caption>
                <thead className="sticky top-0 z-10"><tr className="bg-slate-50 text-slate-600">
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 font-medium">Product name</th><th scope="col" className="border-b border-slate-200 px-3 py-3 font-medium">SKU</th><th scope="col" className="border-b border-slate-200 px-3 py-3 font-medium">Category</th><th scope="col" className="border-b border-slate-200 px-3 py-3 text-right font-medium">Vendor cost</th><th scope="col" className="border-b border-slate-200 px-3 py-3 text-right font-medium">POS price</th><th scope="col" className="border-b border-slate-200 px-3 py-3 text-right font-medium">Target margin</th><th scope="col" className="border-b border-slate-200 px-3 py-3 font-medium">Auto update</th><th scope="col" className="border-b border-slate-200 px-3 py-3 font-medium">Active</th><th scope="col" className="border-b border-slate-200 px-3 py-3 text-right font-medium">Edit</th>
                </tr></thead>
                <tbody>{products.map((product) => <tr key={product.id} className="align-top transition hover:bg-slate-50 focus-within:bg-slate-50">
                  <td className="border-b border-slate-200 px-3 py-3 font-medium text-slate-900"><div>{product.name}</div><div className="mt-1 text-xs font-normal text-slate-500">Vendor ID: {product.vendor_product_id}</div></td><td className="border-b border-slate-200 px-3 py-3">{product.sku}</td><td className="border-b border-slate-200 px-3 py-3">{product.category ?? '—'}</td><td className="border-b border-slate-200 px-3 py-3 text-right">{formatCurrency(product.current_vendor_cost)}</td><td className="border-b border-slate-200 px-3 py-3 text-right">{formatCurrency(product.current_pos_price)}</td><td className="border-b border-slate-200 px-3 py-3 text-right">{Number(product.target_margin_pct).toFixed(2)}%</td><td className="border-b border-slate-200 px-3 py-3">{product.auto_update_enabled ? 'Enabled' : 'Disabled'}</td><td className="border-b border-slate-200 px-3 py-3">{product.active ? 'Active' : 'Inactive'}</td><td className="border-b border-slate-200 px-3 py-3 text-right"><button type="button" onClick={() => setSelectedProductId(product.id)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400">Edit</button></td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">{products.map((product) => <article key={product.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{product.name}</h3><p className="mt-1 text-xs text-slate-500">{product.sku} · Vendor ID: {product.vendor_product_id}</p></div><button type="button" onClick={() => setSelectedProductId(product.id)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">Edit</button></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Category</dt><dd>{product.category ?? '—'}</dd></div><div><dt className="text-slate-500">Active</dt><dd>{product.active ? 'Yes' : 'No'}</dd></div><div><dt className="text-slate-500">Vendor cost</dt><dd>{formatCurrency(product.current_vendor_cost)}</dd></div><div><dt className="text-slate-500">POS price</dt><dd>{formatCurrency(product.current_pos_price)}</dd></div><div><dt className="text-slate-500">Target margin</dt><dd>{Number(product.target_margin_pct).toFixed(2)}%</dd></div><div><dt className="text-slate-500">Auto update</dt><dd>{product.auto_update_enabled ? 'Enabled' : 'Disabled'}</dd></div></dl></article>)}</div>
            <Pagination page={pageInfo.page} totalPages={pageInfo.total_pages} onPageChange={setPage} />
          </>
        )}
      </section>

      <ProductEditorDrawer productId={selectedProductId} isOpen={selectedProductId !== null} onClose={() => setSelectedProductId(null)} onSaved={async () => { setSuccessMessage('Product updated successfully.'); await Promise.all([fetchProducts(), fetchCategoryOptions()]); }} />
    </div>
  );
}
