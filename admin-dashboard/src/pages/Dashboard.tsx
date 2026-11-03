import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { formatPrice } from '../utils/format';

interface Stats {
  totalRevenue: number; totalOrders: number; totalCustomers: number; totalProducts: number;
  pendingOrders: number; lowStockProducts: number; outOfStockProducts: number; avgOrderValue: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({ totalRevenue: 0, totalOrders: 0, totalCustomers: 0, totalProducts: 0, pendingOrders: 0, lowStockProducts: 0, outOfStockProducts: 0, avgOrderValue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { const fetchStats = async () => { try { const response = await api.get('/admin/analytics/overview'); setStats(response.data.overview); } catch (error) { console.error('Failed to fetch dashboard stats:', error); } finally { setLoading(false); } }; fetchStats(); }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-4 border-gold-600 border-t-transparent"></div></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between"><div><h1 className="heading-1">Dashboard</h1><p className="text-muted mt-1">Overview of your store performance</p></div><Link to="/products/new" className="btn btn-primary">Add Product</Link></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Revenue" value={formatPrice(stats.totalRevenue)} color="gold" href="/analytics" />
        <StatCard label="Total Orders" value={stats.totalOrders.toLocaleString()} color="blue" href="/orders" />
        <StatCard label="Total Customers" value={stats.totalCustomers.toLocaleString()} color="green" href="/customers" />
        <StatCard label="Total Products" value={stats.totalProducts.toLocaleString()} color="purple" href="/products" />
        <StatCard label="Pending Orders" value={stats.pendingOrders.toLocaleString()} color="orange" href="/orders?status=PENDING" />
        <StatCard label="Low Stock" value={stats.lowStockProducts.toLocaleString()} color="red" href="/inventory?lowStock=true" />
        <StatCard label="Out of Stock" value={stats.outOfStockProducts.toLocaleString()} color="red" href="/inventory?outOfStock=true" />
        <StatCard label="Avg Order Value" value={formatPrice(stats.avgOrderValue)} color="indigo" href="/analytics" />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-6"><div className="flex items-center justify-between mb-6"><h2 className="heading-3">Recent Orders</h2><Link to="/orders" className="text-sm text-brass-dark hover:underline">View All</Link></div><div className="table-container"><table className="table"><thead><tr><th>Order #</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody><tr><td colSpan={5} className="text-center py-8 text-muted">No orders yet. <Link to="/products/new" className="text-brass-dark hover:underline">Add products</Link> to start selling.</td></tr></tbody></table></div></section>
        <section className="card p-6"><div className="flex items-center justify-between mb-6"><h2 className="heading-3">Low Stock Products</h2><Link to="/inventory?lowStock=true" className="text-sm text-brass-dark hover:underline">View All</Link></div><div className="table-container"><table className="table"><thead><tr><th>Product</th><th>Variant</th><th>Stock</th><th>Threshold</th></tr></thead><tbody><tr><td colSpan={4} className="text-center py-8 text-muted">All products are well stocked</td></tr></tbody></table></div></section>
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: string; color?: string; href: string }) {
  return <Link to={href} className="card p-6 hover:border-gold-600 transition-colors group"><p className="text-sm text-muted mb-1">{label}</p><p className="text-2xl font-medium">{value}</p></Link>;
}