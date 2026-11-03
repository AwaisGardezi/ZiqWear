import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="pt-32 pb-20 min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="font-display text-7xl text-gold-600 mb-4">404</p>
        <h1 className="heading-2 mb-3">Page not found</h1>
        <p className="text-muted mb-8">The page you are looking for does not exist.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/" className="btn btn-primary">Back home</Link>
          <Link to="/shop" className="btn btn-secondary">Shop</Link>
        </div>
      </div>
    </div>
  );
}
