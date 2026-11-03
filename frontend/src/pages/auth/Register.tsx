import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../../store/authStore';

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^(\+92|0)?3\d{9}$/, 'Invalid Pakistan phone number').optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  marketingOptIn: z.boolean().default(false),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export function Register() {
  const navigate = useNavigate();
  const { register: registerUser } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { marketingOptIn: false },
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError('');
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || undefined,
        marketingOptIn: data.marketingOptIn,
      });
      navigate('/verify-email', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-20 pb-16 min-h-screen flex items-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <Link to="/" className="font-display text-3xl font-medium tracking-tight block mb-4">ZIQWEAR</Link>
            <h1 className="heading-2 mb-2">Create Account</h1>
            <p className="text-muted">Join the ZIQWEAR Club</p>
          </div>

          <div className="bg-cream border border-line p-8">
            {error && <div className="mb-6 p-4 bg-sale/10 border border-sale text-[#8f2b24] text-sm">{error}</div>}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <input {...register('firstName')} type="text" className="input" placeholder="John" />
                  {errors.firstName && <p className="mt-1 text-sm text-sale">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input {...register('lastName')} type="text" className="input" placeholder="Doe" />
                  {errors.lastName && <p className="mt-1 text-sm text-sale">{errors.lastName.message}</p>}
                </div>
              </div>

              <div>
                <label className="label">Email</label>
                <input {...register('email')} type="email" className="input" placeholder="you@example.com" />
                {errors.email && <p className="mt-1 text-sm text-sale">{errors.email.message}</p>}
              </div>

              <div>
                <label className="label">Phone (Optional)</label>
                <input {...register('phone')} type="tel" className="input" placeholder="03xx xxxxxxx" />
                {errors.phone && <p className="mt-1 text-sm text-sale">{errors.phone.message}</p>}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Password</label>
                  <input {...register('password')} type="password" className="input" placeholder="••••••••" />
                  {errors.password && <p className="mt-1 text-sm text-sale">{errors.password.message}</p>}
                </div>
                <div>
                  <label className="label">Confirm Password</label>
                  <input {...register('confirmPassword')} type="password" className="input" placeholder="••••••••" />
                  {errors.confirmPassword && <p className="mt-1 text-sm text-sale">{errors.confirmPassword.message}</p>}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <input {...register('marketingOptIn')} type="checkbox" className="w-4 h-4 border-line bg-paper rounded text-brass focus:ring-brass mt-1" />
                <label className="text-sm text-muted cursor-pointer">
                  Subscribe to newsletter for exclusive offers and early access to drops
                </label>
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary btn-full w-full py-4">
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-muted">Already have an account? <Link to="/login" className="text-brass-dark hover:underline font-medium">Sign in</Link></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}