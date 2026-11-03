import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { formatDate, formatPrice } from '../utils/format';
import { EmptyState, ErrorBanner, Loading, PageHeader } from '../components/AdminUI';

const NEXT_ACTION: Record<string, string> = {
  REQUESTED: 'APPROVED',
  APPROVED: 'RECEIVED',
  RECEIVED: 'REFUNDED',
};

export function Returns() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/admin/returns', { params: { limit: 50 } });
      setReturns(data.returns || []);
    } catch {
      setError('Could not load return requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const update = async (id: string, status: string) => {
    try {
      await api.patch(`/admin/returns/${id}`, { status });
      toast.success(`Return marked ${status.toLowerCase()}`);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not update the return');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Returns" subtitle="Review and process return requests" />
      <ErrorBanner message={error} />

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Order</th><th>Customer</th><th>Reason</th><th>Refund</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {returns.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.order?.orderNumber}</td>
                  <td className="text-muted">{row.customer?.firstName} {row.customer?.lastName}<br />{row.customer?.email}</td>
                  <td className="text-muted max-w-xs truncate">{row.reason}</td>
                  <td>{row.refundAmount ? formatPrice(Number(row.refundAmount)) : '—'}</td>
                  <td className="text-muted">{formatDate(row.createdAt)}</td>
                  <td><span className="badge badge-gold">{row.status}</span></td>
                  <td>
                    <div className="flex gap-2">
                      {NEXT_ACTION[row.status] && (
                        <button onClick={() => update(row.id, NEXT_ACTION[row.status])} className="btn btn-secondary px-3 py-1.5 text-xs">
                          {NEXT_ACTION[row.status]}
                        </button>
                      )}
                      {row.status === 'REQUESTED' && (
                        <button onClick={() => update(row.id, 'REJECTED')} className="btn px-3 py-1.5 text-xs border border-sale text-[#8f2b24] hover:bg-sale/10">
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {returns.length === 0 && <EmptyState colSpan={7}>No return requests</EmptyState>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
