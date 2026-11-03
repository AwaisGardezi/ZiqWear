import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderApi } from '../services/api';
import { Order } from '../types';
import { formatPrice, formatDate } from '../utils/format';

const badge: Record<string, string> = {
  PENDING: 'badge badge-warning',
  CONFIRMED: 'badge badge-info',
  PROCESSING: 'badge badge-info',
  PACKED: 'badge badge-info',
  SHIPPED: 'badge badge-info',
  OUT_FOR_DELIVERY: 'badge badge-info',
  DELIVERED: 'badge badge-success',
  CANCELLED: 'badge badge-danger',
  RETURNED: 'badge badge-danger',
  REFUNDED: 'badge badge-danger',
};

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await orderApi.getAll();
        setOrders(response.data.orders || []);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gold-600 border-t-transparent" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-16">
        <h2 className="heading-3 mb-3">No orders yet</h2>
        <p className="text-muted mb-6">Your orders will appear here after your first purchase.</p>
        <Link to="/shop" className="btn btn-primary">Start shopping</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="heading-2 mb-8">My Orders</h1>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <p className="font-medium">{order.orderNumber}</p>
                <p className="text-sm text-muted">{formatDate(order.createdAt)} · {order.items.length} item{order.items.length === 1 ? '' : 's'}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium">{formatPrice(Number(order.total))}</span>
                <span className={badge[order.status] || 'badge'}>{order.status.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {order.items.slice(0, 4).map((item) => (
                <span key={item.id} className="text-sm text-muted">
                  {item.quantity}× {item.title}
                </span>
              ))}
            </div>
            <Link to={`/track?orderNumber=${order.orderNumber}`} className="inline-block mt-4 text-sm text-brass-dark hover:underline">
              Track order →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
