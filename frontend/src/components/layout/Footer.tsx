import { Link } from 'react-router-dom';
import { Logo } from '../Logo';

export function Footer() {
  const footerLinks = {
    about: [
      { label: 'Our Story', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Press', href: '/press' },
      { label: 'Sustainability', href: '/sustainability' },
    ],
    customerService: [
      { label: 'Contact Us', href: '/contact' },
      { label: 'FAQs', href: '/faqs' },
      { label: 'Shipping Policy', href: '/shipping-policy' },
      { label: 'Return Policy', href: '/return-policy' },
      { label: 'Track Order', href: '/track' },
    ],
    legal: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms & Conditions', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
    ],
    social: [
      { label: 'Instagram', href: 'https://instagram.com', external: true },
      { label: 'TikTok', href: 'https://tiktok.com', external: true },
      { label: 'Twitter', href: 'https://twitter.com', external: true },
      { label: 'YouTube', href: 'https://youtube.com', external: true },
    ],
  };

  const paymentMethods = [
    { name: 'Visa', icon: 'visa' },
    { name: 'Mastercard', icon: 'mastercard' },
    { name: 'JazzCash', icon: 'jazzcash' },
    { name: 'Easypaisa', icon: 'easypaisa' },
    { name: 'Bank Transfer', icon: 'bank' },
    { name: 'Cash on Delivery', icon: 'cod' },
  ];

  return (
    <footer className="bg-dark-950 text-on-dark border-t border-dark-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12 mb-16">
          <div className="col-span-2 lg:col-span-1">
            <div className="mb-4"><Logo /></div>
            <p className="text-dark-400 text-sm leading-relaxed mb-6">Zenith In Quality Wear. Premium streetwear crafted in Pakistan with global standards.</p>
            <div className="flex gap-4">
              {footerLinks.social.map((social) => (
                <a key={social.label} href={social.href} target={social.external ? '_blank' : undefined} rel={social.external ? 'noopener noreferrer' : undefined} className="text-dark-400 hover:text-gold-300 transition-colors" aria-label={social.label}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-ui uppercase tracking-wider text-xs font-medium mb-4">About</h4>
            <ul className="space-y-3">
              {footerLinks.about.map((link) => (
                <li key={link.label}><Link to={link.href} className="text-dark-400 hover:text-gold-300 transition-colors text-sm">{link.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-ui uppercase tracking-wider text-xs font-medium mb-4">Customer Service</h4>
            <ul className="space-y-3">
              {footerLinks.customerService.map((link) => (
                <li key={link.label}><Link to={link.href} className="text-dark-400 hover:text-gold-300 transition-colors text-sm">{link.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-ui uppercase tracking-wider text-xs font-medium mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}><Link to={link.href} className="text-dark-400 hover:text-gold-300 transition-colors text-sm">{link.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-dark-800 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-dark-400 text-sm">&copy; {new Date().getFullYear()} ZIQWEAR. All rights reserved.</p>
            
            <div className="flex items-center gap-4">
              <span className="text-dark-400 text-sm">Payment Methods</span>
              <div className="flex items-center gap-3">
                {paymentMethods.map((method) => (
                  <span key={method.name} className="text-dark-400 text-xs font-medium uppercase tracking-wider">{method.name}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}