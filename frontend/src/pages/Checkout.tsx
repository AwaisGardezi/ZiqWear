import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { formatPrice } from '../utils/format';

const inputClass = 'input';

export function Checkout() {
  const { items, subtotal, clearCart } = useCartStore();
  const { customer } = useAuthStore();
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<{ orderNumber: string; total: number; email: string } | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: customer?.firstName || '',
    lastName: customer?.lastName || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    province: 'Punjab',
    postalCode: '',
    landmark: '',
    notes: '',
    paymentMethod: 'COD',
  });

  const shippingFee = subtotal >= 5000 ? 0 : 250;
  const total = subtotal + shippingFee;

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (items.length === 0) return;

    setPlacing(true);
    setError('');

    try {
      const response = await api.post('/orders', {
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        email: form.email,
        phone: form.phone,
        firstName: form.firstName,
        lastName: form.lastName,
        paymentMethod: form.paymentMethod,
        notes: form.notes || undefined,
        shippingAddress: {
          firstName: form.firstName,
          lastName: form.lastName,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2 || undefined,
          city: form.city,
          province: form.province,
          postalCode: form.postalCode || undefined,
          country: 'Pakistan',
          phone: form.phone,
          landmark: form.landmark || undefined,
        },
      });

      const order = response.data.order;
      setPlacedOrder({ orderNumber: order.orderNumber, total: Number(order.total), email: form.email });
      await clearCart();
      toast.success('Order placed');
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Could not place the order. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setPlacing(false);
    }
  };

  if (placedOrder) {
    return (
      <div className="pt-32 pb-20 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-xl text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gold-600/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-brass-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-ui uppercase tracking-widest text-xs text-brass-dark mb-3">Order confirmed</p>
          <h1 className="heading-2 mb-4">Thank you for your order</h1>
          <p className="text-body mb-2">
            Your order <span className="text-ink font-medium">{placedOrder.orderNumber}</span> has been received.
          </p>
          <p className="text-muted text-sm mb-8">
            Total {formatPrice(placedOrder.total)} · A confirmation was sent to {placedOrder.email}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to={`/track?orderNumber=${placedOrder.orderNumber}`} className="btn btn-primary">
              Track this order
            </Link>
            <Link to="/shop" className="btn btn-secondary">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="pt-32 pb-20 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-medium mb-4">Your cart is empty</h2>
          <Link to="/shop" className="btn btn-primary">Continue Shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="heading-2 mb-8">Checkout</h1>

        {error && <div className="mb-6 p-4 bg-sale/10 border border-sale text-[#8f2b24] text-sm">{error}</div>}

        <form onSubmit={submit} className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section className="card p-6">
              <h2 className="heading-3 mb-4">Contact</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">First name</label>
                  <input required className={inputClass} value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
                </div>
                <div>
                  <label className="label">Last name</label>
                  <input required className={inputClass} value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input required type="email" className={inputClass} value={form.email} onChange={(e) => update('email', e.target.value)} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input required className={inputClass} placeholder="03xx xxxxxxx" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="card p-6">
              <h2 className="heading-3 mb-4">Shipping address</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Address</label>
                  <input required className={inputClass} value={form.addressLine1} onChange={(e) => update('addressLine1', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Apartment, landmark (optional)</label>
                  <input className={inputClass} value={form.landmark} onChange={(e) => update('landmark', e.target.value)} />
                </div>
                <div>
                  <label className="label">City</label>
                  <input required className={inputClass} value={form.city} onChange={(e) => update('city', e.target.value)} />
                </div>
                <div>
                  <label className="label">Province</label>
                  <select className={inputClass} value={form.province} onChange={(e) => update('province', e.target.value)}>
                    {['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad', 'Azad Kashmir', 'Gilgit-Baltistan'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Postal code (optional)</label>
                  <input className={inputClass} value={form.postalCode} onChange={(e) => update('postalCode', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Order notes (optional)</label>
                  <textarea rows={3} className={inputClass} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="card p-6">
              <h2 className="heading-3 mb-4">Payment</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border border-line bg-paper cursor-pointer hover:border-brass">
                  <input
                    type="radio"
                    name="payment"
                    checked={form.paymentMethod === 'COD'}
                    onChange={() => update('paymentMethod', 'COD')}
                  />
                  <span>
                    <span className="font-medium block">Cash on Delivery</span>
                    <span className="text-sm text-muted">Pay the rider when your parcel arrives</span>
                  </span>
                </label>
                <label className="flex items-center gap-3 p-4 border border-line bg-paper cursor-pointer hover:border-brass">
                  <input
                    type="radio"
                    name="payment"
                    checked={form.paymentMethod === 'BANK_TRANSFER'}
                    onChange={() => update('paymentMethod', 'BANK_TRANSFER')}
                  />
                  <span>
                    <span className="font-medium block">Bank transfer</span>
                    <span className="text-sm text-muted">Account details are shared after the order</span>
                  </span>
                </label>
              </div>
            </section>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-32 card p-6 space-y-6">
              <h2 className="font-medium">Order summary</h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <img
                      src={item.variant?.images?.[0]?.url || item.product.images[0]?.url || '/placeholder.jpg'}
                      alt={item.product.title}
                      className="w-14 h-16 object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.product.title}</p>
                      <p className="text-xs text-muted">
                        {[item.variant?.color, item.variant?.size].filter(Boolean).join(' · ')} × {item.quantity}
                      </p>
                    </div>
                    <span className="text-sm">{formatPrice(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-line pt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Delivery</span><span>{shippingFee === 0 ? 'Free' : formatPrice(shippingFee)}</span></div>
                <div className="flex justify-between text-lg font-medium pt-2 border-t border-line"><span>Total</span><span>{formatPrice(total)}</span></div>
              </div>
              <button type="submit" disabled={placing} className="btn btn-primary w-full py-4 disabled:opacity-60">
                {placing ? 'Placing order...' : 'Place Order'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
