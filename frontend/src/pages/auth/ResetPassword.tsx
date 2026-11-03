import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      navigate('/login', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not reset the password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container mx-auto px-4 max-w-md">
        <div className="text-center mb-8">
          <h1 className="heading-2 mb-2">Set a new password</h1>
        </div>

        <div className="card p-8">
          {error && <div className="mb-5 p-3 bg-sale/10 border border-sale text-[#8f2b24] text-sm">{error}</div>}

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label">Reset token</label>
              <input required className="input" value={token} onChange={(e) => setToken(e.target.value)} />
            </div>
            <div>
              <label className="label">New password</label>
              <input required type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input required type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full py-3">
              {loading ? 'Saving...' : 'Update password'}
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
