import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { formatPrice } from '../utils/format';

const accountNav = [
  { path: '/account', label: 'Overview', icon: 'home' },
  { path: '/account/orders', label: 'My Orders', icon: 'package' },
  { path: '/account/wishlist', label: 'Wishlist', icon: 'heart' },
  { path: '/account/addresses', label: 'Addresses', icon: 'map-pin' },
  { path: '/account/profile', label: 'Profile', icon: 'user' },
  { path: '/account/loyalty', label: 'Loyalty', icon: 'star' },
];

export function Account() {
  const { customer, logout } = useAuthStore();
  const location = useLocation();

  return (
    <div className="pt-20 pb-16 min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="bg-cream border border-line p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-brass/15 flex items-center justify-center">
                  <span className="text-2xl font-medium text-brass-dark">{customer?.firstName?.[0] || 'U'}</span>
                </div>
                <div>
                  <h3 className="font-medium">{customer?.firstName} {customer?.lastName}</h3>
                  <p className="text-sm text-muted">{customer?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="px-3 py-1 bg-brass/10 text-brass-dark rounded-full font-medium capitalize">{customer?.loyaltyAccount?.tier?.toLowerCase() || 'silver'}</span>
                <span className="text-muted">{customer?.loyaltyAccount?.pointsBalance || 0} pts</span>
              </div>
            </div>

            <nav className="bg-cream border border-line rounded-none overflow-hidden">
              {accountNav.map((item) => (
                <Link key={item.path} to={item.path} className={`block px-4 py-3 border-b border-line transition-colors ${location.pathname === item.path ? 'bg-brass/10 text-brass-dark border-l-4 border-l-brass' : 'text-muted hover:text-ink hover:bg-cream-deep'}`}>
                  {item.label}
                </Link>
              ))}
              <button onClick={() => logout()} className="w-full text-left px-4 py-3 text-sale hover:bg-cream-deep transition-colors border-t border-line">Logout</button>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export function AccountOverview() {
  const { customer } = useAuthStore();

  return (
    <div>
      <h1 className="heading-2 mb-8">My Account</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard label="Total Orders" value={customer?.totalOrders || 0} />
        <StatCard label="Total Spent" value={formatPrice(customer?.totalSpent || 0)} />
        <StatCard label="Wishlist Items" value={customer?.wishlist?.length || 0} />
        <StatCard label="Loyalty Points" value={customer?.loyaltyAccount?.pointsBalance || 0} />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <section className="bg-cream border border-line p-6">
          <h2 className="heading-3 mb-4">Recent Orders</h2>
          <p className="text-muted">No recent orders. <Link to="/shop" className="text-brass-dark hover:underline">Start shopping</Link></p>
        </section>
        <section className="bg-cream border border-line p-6">
          <h2 className="heading-3 mb-4">Loyalty Status</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between"><span>Current Tier</span><span className="px-3 py-1 bg-brass/10 text-brass-dark rounded-full font-medium capitalize">{customer?.loyaltyAccount?.tier?.toLowerCase() || 'silver'}</span></div>
            <div className="flex items-center justify-between"><span>Points Balance</span><span className="font-medium">{customer?.loyaltyAccount?.pointsBalance || 0}</span></div>
            <div className="h-2 bg-sand rounded-full overflow-hidden"><div className="h-full bg-brass" style={{ width: '25%' }} /></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-cream border border-line p-6 text-center">
      <p className="text-3xl font-medium text-brass-dark">{value}</p>
      <p className="text-sm text-muted mt-1">{label}</p>
    </div>
  );
}