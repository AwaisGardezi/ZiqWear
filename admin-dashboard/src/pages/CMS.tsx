import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { EmptyState, ErrorBanner, Loading, PageHeader } from '../components/AdminUI';

interface ContentRow {
  id: string;
  key: string;
  type: string;
  title?: string;
  isActive: boolean;
  content: Record<string, any>;
}

/** The storefront reads the picture from content.backgroundImage. */
const PICTURE_FIELD = 'backgroundImage';

const EMPTY_FORM = { key: '', type: 'hero', title: '', content: '{}' };

function readPicture(raw: string): string {
  try {
    const parsed = JSON.parse(raw || '{}');
    return typeof parsed?.[PICTURE_FIELD] === 'string' ? parsed[PICTURE_FIELD] : '';
  } catch {
    return '';
  }
}

/** Rewrites the JSON textarea with the picture set, or null when it is not an object. */
function withPicture(raw: string, url: string): string | null {
  try {
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (url) parsed[PICTURE_FIELD] = url;
    else delete parsed[PICTURE_FIELD];
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
}

export function CMS() {
  const [contents, setContents] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ContentRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);

  const picture = readPicture(form.content);

  const load = async () => {
    try {
      const response = await api.get('/admin/cms');
      setContents(response.data.contents || []);
    } catch {
      setError('Could not load content');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (content: ContentRow) => {
    setEditing(content);
    setForm({
      key: content.key,
      type: content.type,
      title: content.title || '',
      content: JSON.stringify(content.content ?? {}, null, 2),
    });
    setError('');
  };

  const resetForm = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const applyPicture = (url: string) => {
    const updated = withPicture(form.content, url);
    if (updated === null) {
      setError('Fix the content JSON first — it has to be an object before a picture can be set.');
      return false;
    }
    setForm({ ...form, content: updated });
    return true;
  };

  const uploadPicture = async (file?: File) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await api.post('/admin/cms/upload', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (applyPicture(response.data.url)) toast.success('Picture uploaded — remember to save');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not upload the picture');
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    let parsed: unknown;
    try {
      parsed = JSON.parse(form.content || '{}');
    } catch {
      setError('Content must be valid JSON');
      return;
    }

    try {
      const payload = { key: form.key, type: form.type, title: form.title || undefined, content: parsed, isActive: true };
      if (editing) {
        await api.patch(`/admin/cms/${editing.id}`, payload);
      } else {
        await api.post('/admin/cms', payload);
      }
      toast.success(editing ? 'Content updated' : 'Content created');
      resetForm();
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not save the content');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this content block?')) return;
    try {
      await api.delete(`/admin/cms/${id}`);
      toast.success('Content deleted');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not delete the content');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="CMS" subtitle="Homepage hero slides and content blocks" />
      <ErrorBanner message={error} />

      <form onSubmit={save} className="card p-6 space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Key</label>
            <input required className="input" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="hero">Hero</option>
              <option value="homepage">Homepage section</option>
              <option value="lookbook">Lookbook</option>
              <option value="page">Page</option>
            </select>
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
        </div>

        <div className="rounded-lg border border-line/70 bg-surface-muted/40 p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <label className="label mb-0">Picture shown on the site</label>
            <span className="text-xs text-muted">saved as content.{PICTURE_FIELD}</span>
          </div>

          <div className="flex flex-wrap items-start gap-4">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-line/70 bg-ink/5 flex items-center justify-center">
              {picture ? (
                <img src={picture} alt="Content preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-muted px-2 text-center">No picture</span>
              )}
            </div>

            <div className="flex-1 min-w-[240px] space-y-3">
              <div className="flex flex-wrap gap-3">
                <label className="btn btn-secondary text-sm cursor-pointer">
                  {uploading ? 'Uploading…' : 'Upload a photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      void uploadPicture(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
                {picture && (
                  <button type="button" className="btn btn-ghost text-sm" onClick={() => applyPicture('')}>
                    Remove picture
                  </button>
                )}
              </div>
              <input
                className="input text-sm"
                placeholder="/assets/img/… or https://…"
                value={picture}
                onChange={(e) => applyPicture(e.target.value)}
              />
              <p className="text-xs text-muted">
                Upload your own picture, or paste a link to one you already host. It appears full-bleed behind the
                hero text once you save.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="label">Content (JSON)</label>
          <textarea rows={8} className="input font-mono text-sm" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn btn-primary">{editing ? 'Update content' : 'Create content'}</button>
          {editing && (
            <button type="button" onClick={resetForm} className="btn btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Key</th><th>Type</th><th>Title</th><th>Picture</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {contents.map((content) => {
                const thumb = typeof content.content?.[PICTURE_FIELD] === 'string' ? content.content[PICTURE_FIELD] : '';
                return (
                  <tr key={content.id}>
                    <td className="font-medium">{content.key}</td>
                    <td className="text-muted">{content.type}</td>
                    <td>{content.title || '—'}</td>
                    <td>
                      {thumb ? (
                        <img src={thumb} alt="" className="h-10 w-10 rounded object-cover border border-line/70" />
                      ) : (
                        <span className="text-muted text-sm">—</span>
                      )}
                    </td>
                    <td><span className={`badge ${content.isActive ? 'badge-success' : 'badge-danger'}`}>{content.isActive ? 'Active' : 'Hidden'}</span></td>
                    <td className="space-x-3">
                      <button onClick={() => startEdit(content)} className="text-brass-dark hover:underline text-sm">Edit</button>
                      <button onClick={() => remove(content.id)} className="text-sale hover:underline text-sm">Delete</button>
                    </td>
                  </tr>
                );
              })}
              {contents.length === 0 && <EmptyState colSpan={6}>No content blocks yet</EmptyState>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
