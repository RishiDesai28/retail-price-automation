import { useCallback, useEffect, useState } from 'react';

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
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [autoUpdateFilter, setAutoUpdateFilter] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryString = buildQueryString({
        search,
        category: categoryFilter,
        active: activeFilter === '' ? undefined : activeFilter,
        auto_update_enabled: autoUpdateFilter === '' ? undefined : autoUpdateFilter,
        page,
        page_size: 10,
      });

      const response = await apiFetch<ProductListResponse>(`/api/products${queryString}`);
      setProducts(response.items);
      setPageInfo(response.pagination);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load products.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, autoUpdateFilter, categoryFilter, page, search]);

  useEffect(() => {
    void fetchCategoryOptions();
  }, [fetchCategoryOptions]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">Products</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Product catalog</h2>
          </div>

          {successMessage ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              {successMessage}
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            aria-label="Search products"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by SKU or name"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          />

          <select
            aria-label="Filter category"
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
            aria-label="Filter active status"
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          >
            <option value="">All active states</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>

          <select
            aria-label="Filter auto update"
            value={autoUpdateFilter}
            onChange={(event) => {
              setAutoUpdateFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          >
            <option value="">All update settings</option>
            <option value="true">Auto-update enabled</option>
            <option value="false">Auto-update disabled</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <LoadingState message="Loading products…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void fetchProducts()} />
        ) : products.length === 0 ? (
          <EmptyState title="No products found" description="Try a different filter or search term." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full border-separate border-spacing-0 text-left text-sm text-slate-700">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">SKU</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Product</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Category</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Vendor cost</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">POS price</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Target margin</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Auto update</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Active</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium text-right">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="align-top">
                      <td className="border-b border-slate-200 px-3 py-3 font-medium text-slate-900">{product.sku}</td>
                      <td className="border-b border-slate-200 px-3 py-3">{product.name}</td>
                      <td className="border-b border-slate-200 px-3 py-3">{product.category ?? '—'}</td>
                      <td className="border-b border-slate-200 px-3 py-3">{formatCurrency(product.current_vendor_cost)}</td>
                      <td className="border-b border-slate-200 px-3 py-3">{formatCurrency(product.current_pos_price)}</td>
                      <td className="border-b border-slate-200 px-3 py-3">{Number(product.target_margin_pct).toFixed(2)}%</td>
                      <td className="border-b border-slate-200 px-3 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${product.auto_update_enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                          {product.auto_update_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="border-b border-slate-200 px-3 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${product.active ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-700'}`}>
                          {product.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="border-b border-slate-200 px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedProductId(product.id)}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
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

      <ProductEditorDrawer
        productId={selectedProductId}
        isOpen={selectedProductId !== null}
        onClose={() => setSelectedProductId(null)}
        onSaved={async () => {
          setSuccessMessage('Product updated successfully.');
          await fetchProducts();
          await fetchCategoryOptions();
        }}
      />
    </div>
  );
}
