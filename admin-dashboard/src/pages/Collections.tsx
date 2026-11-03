import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { Collection } from '../types';
import { slugify } from '../utils/format';
import { EmptyState, ErrorBanner, Loading, PageHeader } from '../components/AdminUI';

export function Collections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', slug: '', description: '', isFeatured: false });

  const load = async () => {
    try {
      const response = await api.get('/admin/collections');
      setCollections(response.data.collections || []);
    } catch {
      setError('Could not load collections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.post('/admin/collections', {
        name: form.name,
        slug: form.slug || slugify(form.name),
        description: form.description || undefined,
        isFeatured: form.isFeatured,
        isActive: true,
      });
      setForm({ name: '', slug: '', description: '', isFeatured: false });
      toast.success('Collection created');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not create the collection');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this collection?')) return;
    try {
      await api.delete(`/admin/collections/${id}`);
      toast.success('Collection deleted');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not delete the collection');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Collections" subtitle="Curated groups of products" />
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
          <label className="label">Featured</label>
          <select className="input" value={form.isFeatured ? 'yes' : 'no'} onChange={(e) => setForm({ ...form, isFeatured: e.target.value === 'yes' })}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary">Add collection</button>
      </form>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Name</th><th>Slug</th><th>Products</th><th>Featured</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {collections.map((collection) => (
                <tr key={collection.id}>
                  <td className="font-medium">{collection.name}</td>
                  <td className="text-muted">{collection.slug}</td>
                  <td>{collection._count?.products ?? '—'}</td>
                  <td>{collection.isFeatured ? 'Yes' : 'No'}</td>
                  <td><span className={`badge ${collection.isActive ? 'badge-success' : 'badge-danger'}`}>{collection.isActive ? 'Active' : 'Hidden'}</span></td>
                  <td><button onClick={() => remove(collection.id)} className="text-sale hover:underline text-sm">Delete</button></td>
                </tr>
              ))}
              {collections.length === 0 && <EmptyState colSpan={6}>No collections yet</EmptyState>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
