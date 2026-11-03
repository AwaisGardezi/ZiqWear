import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { formatDate } from '../utils/format';
import { EmptyState, ErrorBanner, Loading, PageHeader } from '../components/AdminUI';

export function Loyalty() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [adjusting, setAdjusting] = useState<{ customerId: string; name: string } | null>(null);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');

  const load = async (term = '') => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/loyalty/accounts', { params: { limit: 50, search: term || undefined } });
      setAccounts(data.accounts || []);
    } catch {
      setError('Could not load loyalty accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submitAdjust = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adjusting) return;
    try {
      await api.post('/admin/loyalty/adjust', {
        customerId: adjusting.customerId,
        points: Number(points),
        reason,
      });
      toast.success('Points adjusted');
      setAdjusting(null);
      setPoints('');
      setReason('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not adjust the points');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Loyalty" subtitle="Customer points and tiers" />
      <ErrorBanner message={error} />

      <form onSubmit={(e) => { e.preventDefault(); load(search); }} className="card p-4 flex gap-3">
        <input className="input max-w-md" placeholder="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn btn-secondary">Search</button>
      </form>

      {adjusting && (
        <form onSubmit={submitAdjust} className="card p-6 space-y-4">
          <h2 className="heading-3">Adjust points for {adjusting.name}</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Points (negative to deduct)</label>
              <input type="number" required className="input" value={points} onChange={(e) => setPoints(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Reason</label>
              <input required className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary">Apply</button>
            <button type="button" onClick={() => setAdjusting(null)} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Customer</th><th>Tier</th><th>Balance</th><th>Lifetime</th><th>Last activity</th><th>Actions</th></tr></thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td className="font-medium">
                    {account.customer?.firstName} {account.customer?.lastName}
                    <p className="text-sm text-muted font-normal">{account.customer?.email}</p>
                  </td>
                  <td><span className="badge badge-gold">{account.tier}</span></td>
                  <td>{account.pointsBalance}</td>
                  <td className="text-muted">{account.lifetimePoints}</td>
                  <td className="text-muted">{account.lastActivityAt ? formatDate(account.lastActivityAt) : '—'}</td>
                  <td>
                    <button
                      onClick={() => setAdjusting({ customerId: account.customerId, name: account.customer?.email || 'customer' })}
                      className="text-brass-dark hover:underline text-sm"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && <EmptyState colSpan={6}>No loyalty accounts</EmptyState>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
