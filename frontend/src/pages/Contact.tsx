import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';

interface Settings {
  contactEmail?: string;
  contactPhone?: string;
  whatsappNumber?: string;
  address?: string;
  businessHours?: string;
}

export function Contact() {
  const [settings, setSettings] = useState<Settings>({});
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => setSettings(data.settings || data || {}))
      .catch(() => {});
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    // The original store opened the visitor's mail app with the message prefilled.
    const body = `${form.message}\n\n— ${form.name}\n${form.email}${form.phone ? `\n${form.phone}` : ''}`;
    const to = settings.contactEmail || 'ziqwear@gmail.com';
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(form.subject || 'ZIQWEAR enquiry')}&body=${encodeURIComponent(body)}`;
    toast.success('Opening your email app...');
    setSending(false);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-5xl">
      <h1 className="heading-2 mb-2">Contact Us</h1>
      <p className="text-muted">We usually reply within one working day</p>

      <div className="grid md:grid-cols-2 gap-10 mt-10">
        <div className="space-y-6">
          <div>
            <h2 className="font-ui uppercase tracking-wider text-xs text-muted mb-1">Email</h2>
            <a href={`mailto:${settings.contactEmail || 'ziqwear@gmail.com'}`} className="text-brass-dark hover:underline">
              {settings.contactEmail || 'ziqwear@gmail.com'}
            </a>
          </div>
          {settings.contactPhone && (
            <div>
              <h2 className="font-ui uppercase tracking-wider text-xs text-muted mb-1">Phone</h2>
              <a href={`tel:${settings.contactPhone}`} className="text-ink hover:text-brass-dark">{settings.contactPhone}</a>
            </div>
          )}
          {settings.whatsappNumber && (
            <div>
              <h2 className="font-ui uppercase tracking-wider text-xs text-muted mb-1">WhatsApp</h2>
              <a
                href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink hover:text-brass-dark"
              >
                {settings.whatsappNumber}
              </a>
            </div>
          )}
          {settings.address && (
            <div>
              <h2 className="font-ui uppercase tracking-wider text-xs text-muted mb-1">Address</h2>
              <p className="text-ink">{settings.address}</p>
            </div>
          )}
          {settings.businessHours && (
            <div>
              <h2 className="font-ui uppercase tracking-wider text-xs text-muted mb-1">Hours</h2>
              <p className="text-ink">{settings.businessHours}</p>
            </div>
          )}
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="label">Name</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone (optional)</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Subject</label>
            <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea required rows={5} className="input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <button type="submit" disabled={sending} className="btn btn-primary w-full">
            {sending ? 'Sending...' : 'Send message'}
          </button>
        </form>
      </div>
    </div>
  );
}
