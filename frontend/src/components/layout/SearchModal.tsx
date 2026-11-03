import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { productApi } from '../../services/api';
import { Product } from '../../types';

export function SearchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setLoading(true);
      productApi.getAll({ search: debouncedQuery, limit: 8 })
        .then(res => { setResults(res.data.products || []); setLoading(false); })
        .catch(() => { setResults([]); setLoading(false); });
    } else {
      setResults([]);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current && !isOpen) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const product = results[selectedIndex];
      if (product) {
        setIsOpen(false);
        setQuery('');
        setSelectedIndex(-1);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="fixed inset-0 bg-ink/45 animate-fade-in" onClick={() => setIsOpen(false)} />
      {/* ivory modal surface — it sets its own ink text so children never fall back to espresso-on-cream */}
      <div className="w-full max-w-2xl bg-cream border border-line text-ink shadow-xl animate-scale-in">
        <div className="p-4 border-b border-line">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search products... (press / to focus)"
              className="w-full pl-10 pr-4 py-3 bg-paper border border-line text-ink placeholder:text-muted rounded-none focus:outline-none focus:border-brass"
              autoComplete="off"
            />
            {query && (
              <button onClick={() => { setQuery(''); setResults([]); setSelectedIndex(-1); inputRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink" aria-label="Clear search">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            )}
          </div>
          <p className="text-xs text-muted mt-2">Use ↑↓ to navigate, Enter to select, Esc to close</p>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-brass border-t-transparent mx-auto"></div></div>
          ) : results.length === 0 && query.length >= 2 ? (
            <div className="p-8 text-center text-muted">No products found for "{query}"</div>
          ) : results.length > 0 ? (
            <ul className="divide-y divide-line">
              {results.map((product, index) => (
                <li key={product.id}>
                  <Link to={`/product/${product.handle}`} onClick={() => setIsOpen(false)} className={`flex items-center gap-4 p-4 transition-colors ${selectedIndex === index ? 'bg-cream-deep' : 'hover:bg-cream-deep'}`}>
                    <img src={product.images[0]?.url || '/placeholder.jpg'} alt={product.title} className="w-16 h-16 object-cover" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate text-ink">{product.title}</h4>
                      <p className="text-xs text-muted mt-1">{product.colors?.[0] || ''}{product.sizes?.[0] && ` • ${product.sizes[0]}`}</p>
                      <span className="text-sm font-medium text-brass-dark">{product.minPrice !== undefined ? `${product.minPrice}` : 'PKR 0'}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : query.length === 0 ? (
            <div className="p-8 text-center text-muted">Start typing to search products...</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}