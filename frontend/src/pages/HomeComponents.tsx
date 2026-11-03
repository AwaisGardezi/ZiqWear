import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Product } from '../types';
import { formatPrice } from '../utils/format';
import { newsletterApi } from '../services/api';

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) return <div className="text-center py-12 text-muted">No products found</div>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {products.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const image = product.images?.[0]?.url || '/placeholder.jpg';
  const price = Number(product.minPrice ?? product.basePrice);
  const compareAtPrice = Number(product.compareAtPrice ?? 0);
  const discount = compareAtPrice > price ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : 0;

  return (
    <Link to={`/product/${product.handle}`} className="card group block">
      <div className="relative aspect-square overflow-hidden">
        <img src={image} alt={product.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        {product.isNewArrival && <span className="absolute top-3 left-3 bg-brass text-[#faf7f1] text-xs font-medium px-2 py-1">New</span>}
        {product.isLimitedEdition && <span className="absolute top-3 left-3 bg-sale text-white text-xs font-medium px-2 py-1">Limited</span>}
        {discount > 0 && <span className="absolute top-3 right-3 bg-espresso text-on-dark text-xs font-medium px-2 py-1">-{discount}%</span>}
      </div>
      <div className="p-4">
        <h3 className="font-medium text-sm line-clamp-1">{product.title}</h3>
        <div className="flex items-center gap-2 mt-2">
          <span className="font-medium">{formatPrice(price)}</span>
          {compareAtPrice > price && <span className="text-muted text-sm line-through">{formatPrice(compareAtPrice)}</span>}
        </div>
        {product.colors && product.colors.length > 0 && (
          <p className="text-xs text-muted mt-2">{product.colors.slice(0, 3).join(' · ')}</p>
        )}
      </div>
    </Link>
  );
}

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await newsletterApi.subscribe({ email, source: 'website' });
      toast.success('Thanks for subscribing');
      setEmail('');
    } catch {
      toast.error('Could not subscribe right now');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto" onSubmit={submit}>
      <input
        type="email"
        required
        placeholder="Enter your email"
        className="input flex-1"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <button type="submit" disabled={loading} className="btn btn-primary whitespace-nowrap">
        {loading ? 'Subscribing...' : 'Subscribe'}
      </button>
    </form>
  );
}
