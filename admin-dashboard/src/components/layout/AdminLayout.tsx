import { Outlet, Link, NavLink } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { AdminIcon } from './AdminIcons';

const navigation = [
  { name: 'Dashboard', href: '/', icon: 'dashboard' },
  { name: 'Products', href: '/products', icon: 'package' },
  { name: 'Categories', href: '/categories', icon: 'folder' },
  { name: 'Collections', href: '/collections', icon: 'layers' },
  { name: 'Orders', href: '/orders', icon: 'shopping-bag' },
  { name: 'Customers', href: '/customers', icon: 'users' },
  { name: 'Coupons', href: '/coupons', icon: 'tag' },
  { name: 'Inventory', href: '/inventory', icon: 'database' },
  { name: 'CMS', href: '/cms', icon: 'file-text' },
  { name: 'Settings', href: '/settings', icon: 'settings' },
  { name: 'Analytics', href: '/analytics', icon: 'bar-chart' },
  { name: 'Users', href: '/users', icon: 'user-cog', adminOnly: true },
  { name: 'Activity Log', href: '/activity', icon: 'history', adminOnly: true },
  { name: 'Returns', href: '/returns', icon: 'rotate-ccw' },
  { name: 'Loyalty', href: '/loyalty', icon: 'award' },
  { name: 'Shipping', href: '/shipping', icon: 'truck' },
];

export function AdminLayout() {
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {mobileMenuOpen && <div className="fixed inset-0 z-40 bg-ink/45 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}
      {/* espresso chrome: the aside declares its own light text so the ink body default never leaks in */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-espresso text-on-dark border-r border-dark-700 transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${mobileMenuOpen ? 'translate-x-0' : ''}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b border-dark-700">
            <Link to="/" className="flex items-center gap-2">
              <img src="/assets/img/logo-z.png" alt="" width={26} height={26} className="object-contain" style={{ height: 26, width: 26 }} />
              <span className="font-display text-xl font-medium tracking-tight text-on-dark">ZIQWEAR</span>
              <span className="text-xs font-ui uppercase tracking-widest text-gold-300 hidden sm:block">Admin</span>
            </Link>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-dark-300 hover:text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navigation.filter(item => !item.adminOnly || user?.role === 'SUPER_ADMIN').map((item) => (
              <NavLink key={item.name} to={item.href} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-none transition-colors ${isActive ? 'bg-brass/25 text-gold-300 border-l-4 border-l-gold-300' : 'text-dark-300 hover:text-white hover:bg-dark-800'}`}><AdminIcon name={item.icon} />{item.name}</NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-dark-700">
            <div className="flex items-center gap-3 mb-4"><div className="w-8 h-8 rounded-full bg-brass/25 flex items-center justify-center"><span className="text-sm font-medium text-gold-300">{user?.name?.[0] || 'A'}</span></div><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate text-on-dark">{user?.name}</p><p className="text-xs text-dark-300 truncate">{user?.email}</p></div></div>
            <button onClick={() => logout()} className="w-full btn btn-secondary text-on-dark border border-dark-600 hover:bg-dark-800 text-sm py-2">Sign Out</button>
          </div>
        </div>
      </aside>
      <main className="flex-1 lg:ml-64">
        <div className="h-16 lg:hidden flex items-center justify-between px-4 border-b border-line"><button onClick={() => setMobileMenuOpen(true)} className="p-2 text-muted hover:text-ink"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg></button><span className="font-medium text-ink">Admin</span><div className="w-10" /></div>
        <div className="p-6 lg:p-8"><Outlet /></div>
      </main>
    </div>
  );
}