import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { Category } from '../types';
import { slugify } from '../utils/format';
import { EmptyState, ErrorBanner, Loading, PageHeader } from '../components/AdminUI';

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', slug: '', parentId: '', sortOrder: 0 });

  const load = async () => {
    try {
      const response = await api.get('/admin/categories');
      setCategories(response.data.categories || []);
    } catch {
      setError('Could not load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await api.post('/admin/categories', {
        name: form.name,
        slug: form.slug || slugify(form.name),
        parentId: form.parentId || undefined,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: true,
      });
      setForm({ name: '', slug: '', parentId: '', sortOrder: 0 });
      toast.success('Category created');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not create the category');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      await api.delete(`/admin/categories/${id}`);
      toast.success('Category deleted');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not delete the category');
    }
  };

  if (loading) return <Loading />;

  const parents = categories.filter((category) => !category.parentId);

  return (
    <div className="space-y-6">
      <PageHeader title="Categories" subtitle="Organise the catalogue" />
      <ErrorBanner message={error} />

      <form onSubmit={create} className="card p-6 grid sm:grid-cols-4 gap-4 items-end">
        <div>
          <label className="label">Name</label>
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} />
        </div>
        <div>
          <label className="label">Slug</label>
          <input required className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </div>
        <div>
          <label className="label">Parent</label>
          <select className="input" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
            <option value="">None</option>
            {parents.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">Add category</button>
      </form>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Name</th><th>Slug</th><th>Parent</th><th>Products</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td className="font-medium">{category.name}</td>
                  <td className="text-muted">{category.slug}</td>
                  <td>{category.parentId ? categories.find((c) => c.id === category.parentId)?.name || '—' : '—'}</td>
                  <td>{category._count?.products ?? '—'}</td>
                  <td><span className={`badge ${category.isActive ? 'badge-success' : 'badge-danger'}`}>{category.isActive ? 'Active' : 'Hidden'}</span></td>
                  <td><button onClick={() => remove(category.id)} className="text-sale hover:underline text-sm">Delete</button></td>
                </tr>
              ))}
              {categories.length === 0 && <EmptyState colSpan={6}>No categories yet</EmptyState>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
