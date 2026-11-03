import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { formatPrice } from '../utils/format';
import { EmptyState, ErrorBanner, Field, Loading, PageHeader } from '../components/AdminUI';

interface Rate {
  id: string;
  name: string;
  price: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  freeShippingThreshold?: number;
  isActive: boolean;
}

interface Zone {
  id: string;
  name: string;
  provinces?: string;
  cities?: string;
  isActive: boolean;
  rates: Rate[];
}

export function Shipping() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [zoneForm, setZoneForm] = useState({ name: '', provinces: '' });
  const [rateForm, setRateForm] = useState({ zoneId: '', name: '', price: '', estimatedDaysMin: '2', estimatedDaysMax: '5', freeShippingThreshold: '' });

  const load = async () => {
    try {
      const { data } = await api.get('/admin/shipping/zones');
      setZones(data.zones || []);
    } catch {
      setError('Could not load shipping zones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createZone = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.post('/admin/shipping/zones', { name: zoneForm.name, provinces: zoneForm.provinces || undefined, countries: ['Pakistan'] });
      toast.success('Zone created');
      setZoneForm({ name: '', provinces: '' });
      setCreating(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not create the zone');
    }
  };

  const createRate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.post('/admin/shipping/rates', {
        zoneId: rateForm.zoneId,
        name: rateForm.name,
        price: Number(rateForm.price),
        estimatedDaysMin: Number(rateForm.estimatedDaysMin),
        estimatedDaysMax: Number(rateForm.estimatedDaysMax),
        freeShippingThreshold: rateForm.freeShippingThreshold ? Number(rateForm.freeShippingThreshold) : undefined,
      });
      toast.success('Rate created');
      setRateForm({ zoneId: '', name: '', price: '', estimatedDaysMin: '2', estimatedDaysMax: '5', freeShippingThreshold: '' });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not create the rate');
    }
  };

  const removeZone = async (id: string) => {
    if (!confirm('Delete this zone and its rates?')) return;
    try {
      await api.delete(`/admin/shipping/zones/${id}`);
      toast.success('Zone deleted');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not delete the zone');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipping"
        subtitle="Zones and delivery rates"
        action={<button onClick={() => setCreating(!creating)} className="btn btn-primary">{creating ? 'Cancel' : 'Add zone'}</button>}
      />
      <ErrorBanner message={error} />

      {creating && (
        <form onSubmit={createZone} className="card p-6 grid sm:grid-cols-3 gap-4 items-end">
          <Field label="Zone name"><input required className="input" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} /></Field>
          <Field label="Provinces (comma separated)">
            <input className="input" placeholder="Punjab, Sindh" value={zoneForm.provinces} onChange={(e) => setZoneForm({ ...zoneForm, provinces: e.target.value })} />
          </Field>
          <button type="submit" className="btn btn-primary">Create zone</button>
        </form>
      )}

      <div className="space-y-6">
        {zones.map((zone) => (
          <div key={zone.id} className="card">
            <div className="p-4 border-b border-line flex items-center justify-between">
              <div>
                <h2 className="heading-3">{zone.name}</h2>
                <p className="text-sm text-muted">{zone.provinces || 'All provinces'}</p>
              </div>
              <button onClick={() => removeZone(zone.id)} className="text-sale hover:underline text-sm">Delete</button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Rate</th><th>Price</th><th>Free over</th><th>Delivery</th></tr></thead>
                <tbody>
                  {zone.rates.map((rate) => (
                    <tr key={rate.id}>
                      <td className="font-medium">{rate.name}</td>
                      <td>{rate.price === 0 ? 'Free' : formatPrice(rate.price)}</td>
                      <td className="text-muted">{rate.freeShippingThreshold ? formatPrice(rate.freeShippingThreshold) : '—'}</td>
                      <td className="text-muted">{rate.estimatedDaysMin}–{rate.estimatedDaysMax} days</td>
                    </tr>
                  ))}
                  {zone.rates.length === 0 && <EmptyState colSpan={4}>No rates for this zone</EmptyState>}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {zones.length === 0 && <p className="text-muted">No shipping zones yet.</p>}
      </div>

      {zones.length > 0 && (
        <form onSubmit={createRate} className="card p-6">
          <h2 className="heading-3 mb-4">Add rate</h2>
          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <Field label="Zone">
              <select required className="input" value={rateForm.zoneId} onChange={(e) => setRateForm({ ...rateForm, zoneId: e.target.value })}>
                <option value="">Select a zone</option>
                {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
              </select>
            </Field>
            <Field label="Rate name"><input required className="input" placeholder="Standard delivery" value={rateForm.name} onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })} /></Field>
            <Field label="Price (PKR)"><input required type="number" min="0" className="input" value={rateForm.price} onChange={(e) => setRateForm({ ...rateForm, price: e.target.value })} /></Field>
            <Field label="Min days"><input type="number" min="1" className="input" value={rateForm.estimatedDaysMin} onChange={(e) => setRateForm({ ...rateForm, estimatedDaysMin: e.target.value })} /></Field>
            <Field label="Max days"><input type="number" min="1" className="input" value={rateForm.estimatedDaysMax} onChange={(e) => setRateForm({ ...rateForm, estimatedDaysMax: e.target.value })} /></Field>
            <Field label="Free shipping over">
              <input type="number" min="1" className="input" value={rateForm.freeShippingThreshold} onChange={(e) => setRateForm({ ...rateForm, freeShippingThreshold: e.target.value })} />
            </Field>
          </div>
          <button type="submit" className="btn btn-primary mt-4">Create rate</button>
        </form>
      )}
    </div>
  );
}
