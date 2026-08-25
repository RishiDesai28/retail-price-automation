import type { ReactNode } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';

import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import AuditLogPage from './pages/AuditLogPage';

type AppLayoutProps = {
  children: ReactNode;
};

function AppLayout({ children }: AppLayoutProps) {
  const navItems = [
    { to: '/', label: 'Dashboard' },
    { to: '/products', label: 'Products' },
    { to: '/audit-log', label: 'Audit Log' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-slate-200 bg-white/90 backdrop-blur lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 px-5 py-6 lg:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Operations</p>
            <h1 className="mt-3 text-xl font-semibold text-slate-900">Retail Price Automation Dashboard</h1>
          </div>

          <nav className="flex gap-2 overflow-x-auto px-4 py-4 lg:flex-col lg:px-3 lg:py-6">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
