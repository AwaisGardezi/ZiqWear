import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ErrorBanner, Loading, PageHeader } from '../components/AdminUI';
import { formatPrice } from '../utils/format';

interface Overview {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  avgOrderValue: number;
  pendingOrders: number;
  lowStockProducts: number;
  outOfStockProducts: number;
}

export function Analytics() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [revenue, setRevenue] = useState<Record<string, number>>({});
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [overviewRes, revenueRes, topRes] = await Promise.all([
          api.get('/admin/analytics/overview'),
          api.get('/admin/analytics/revenue'),
          api.get('/admin/analytics/top-products'),
        ]);
        setOverview(overviewRes.data.overview);
        setRevenue(revenueRes.data.revenueByDay || {});
        setTopProducts(topRes.data.topProducts || []);
      } catch {
        setError('Could not load analytics');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Loading />;

  const maxDaily = Math.max(1, ...Object.values(revenue).map(Number));
  const days = Object.entries(revenue).sort(([a], [b]) => a.localeCompare(b));

  const stats = overview
    ? [
        { label: 'Revenue', value: formatPrice(overview.totalRevenue) },
        { label: 'Orders', value: String(overview.totalOrders) },
        { label: 'Customers', value: String(overview.totalCustomers) },
        { label: 'Products', value: String(overview.totalProducts) },
        { label: 'Avg order value', value: formatPrice(overview.avgOrderValue) },
        { label: 'Pending orders', value: String(overview.pendingOrders) },
        { label: 'Low stock', value: String(overview.lowStockProducts) },
        { label: 'Out of stock', value: String(overview.outOfStockProducts) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Last 30 days" />
      <ErrorBanner message={error} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-5">
            <p className="text-sm text-muted">{stat.label}</p>
            <p className="text-2xl font-display mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="heading-3 mb-4">Daily revenue</h2>
        {days.length === 0 ? (
          <p className="text-muted text-sm">No revenue in this period.</p>
        ) : (
          <div className="flex items-end gap-1 h-48">
            {days.map(([day, amount]) => (
              <div key={day} className="flex-1 group relative">
                <div
                  className="w-full bg-brass/70 hover:bg-brass transition"
                  style={{ height: `${Math.max(4, (Number(amount) / maxDaily) * 100)}%` }}
                  title={`${day}: ${formatPrice(Number(amount))}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="p-4 border-b border-line"><h2 className="heading-3">Top products</h2></div>
        <div className="p-4 space-y-3">
          {topProducts.map((row, index) => (
            <div key={row.productId} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-muted w-6">{index + 1}</span>
                <span className="truncate">{row.product?.title || 'Deleted product'}</span>
              </div>
              <div className="text-sm text-muted whitespace-nowrap">
                {row._sum.quantity} sold · {formatPrice(Number(row._sum.totalPrice || 0))}
              </div>
            </div>
          ))}
          {topProducts.length === 0 && <p className="text-muted text-sm">No sales yet.</p>}
        </div>
      </div>
    </div>
  );
}
