import { Link, NavLink } from 'react-router-dom';
import { useState } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { Logo } from '../Logo';

const links = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'View All' },
  { href: '/shop?newArrival=true', label: 'New Arrivals' },
  { href: '/wardrobe', label: 'The Rail' },
  { href: '/track', label: 'Track Order' },
  { href: '/contact', label: 'Contact Us' },
];

export function Header() {
  const { itemCount } = useCartStore();
  const { customer, isAuthenticated, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-dark-950/95 text-on-dark backdrop-blur border-b border-dark-800">
      <div className="bg-brass text-[#faf7f1] text-center text-xs font-ui uppercase tracking-widest py-2">
        Free delivery on orders above Rs 5,000 · Cash on delivery across Pakistan
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Logo />

          <nav className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <NavLink
                key={link.label}
                to={link.href}
                className={({ isActive }) =>
                  `text-sm font-ui uppercase tracking-wider transition-colors ${
                    isActive ? 'text-gold-300' : 'text-dark-300 hover:text-white'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <a
              href="/legacy/index.html"
              className="text-sm font-ui uppercase tracking-wider text-dark-300 hover:text-gold-300"
              title="Archive: the original Ziqwear storefront, preserved exactly as it was"
            >
              Archive
            </a>
            <Link
              to="/wishlist"
              className="text-dark-300 hover:text-gold-300"
              aria-label="Wishlist"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0112 8a3.8 3.8 0 017 2.8C19 15.6 12 20 12 20z" />
              </svg>
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link to="/account" className="hidden sm:block text-sm text-dark-300 hover:text-gold-300">
                  {customer?.firstName || 'Account'}
                </Link>
                <button onClick={() => logout()} className="hidden sm:block text-sm text-dark-300 hover:text-white">
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login" className="hidden sm:block text-sm text-dark-300 hover:text-gold-300">
                Sign in
              </Link>
            )}

            <Link to="/cart" className="relative p-2 text-dark-300 hover:text-gold-300" aria-label="Cart">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a2 2 0 00-2-2H6a2 2 0 00-2 2v4m16 0h-6M8 7h8m0 0v4" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 11h18l-1.5 9h-15L3 11z" />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brass text-[#faf7f1] text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => setMenuOpen((open) => !open)}
              className="md:hidden p-2 text-dark-200"
              aria-label="Menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <nav className="md:hidden border-t border-dark-800 bg-dark-950">
          {links.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              onClick={() => setMenuOpen(false)}
              className="block px-6 py-3 text-sm border-b border-dark-800 text-dark-300"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="/legacy/index.html"
            onClick={() => setMenuOpen(false)}
            className="block px-6 py-3 text-sm border-b border-dark-800 text-dark-300"
          >
            Archive (original store)
          </a>
          <Link
            to={isAuthenticated ? '/account' : '/login'}
            onClick={() => setMenuOpen(false)}
            className="block px-6 py-3 text-sm text-dark-300"
          >
            {isAuthenticated ? 'My Account' : 'Sign in'}
          </Link>
        </nav>
      )}
    </header>
  );
}
