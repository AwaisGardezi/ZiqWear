import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productApi, categoryApi, collectionApi } from '../services/api';
import { Product, Category, Collection } from '../types';
import { ProductGrid } from './HomeComponents';
import { usePageMeta } from '../hooks/usePageMeta';

export function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const filters = {
    category: searchParams.get('category') || '',
    collection: searchParams.get('collection') || '',
    sort: searchParams.get('sort') || 'featured',
    page: parseInt(searchParams.get('page') || '1', 10),
    limit: 20,
  };

  usePageMeta({
    title: 'Shop',
    description: 'The full ZIQWEAR catalogue — every drop in stock, priced in PKR and shipped across Pakistan.',
    url: '/shop',
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [productsRes, categoriesRes, collectionsRes] = await Promise.all([
          productApi.getAll(filters),
          categoryApi.getAll(),
          collectionApi.getAll(),
        ]);
        setProducts(productsRes.data.products || []);
        setCategories(categoriesRes.data.categories || []);
        setCollections(collectionsRes.data.collections || []);
        setPagination(productsRes.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      } catch (error) { console.error('Failed to fetch shop data:', error); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [filters.category, filters.collection, filters.sort, filters.page]);

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) newParams.set(key, value);
    else newParams.delete(key);
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-gold-600 border-t-transparent"></div></div>;

  return (
    <div className="pt-20 pb-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="breadcrumb mb-8" aria-label="Breadcrumb"><ol className="flex items-center gap-2 text-sm text-muted"><li><a href="/" className="hover:text-brass-dark">Home</a></li><li className="mx-2">/</li><li className="text-ink">Shop</li></ol></nav>
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-64 flex-shrink-0"><div className="sticky top-24 space-y-8"><div><h3 className="font-ui uppercase tracking-wider text-xs font-medium mb-4">Categories</h3><ul className="space-y-2"><li><button onClick={() => updateFilter('category', '')} className={`w-full text-left text-sm ${!filters.category ? 'text-brass-dark font-medium' : 'text-muted hover:text-ink'}`}>All Categories</button></li>{categories.filter(c => !c.parentId).map((cat) => (<li key={cat.id}><button onClick={() => updateFilter('category', cat.slug)} className={`w-full text-left text-sm ${filters.category === cat.slug ? 'text-brass-dark font-medium' : 'text-muted hover:text-ink'}`}>{cat.name} ({cat._count?.products || 0})</button></li>))}</ul></div><div><h3 className="font-ui uppercase tracking-wider text-xs font-medium mb-4">Collections</h3><ul className="space-y-2"><li><button onClick={() => updateFilter('collection', '')} className={`w-full text-left text-sm ${!filters.collection ? 'text-brass-dark font-medium' : 'text-muted hover:text-ink'}`}>All Collections</button></li>{collections.map((col) => (<li key={col.id}><button onClick={() => updateFilter('collection', col.slug)} className={`w-full text-left text-sm ${filters.collection === col.slug ? 'text-brass-dark font-medium' : 'text-muted hover:text-ink'}`}>{col.name} ({col._count?.products || 0})</button></li>))}</ul></div><div><h3 className="font-ui uppercase tracking-wider text-xs font-medium mb-4">Sort By</h3><select value={filters.sort} onChange={(e) => updateFilter('sort', e.target.value)} className="input w-full text-sm"><option value="featured">Featured</option><option value="newest">Newest</option><option value="best">Best Selling</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option><option value="name">Alphabetical</option></select></div></div></aside>
          <div className="flex-1"><div className="flex items-center justify-between mb-8"><p className="text-sm text-muted">{pagination.total} products</p></div>{products.length === 0 ? (<div className="text-center py-16"><svg className="w-16 h-16 text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg><h3 className="text-lg font-medium mb-2">No products found</h3><p className="text-muted mb-6">Try adjusting your filters or search terms.</p><button onClick={() => { setSearchParams({}); }} className="btn btn-primary">Clear All Filters</button></div>) : (<><ProductGrid products={products} />{pagination.totalPages > 1 && (<div className="mt-12 flex items-center justify-center gap-2"><button onClick={() => updateFilter('page', String(Math.max(1, pagination.page - 1)))} disabled={pagination.page === 1} className="btn btn-secondary px-4 py-2 disabled:opacity-50">Previous</button><span className="px-4 text-sm text-muted">Page {pagination.page} of {pagination.totalPages}</span><button onClick={() => updateFilter('page', String(Math.min(pagination.totalPages, pagination.page + 1)))} disabled={pagination.page === pagination.totalPages} className="btn btn-secondary px-4 py-2 disabled:opacity-50">Next</button></div>)}</>)}</div></div></div>
    </div>
  );
}