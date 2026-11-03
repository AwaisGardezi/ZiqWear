import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import api from '../services/api';
import { Order } from '../types';
import { formatPrice, formatDate } from '../utils/format';

const STEPS = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

export function OrderTracking() {
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('orderNumber') || '');
  const [contact, setContact] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = async (number: string, contactValue: string) => {
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const isEmail = contactValue.includes('@');
      const response = await api.get('/orders/track', {
        params: {
          orderNumber: number,
          ...(contactValue ? (isEmail ? { email: contactValue } : { phone: contactValue }) : {}),
        },
      });
      setOrder(response.data.order);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Order not found');
      } else {
        setError('Order not found');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const preset = searchParams.get('orderNumber');
    if (preset) lookup(preset, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!orderNumber.trim()) {
      setError('Enter your order number');
      return;
    }
    lookup(orderNumber.trim(), contact.trim());
  };

  const stepIndex = order ? STEPS.indexOf(order.status) : -1;

  return (
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <h1 className="heading-2 mb-2">Track your order</h1>
        <p className="text-muted mb-8">Enter the order number from your confirmation email.</p>

        <form onSubmit={submit} className="card p-6 grid sm:grid-cols-3 gap-4 mb-8">
          <div>
            <label className="label">Order number</label>
            <input className="input" placeholder="ZQ-123456" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
          </div>
          <div>
            <label className="label">Phone or email (optional)</label>
            <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Looking up...' : 'Track'}
            </button>
          </div>
        </form>

        {error && <div className="p-4 bg-sale/10 border border-sale text-[#8f2b24] text-sm mb-6">{error}</div>}

        {order && (
          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <p className="text-lg font-medium">{order.orderNumber}</p>
                <p className="text-sm text-muted">Placed {formatDate(order.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatPrice(Number(order.total))}</p>
                <span className="text-xs uppercase tracking-wider text-brass-dark">{order.status.replace(/_/g, ' ')}</span>
              </div>
            </div>

            {order.status === 'CANCELLED' ? (
              <p className="text-sm text-sale">This order was cancelled.</p>
            ) : (
              <div className="flex items-center gap-2 mb-8">
                {STEPS.map((step, index) => (
                  <div key={step} className="flex-1">
                    <div className={`h-1 ${index <= stepIndex ? 'bg-brass' : 'bg-sand'}`} />
                    <p className={`mt-2 text-xs uppercase tracking-wider ${index <= stepIndex ? 'text-brass-dark' : 'text-muted'}`}>
                      {step.replace(/_/g, ' ')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm border-b border-line pb-3">
                  <div>
                    <p>{item.title}</p>
                    <p className="text-muted text-xs">
                      {[item.color, item.size].filter(Boolean).join(' · ')} × {item.quantity}
                    </p>
                  </div>
                  <span>{formatPrice(Number(item.totalPrice))}</span>
                </div>
              ))}
            </div>

            {order.trackingNumber && (
              <p className="text-sm text-muted mt-6">
                Tracking number: <span className="text-ink">{order.trackingNumber}</span>
                {order.trackingCompany ? ` (${order.trackingCompany})` : ''}
              </p>
            )}
          </div>
        )}

        <p className="text-sm text-muted mt-8">
          Need help? <Link to="/contact" className="text-brass-dark hover:underline">Contact the store</Link>
        </p>
      </div>
    </div>
  );
}
