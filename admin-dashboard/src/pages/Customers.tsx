import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { Customer } from '../types';
import { formatDate, formatPrice } from '../utils/format';
import { EmptyState, ErrorBanner, Loading, PageHeader } from '../components/AdminUI';

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const response = await api.get('/admin/customers', { params: { limit: 100, search: search || undefined } });
      setCustomers(response.data.customers || []);
    } catch {
      setError('Could not load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const toggleBlock = async (customer: Customer) => {
    try {
      await api.patch(`/admin/customers/${customer.id}`, { isBlocked: !customer.isBlocked });
      toast.success(customer.isBlocked ? 'Customer unblocked' : 'Customer blocked');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not update the customer');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" subtitle="Everyone who has shopped with you" />
      <ErrorBanner message={error} />

      <form
        onSubmit={(event) => { event.preventDefault(); setLoading(true); load(); }}
        className="card p-4 flex gap-3"
      >
        <input className="input max-w-md" placeholder="Search by email, phone or name" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn btn-secondary">Search</button>
      </form>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Spent</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                    <p className="text-sm text-muted">{customer.email}</p>
                  </td>
                  <td>{customer.phone || '—'}</td>
                  <td>{customer.totalOrders}</td>
                  <td>{formatPrice(Number(customer.totalSpent))}</td>
                  <td>{formatDate(customer.createdAt)}</td>
                  <td>
                    <span className={`badge ${customer.isBlocked ? 'badge-danger' : 'badge-success'}`}>
                      {customer.isBlocked ? 'Blocked' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => toggleBlock(customer)} className="text-brass-dark hover:underline text-sm">
                      {customer.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && <EmptyState colSpan={7}>No customers yet</EmptyState>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
