import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { AdminUser } from '../types';
import { formatDate } from '../utils/format';
import { EmptyState, ErrorBanner, Field, Loading, PageHeader } from '../components/AdminUI';

const ROLES = ['SUPER_ADMIN', 'STORE_MANAGER', 'ORDER_MANAGER', 'INVENTORY_MANAGER', 'CONTENT_MANAGER', 'CUSTOMER_SUPPORT'];

export function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'STORE_MANAGER' });

  const load = async () => {
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data.users || []);
    } catch {
      setError('Could not load admin users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await api.post('/admin/users', form);
      toast.success('User created');
      setCreating(false);
      setForm({ email: '', name: '', password: '', role: 'STORE_MANAGER' });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not create the user');
    }
  };

  const toggleActive = async (user: AdminUser) => {
    try {
      await api.patch(`/admin/users/${user.id}`, { isActive: !user.isActive });
      toast.success(user.isActive ? 'User deactivated' : 'User activated');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not update the user');
    }
  };

  const remove = async (user: AdminUser) => {
    if (!confirm(`Delete ${user.email}?`)) return;
    try {
      await api.delete(`/admin/users/${user.id}`);
      toast.success('User deleted');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not delete the user');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin users"
        subtitle="Team accounts with dashboard access"
        action={<button onClick={() => setCreating(!creating)} className="btn btn-primary">{creating ? 'Cancel' : 'Add user'}</button>}
      />
      <ErrorBanner message={error} />

      {creating && (
        <form onSubmit={create} className="card p-6 grid sm:grid-cols-2 gap-4">
          <Field label="Name"><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Password (min 8 chars)">
            <input required type="password" minLength={8} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Role">
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((role) => <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2"><button type="submit" className="btn btn-primary">Create user</button></div>
        </form>
      )}

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last login</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="font-medium">{user.name}</td>
                  <td className="text-muted">{user.email}</td>
                  <td><span className="badge badge-gold">{user.role.replace(/_/g, ' ')}</span></td>
                  <td className="text-muted">{user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}</td>
                  <td><span className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}>{user.isActive ? 'Active' : 'Disabled'}</span></td>
                  <td className="space-x-3 text-sm">
                    <button onClick={() => toggleActive(user)} className="text-brass-dark hover:underline">{user.isActive ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => remove(user)} className="text-sale hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <EmptyState colSpan={6}>No admin users</EmptyState>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
