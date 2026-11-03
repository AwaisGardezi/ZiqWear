import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { ErrorBanner, Loading, PageHeader } from '../components/AdminUI';

interface SiteSettings {
  storeName?: string;
  tagline?: string;
  brandMeaning?: string;
  contactEmail?: string;
  contactPhone?: string;
  whatsappNumber?: string;
  address?: string;
  businessHours?: string;
  currencySymbol?: string;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
}

export function Settings() {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/admin/settings');
        setSettings(response.data.settings || {});
      } catch {
        setError('Could not load settings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.patch('/admin/settings', settings);
      setMessage('Settings saved');
      toast.success('Settings saved');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Store identity and contact details" />
      <ErrorBanner message={error} />
      {message && <div className="p-4 bg-ok/10 border border-ok text-[#2f5f39] text-sm">{message}</div>}

      <form onSubmit={save} className="card p-6 space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Store name</label>
            <input className="input" value={settings.storeName || ''} onChange={(e) => setSettings({ ...settings, storeName: e.target.value })} />
          </div>
          <div>
            <label className="label">Tagline</label>
            <input className="input" value={settings.tagline || ''} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} />
          </div>
          <div>
            <label className="label">Brand meaning</label>
            <input className="input" value={settings.brandMeaning || ''} onChange={(e) => setSettings({ ...settings, brandMeaning: e.target.value })} />
          </div>
          <div>
            <label className="label">Currency symbol</label>
            <input className="input" value={settings.currencySymbol || ''} onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })} />
          </div>
          <div>
            <label className="label">Contact email</label>
            <input type="email" className="input" value={settings.contactEmail || ''} onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })} />
          </div>
          <div>
            <label className="label">Contact phone</label>
            <input className="input" value={settings.contactPhone || ''} onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })} />
          </div>
          <div>
            <label className="label">WhatsApp number</label>
            <input className="input" value={settings.whatsappNumber || ''} onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })} />
          </div>
          <div>
            <label className="label">Business hours</label>
            <input className="input" value={settings.businessHours || ''} onChange={(e) => setSettings({ ...settings, businessHours: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <input className="input" value={settings.address || ''} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
          </div>
        </div>

        <div className="border-t border-line pt-6 space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={!!settings.maintenanceMode}
              onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
            />
            <span className="text-sm">Maintenance mode</span>
          </label>
          <div>
            <label className="label">Maintenance message</label>
            <input className="input" value={settings.maintenanceMessage || ''} onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })} />
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </form>
    </div>
  );
}
