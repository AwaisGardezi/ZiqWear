import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { Coupon } from '../types';
import { formatPrice } from '../utils/format';
import { EmptyState, ErrorBanner, Loading, PageHeader } from '../components/AdminUI';

export function Coupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ code: '', name: '', type: 'PERCENTAGE', value: 10, minPurchase: '' });

  const load = async () => {
    try {
      const response = await api.get('/admin/coupons');
      setCoupons(response.data.coupons || []);
    } catch {
      setError('Could not load coupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.post('/admin/coupons', {
        code: form.code,
        name: form.name,
        type: form.type,
        value: Number(form.value),
        minPurchase: form.minPurchase ? Number(form.minPurchase) : undefined,
        isActive: true,
        appliesToAll: true,
      });
      setForm({ code: '', name: '', type: 'PERCENTAGE', value: 10, minPurchase: '' });
      toast.success('Coupon created');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not create the coupon');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    try {
      await api.delete(`/admin/coupons/${id}`);
      toast.success('Coupon deleted');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not delete the coupon');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Coupons" subtitle="Discount codes for your customers" />
      <ErrorBanner message={error} />

      <form onSubmit={create} className="card p-6 grid sm:grid-cols-5 gap-4 items-end">
        <div>
          <label className="label">Code</label>
          <input required className="input uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        </div>
        <div>
          <label className="label">Name</label>
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED_AMOUNT">Fixed amount</option>
            <option value="FREE_SHIPPING">Free shipping</option>
          </select>
        </div>
        <div>
          <label className="label">Value</label>
          <input required type="number" min="1" className="input" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
        </div>
        <button type="submit" className="btn btn-primary">Create coupon</button>
      </form>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Value</th><th>Used</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td className="font-medium">{coupon.code}</td>
                  <td>{coupon.name}</td>
                  <td className="text-muted">{coupon.type.replace(/_/g, ' ')}</td>
                  <td>{coupon.type === 'PERCENTAGE' ? `${Number(coupon.value)}%` : formatPrice(Number(coupon.value))}</td>
                  <td>{coupon.usageCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''}</td>
                  <td><span className={`badge ${coupon.isActive ? 'badge-success' : 'badge-danger'}`}>{coupon.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td><button onClick={() => remove(coupon.id)} className="text-sale hover:underline text-sm">Delete</button></td>
                </tr>
              ))}
              {coupons.length === 0 && <EmptyState colSpan={7}>No coupons yet</EmptyState>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
