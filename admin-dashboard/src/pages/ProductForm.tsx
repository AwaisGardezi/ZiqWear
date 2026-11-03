import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { Category } from '../types';
import { slugify } from '../utils/format';
import { ErrorBanner, Field, Loading, PageHeader } from '../components/AdminUI';

export function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const editing = !!id;
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    handle: '',
    description: '',
    shortDescription: '',
    sku: '',
    categoryId: '',
    basePrice: '',
    compareAtPrice: '',
    costPrice: '',
    fabric: '',
    gsm: '',
    fit: '',
    isActive: true,
    isFeatured: false,
    isNewArrival: false,
    isBestseller: false,
    tags: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [categoriesRes] = await Promise.all([api.get('/admin/categories')]);
        setCategories(categoriesRes.data.categories || []);
        if (editing) {
          const { data } = await api.get(`/admin/products/${id}`);
          const p = data.product;
          setForm({
            title: p.title,
            handle: p.handle,
            description: p.description || '',
            shortDescription: p.shortDescription || '',
            sku: p.sku || '',
            categoryId: p.categoryId,
            basePrice: String(p.basePrice ?? ''),
            compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : '',
            costPrice: p.costPrice ? String(p.costPrice) : '',
            fabric: p.fabric || '',
            gsm: p.gsm ? String(p.gsm) : '',
            fit: p.fit || '',
            isActive: !!p.isActive,
            isFeatured: !!p.isFeatured,
            isNewArrival: !!p.isNewArrival,
            isBestseller: !!p.isBestseller,
            tags: Array.isArray(p.tags) ? p.tags.join(', ') : '',
          });
        }
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Could not load the form data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [editing, id]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title,
        handle: form.handle || slugify(form.title),
        description: form.description,
        shortDescription: form.shortDescription || undefined,
        sku: form.sku || `SKU-${Date.now()}`,
        categoryId: form.categoryId,
        basePrice: Number(form.basePrice),
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        fabric: form.fabric || undefined,
        gsm: form.gsm ? Number(form.gsm) : undefined,
        fit: form.fit || undefined,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        isNewArrival: form.isNewArrival,
        isBestseller: form.isBestseller,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (editing) {
        await api.patch(`/admin/products/${id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/admin/products', payload);
        toast.success('Product created');
      }
      navigate('/products');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not save the product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={editing ? 'Edit product' : 'New product'} />
      <ErrorBanner message={error} />

      <form onSubmit={save} className="card p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Title">
              <input
                required
                className="input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value, handle: editing ? form.handle : slugify(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Handle (URL)">
            <input required className="input" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} />
          </Field>
          <Field label="SKU">
            <input required className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Category">
              <select required className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea rows={5} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Short description">
              <input className="input" value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} />
            </Field>
          </div>
          <Field label="Base price (PKR)">
            <input required type="number" min="1" step="0.01" className="input" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} />
          </Field>
          <Field label="Compare at price">
            <input type="number" min="1" step="0.01" className="input" value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} />
          </Field>
          <Field label="Cost price">
            <input type="number" min="1" step="0.01" className="input" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
          </Field>
          <Field label="Tags (comma separated)">
            <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </Field>
          <Field label="Fabric">
            <input className="input" value={form.fabric} onChange={(e) => setForm({ ...form, fabric: e.target.value })} />
          </Field>
          <Field label="GSM">
            <input type="number" className="input" value={form.gsm} onChange={(e) => setForm({ ...form, gsm: e.target.value })} />
          </Field>
          <Field label="Fit">
            <input className="input" value={form.fit} onChange={(e) => setForm({ ...form, fit: e.target.value })} />
          </Field>
        </div>

        <div className="border-t border-line pt-4 flex flex-wrap gap-6">
          {([
            ['isActive', 'Active'],
            ['isFeatured', 'Featured'],
            ['isNewArrival', 'New arrival'],
            ['isBestseller', 'Bestseller'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving...' : editing ? 'Update product' : 'Create product'}</button>
          <button type="button" onClick={() => navigate('/products')} className="btn btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
