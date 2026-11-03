import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { InventoryRow } from '../types';
import { EmptyState, ErrorBanner, Loading, PageHeader } from '../components/AdminUI';

export function Inventory() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const response = await api.get('/admin/inventory', {
        params: {
          limit: 100,
          ...(filter === 'low' ? { lowStock: true } : {}),
          ...(filter === 'out' ? { outOfStock: true } : {}),
        },
      });
      setRows(response.data.inventory || []);
    } catch {
      setError('Could not load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  const adjust = async (row: InventoryRow) => {
    const value = Number(adjustments[row.id] || 0);
    if (!value) {
      toast.error('Enter a quantity to add or remove');
      return;
    }
    try {
      await api.post('/admin/inventory/adjust', {
        variantId: row.variantId,
        quantity: value,
        reason: 'Manual adjustment from admin dashboard',
      });
      toast.success('Stock updated');
      setAdjustments((prev) => ({ ...prev, [row.id]: '' }));
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not adjust the stock');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" subtitle="Stock levels per variant" />
      <ErrorBanner message={error} />

      <div className="card p-4 flex flex-wrap gap-3">
        {[
          { value: 'all', label: 'All stock' },
          { value: 'low', label: 'Low stock' },
          { value: 'out', label: 'Out of stock' },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`btn ${filter === option.value ? 'btn-primary' : 'btn-secondary'} px-4 py-2`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Product</th><th>Variant</th><th>SKU</th><th>Stock</th><th>Adjust</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.product?.title}</td>
                  <td className="text-muted">{[row.variant?.color, row.variant?.size].filter(Boolean).join(' · ') || row.variant?.title}</td>
                  <td className="text-muted">{row.variant?.sku}</td>
                  <td>
                    <span className={row.quantity <= 0 ? 'text-sale' : row.quantity <= row.lowStockThreshold ? 'text-brass-800 font-medium' : ''}>
                      {row.quantity}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        className="input w-24"
                        placeholder="+/-"
                        value={adjustments[row.id] || ''}
                        onChange={(e) => setAdjustments((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      />
                      <button onClick={() => adjust(row)} className="btn btn-secondary px-3 py-2">Apply</button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <EmptyState colSpan={5}>No inventory records</EmptyState>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
