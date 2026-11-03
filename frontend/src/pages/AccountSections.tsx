import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { customerApi, loyaltyApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Address, Order } from '../types';
import { formatDate, formatPrice } from '../utils/format';

export function AccountOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/orders');
        setOrders(response.data.orders || []);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <p className="text-muted">Loading orders...</p>;

  return (
    <div>
      <h1 className="heading-2 mb-8">My Orders</h1>
      {orders.length === 0 ? (
        <p className="text-muted">No orders yet. <Link to="/shop" className="text-brass-dark hover:underline">Start shopping</Link></p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{order.orderNumber}</p>
                  <p className="text-sm text-muted">{formatDate(order.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatPrice(Number(order.total))}</p>
                  <p className="text-xs uppercase tracking-wider text-brass-dark">{order.status.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <p className="text-sm text-muted mt-3">
                {order.items.map((item) => `${item.quantity}× ${item.title}`).join(' · ')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AccountAddresses() {
  const { customer, fetchProfile } = useAuthStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState({
    firstName: customer?.firstName || '',
    lastName: customer?.lastName || '',
    addressLine1: '',
    city: '',
    province: 'Punjab',
    postalCode: '',
    phone: customer?.phone || '',
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await customerApi.getAddresses();
        setAddresses(response.data.addresses || []);
      } catch {
        setAddresses(customer?.addresses || []);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await customerApi.addAddress({ ...form, country: 'Pakistan', type: 'shipping' });
      const response = await customerApi.getAddresses();
      setAddresses(response.data.addresses || []);
      setMessage('Address saved');
      await fetchProfile();
    } catch {
      setMessage('Could not save the address');
    }
  };

  return (
    <div>
      <h1 className="heading-2 mb-8">Addresses</h1>

      <div className="space-y-3 mb-8">
        {addresses.length === 0 && <p className="text-muted">No saved addresses yet.</p>}
        {addresses.map((address) => (
          <div key={address.id} className="card p-4">
            <p className="font-medium">{address.firstName} {address.lastName}</p>
            <p className="text-sm text-muted">{address.addressLine1}, {address.city}, {address.province} {address.postalCode}</p>
            {address.phone && <p className="text-sm text-muted">{address.phone}</p>}
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="card p-6 grid sm:grid-cols-2 gap-4">
        <h2 className="heading-3 sm:col-span-2">Add an address</h2>
        <input required className="input" placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        <input required className="input" placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        <input required className="input sm:col-span-2" placeholder="Street address" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
        <input required className="input" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <input required className="input" placeholder="Province" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
        <input className="input" placeholder="Postal code" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
        <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <div className="sm:col-span-2 flex items-center gap-4">
          <button type="submit" className="btn btn-primary">Save address</button>
          {message && <span className="text-sm text-muted">{message}</span>}
        </div>
      </form>
    </div>
  );
}

export function AccountProfile() {
  const { customer, updateProfile } = useAuthStore();
  const [form, setForm] = useState({
    firstName: customer?.firstName || '',
    lastName: customer?.lastName || '',
    phone: customer?.phone || '',
  });
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await updateProfile(form);
      setMessage('Profile updated');
    } catch {
      setMessage('Could not update the profile');
    }
  };

  return (
    <div>
      <h1 className="heading-2 mb-8">Profile</h1>
      <form onSubmit={submit} className="card p-6 space-y-4 max-w-lg">
        <div>
          <label className="label">Email</label>
          <input disabled className="input opacity-60" value={customer?.email || ''} />
        </div>
        <div>
          <label className="label">First name</label>
          <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </div>
        <div>
          <label className="label">Last name</label>
          <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="flex items-center gap-4">
          <button type="submit" className="btn btn-primary">Save changes</button>
          {message && <span className="text-sm text-muted">{message}</span>}
        </div>
      </form>
    </div>
  );
}

export function AccountLoyalty() {
  const [account, setAccount] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loyaltyApi
      .getAccount()
      .then((response) => setAccount(response.data.account))
      .catch(() => setError('Could not load loyalty details'));
  }, []);

  return (
    <div>
      <h1 className="heading-2 mb-8">Loyalty</h1>
      {error && <p className="text-sale text-sm mb-4">{error}</p>}
      {account ? (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="card p-6 text-center">
            <p className="text-2xl font-medium text-brass-dark capitalize">{String(account.tier).toLowerCase()}</p>
            <p className="text-sm text-muted mt-1">Tier</p>
          </div>
          <div className="card p-6 text-center">
            <p className="text-2xl font-medium text-brass-dark">{account.pointsBalance}</p>
            <p className="text-sm text-muted mt-1">Points balance</p>
          </div>
          <div className="card p-6 text-center">
            <p className="text-2xl font-medium text-brass-dark">{account.lifetimePoints}</p>
            <p className="text-sm text-muted mt-1">Lifetime points</p>
          </div>
        </div>
      ) : (
        !error && <p className="text-muted">Loading...</p>
      )}
    </div>
  );
}
