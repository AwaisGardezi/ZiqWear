import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { wishlistApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { WishlistItem } from '../types';
import { ProductCard } from './HomeComponents';

export function Wishlist() {
  const { isAuthenticated } = useAuthStore();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const response = await wishlistApi.get();
        setItems(response.data.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="pt-32 pb-20 min-h-screen text-center">
        <h1 className="heading-2 mb-4">Wishlist</h1>
        <p className="text-muted mb-6">Sign in to save pieces you love.</p>
        <Link to="/login" className="btn btn-primary">Sign in</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pt-32 pb-20 min-h-screen flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gold-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="heading-2 mb-8">Wishlist ({items.length})</h1>
        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted mb-6">Nothing saved yet.</p>
            <Link to="/shop" className="btn btn-primary">Browse the shop</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {items.map((item) => item.product && <ProductCard key={item.id} product={item.product} />)}
          </div>
        )}
      </div>
    </div>
  );
}
