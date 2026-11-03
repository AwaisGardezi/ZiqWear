import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../../store/authStore';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type LoginForm = z.infer<typeof loginSchema>;

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/';

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError('');
    try {
      await login(data.email, data.password, data.rememberMe);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* espresso chip keeps the white logo mark legible, and sets its own light text */}
          <Link to="/" className="inline-flex items-center justify-center gap-3 mb-4 bg-espresso text-on-dark px-5 py-3">
            <img src="/assets/img/logo-z.png" alt="" width={44} height={44} className="object-contain" style={{ height: 44, width: 44 }} />
            <span className="font-display text-3xl font-medium tracking-tight text-on-dark">ZIQWEAR</span>
          </Link>
          <h1 className="heading-2 mb-2">Admin Login</h1>
          <p className="text-muted">Sign in to access the dashboard</p>
        </div>

        <div className="bg-cream border border-line p-8">
          {error && <div className="mb-6 p-4 bg-sale/10 border border-sale text-[#8f2b24] text-sm">{error}</div>}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="label">Email</label>
              <input {...register('email')} type="email" className="input" placeholder="admin@ziqwear.com" />
              {errors.email && <p className="mt-1 text-sm text-sale">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <input {...register('password')} type="password" className="input" placeholder="••••••••" />
              {errors.password && <p className="mt-1 text-sm text-sale">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input {...register('rememberMe')} type="checkbox" className="w-4 h-4 border-line bg-paper rounded text-brass focus:ring-brass" />
                <span className="text-sm text-muted">Remember me</span>
              </label>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-full w-full py-4">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}