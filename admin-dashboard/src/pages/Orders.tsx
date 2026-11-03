import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Order } from '../types';
import { formatPrice, formatDate } from '../utils/format';

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params: any = { page: pagination.page, limit: pagination.limit };
        if (statusFilter) params.status = statusFilter;
        const response = await api.get('/admin/orders', { params });
        setOrders(response.data.orders || []);
        setPagination(response.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      } catch (error) { console.error('Failed to fetch orders:', error); }
    };
    fetchData();
  }, [pagination.page, pagination.limit, statusFilter]);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      PENDING: 'badge-warning',
      CONFIRMED: 'badge-info',
      PROCESSING: 'badge-info',
      PACKED: 'badge-info',
      SHIPPED: 'badge-info',
      OUT_FOR_DELIVERY: 'badge-info',
      DELIVERED: 'badge-success',
      CANCELLED: 'badge-danger',
      RETURNED: 'badge-danger',
      REFUNDED: 'badge-danger',
    };
    return badges[status] || 'badge';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="heading-1">Orders</h1><p className="text-muted mt-1">Manage customer orders</p></div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-line">
          <div className="flex gap-4 flex-wrap">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPagination({ ...pagination, page: 1 }); }} className="input w-auto">
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PROCESSING">Processing</option>
              <option value="PACKED">Packed</option>
              <option value="SHIPPED">Shipped</option>
              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="RETURNED">Returned</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead><tr><th>Order #</th><th>Customer</th><th>Total</th><th>Status</th><th>Payment</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td><Link to={`/orders/${order.id}`} className="font-medium hover:text-brass-dark">{order.orderNumber}</Link></td>
                  <td>{order.customer?.firstName} {order.customer?.lastName}<br/><span className="text-sm text-muted">{order.email}</span></td>
                  <td className="font-medium">{formatPrice(order.total)}</td>
                  <td><span className={getStatusBadge(order.status)}>{order.status}</span></td>
                  <td><span className="badge badge-gold">{order.paymentMethod}</span></td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td><Link to={`/orders/${order.id}`} className="text-brass-dark hover:underline text-sm">View</Link></td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted">No orders found</td></tr>}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-line flex items-center justify-between">
            <span className="text-sm text-muted">Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button disabled={pagination.page === 1} className="btn btn-secondary px-4 py-2 disabled:opacity-50">Previous</button>
              <button disabled={pagination.page === pagination.totalPages} className="btn btn-secondary px-4 py-2 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}