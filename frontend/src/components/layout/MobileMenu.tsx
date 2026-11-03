import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';

export function MobileMenu() {
  const location = useLocation();
  const { isAuthenticated, logout } = useAuthStore();
  const { openCart, itemCount } = useCartStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    if (isOpen) { document.addEventListener('keydown', handleEscape); document.body.style.overflow = 'hidden'; }
    return () => { document.removeEventListener('keydown', handleEscape); document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const navLinks = [
    { href: '/shop', label: 'New Drops' },
    { href: '/shop', label: 'Shop' },
    { href: '/shop', label: 'Collections' },
    { href: '/shop', label: 'Bestsellers' },
    { href: '/lookbook', label: 'Lookbook' },
    { href: '/about', label: 'About' },
  ];

  if (!isOpen) {
    return (
      <button className="lg:hidden p-2 text-dark-300 hover:text-white transition-colors" onClick={() => setIsOpen(true)} aria-label="Open menu" aria-expanded="false">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex flex-col">
      <div className="fixed inset-0 bg-ink/45 animate-fade-in" onClick={() => setIsOpen(false)} />
      {/* ivory drawer: the panel declares its own text colour so nothing inherits ink-on-espresso */}
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-cream border-l border-line text-ink animate-slide-in flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-line">
          <span className="font-display text-xl font-medium text-ink">Menu</span>
          <button onClick={() => setIsOpen(false)} className="p-2 text-muted hover:text-ink" aria-label="Close"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navLinks.map((link) => (
            <Link key={link.href} to={link.href} onClick={() => setIsOpen(false)} className={`block px-4 py-3 text-sm font-medium transition-colors rounded-none ${location.pathname.startsWith(link.href) ? 'text-brass-dark bg-cream-deep' : 'text-muted hover:text-ink hover:bg-cream-deep'}`}>{link.label}</Link>
          ))}
          <hr className="border-line my-4" />
          <Link to="/wishlist" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm font-medium text-muted hover:text-ink hover:bg-cream-deep transition-colors">Wishlist</Link>
          <Link to="/cart" onClick={() => { setIsOpen(false); openCart(); }} className="block px-4 py-3 text-sm font-medium text-muted hover:text-ink hover:bg-cream-deep transition-colors flex items-center justify-between">
            Shopping Bag
            {itemCount > 0 && <span className="w-5 h-5 bg-brass text-[#faf7f1] text-xs font-bold rounded-full flex items-center justify-center">{itemCount > 99 ? '99+' : itemCount}</span>}
          </Link>
          {isAuthenticated ? (
            <>
              <hr className="border-line my-4" />
              <Link to="/account" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm font-medium text-muted hover:text-ink hover:bg-cream-deep transition-colors">My Account</Link>
              <Link to="/orders" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm font-medium text-muted hover:text-ink hover:bg-cream-deep transition-colors">My Orders</Link>
              <button onClick={() => { logout(); setIsOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-medium text-sale hover:bg-cream-deep transition-colors">Logout</button>
            </>
          ) : (
            <>
              <hr className="border-line my-4" />
              <Link to="/login" onClick={() => setIsOpen(false)} className="btn btn-primary btn-full w-full mx-4 mt-2">Sign In</Link>
              <Link to="/register" onClick={() => setIsOpen(false)} className="btn btn-secondary btn-full w-full mx-4 mt-2 mb-4">Create Account</Link>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}