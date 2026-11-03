import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [devLink, setDevLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setDevLink('');

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setMessage(response.data.message || 'Check your inbox for the reset link');
      if (response.data.resetToken) {
        setDevLink(`${window.location.origin}/reset-password?token=${response.data.resetToken}`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not send the reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container mx-auto px-4 max-w-md">
        <div className="text-center mb-8">
          <h1 className="heading-2 mb-2">Forgot password</h1>
          <p className="text-muted">We will send you a link to reset it.</p>
        </div>

        <div className="card p-8">
          {error && <div className="mb-5 p-3 bg-sale/10 border border-sale text-[#8f2b24] text-sm">{error}</div>}
          {message && <div className="mb-5 p-3 bg-ok/10 border border-ok text-[#2f5f39] text-sm">{message}</div>}

          {devLink && (
            <div className="mb-5 text-sm text-muted break-all">
              Local development link (email is not configured):
              <a href={devLink} className="block mt-2 text-brass-dark hover:underline">{devLink}</a>
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label">Email</label>
              <input required type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full py-3">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>

          <p className="text-center text-sm text-muted mt-6">
            <Link to="/login" className="text-brass-dark hover:underline">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
