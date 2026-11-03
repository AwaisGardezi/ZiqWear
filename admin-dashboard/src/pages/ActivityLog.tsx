import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { formatDateTime } from '../utils/format';
import { EmptyState, ErrorBanner, Loading, PageHeader } from '../components/AdminUI';

interface LogRow {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  admin?: { name: string; email: string };
}

export function ActivityLog() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/activity', { params: { page, limit: 50 } });
      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch {
      setError('Could not load activity log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Activity log" subtitle={`${pagination.total} recorded actions`} />
      <ErrorBanner message={error} />

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th></tr></thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-muted">{formatDateTime(log.createdAt)}</td>
                  <td>{log.admin?.name || '—'}</td>
                  <td className="font-medium">{log.action.replace(/_/g, ' ')}</td>
                  <td className="text-muted">{log.entityType || '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && <EmptyState colSpan={4}>No activity recorded yet</EmptyState>}
            </tbody>
          </table>
        </div>
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-line flex items-center justify-between">
            <span className="text-sm text-muted">Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button disabled={pagination.page === 1} onClick={() => load(pagination.page - 1)} className="btn btn-secondary px-4 py-2 disabled:opacity-50">Previous</button>
              <button disabled={pagination.page === pagination.totalPages} onClick={() => load(pagination.page + 1)} className="btn btn-secondary px-4 py-2 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
