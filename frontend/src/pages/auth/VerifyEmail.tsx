import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const [status, setStatus] = useState<'idle' | 'verifying' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) return;
    const verify = async () => {
      setStatus('verifying');
      try {
        await api.post('/auth/verify-email', { token });
        setStatus('done');
        setMessage('Your email is verified. Thank you!');
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.response?.data?.error || 'This verification link is invalid or expired.');
      }
    };
    verify();
  }, [token]);

  const resend = async () => {
    try {
      const response = await api.post('/auth/resend-verification');
      setMessage(
        response.data.verificationToken
          ? `Local verification token: ${response.data.verificationToken}`
          : 'Verification email sent.'
      );
    } catch {
      setMessage('Sign in first to resend the verification email.');
    }
  };

  return (
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container mx-auto px-4 max-w-md text-center">
        <h1 className="heading-2 mb-4">Verify your email</h1>

        {status === 'verifying' && <p className="text-muted">Verifying...</p>}

        {message && (
          <div className={`p-4 text-sm mb-6 border ${status === 'error' ? 'bg-sale/10 border-sale text-[#8f2b24]' : 'bg-ok/10 border-ok text-[#2f5f39]'}`}>
            {message}
          </div>
        )}

        {!token && status === 'idle' && (
          <p className="text-muted mb-6">Check your inbox for the verification link.</p>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          {isAuthenticated && (
            <button onClick={resend} className="btn btn-secondary">Resend verification</button>
          )}
          <Link to="/account" className="btn btn-primary">Go to my account</Link>
        </div>
      </div>
    </div>
  );
}
