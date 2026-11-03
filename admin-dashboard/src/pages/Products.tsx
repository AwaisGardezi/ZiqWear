import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Product } from '../types';
import { formatPrice } from '../utils/format';

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const productsRes = await api.get('/admin/products', { params: { page: pagination.page, limit: pagination.limit, search } });
        setProducts(productsRes.data.products || []);
        setPagination(productsRes.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      } catch (error) { console.error('Failed to fetch products:', error); }
    };
    fetchData();
  }, [pagination.page, pagination.limit, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination({ ...pagination, page: 1 });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="heading-1">Products</h1><p className="text-muted mt-1">Manage your product catalog</p></div>
        <Link to="/products/new" className="btn btn-primary">Add Product</Link>
      </div>

      <div className="card">
        <div className="p-4 border-b border-line">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="input pr-10" />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></button>
            </div>
            <Link to="/products/new" className="btn btn-primary whitespace-nowrap">Add Product</Link>
          </form>
        </div>

        <div className="table-container">
          <table className="table">
            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td><Link to={`/products/${product.id}/edit`} className="font-medium hover:text-brass-dark">{product.title}</Link></td>
                  <td>{product.category?.name}</td>
                  <td>{formatPrice(product.minPrice || product.basePrice)}</td>
                  <td>{product.variants.reduce((sum, v) => sum + (v.inventory?.quantity || 0), 0)}</td>
                  <td><span className={`badge ${product.isActive ? 'badge-success' : 'badge-danger'}`}>{product.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td><Link to={`/products/${product.id}/edit`} className="text-brass-dark hover:underline text-sm">Edit</Link></td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted">No products found. <Link to="/products/new" className="text-brass-dark hover:underline">Add your first product</Link>.</td></tr>}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-line flex items-center justify-between">
            <span className="text-sm text-muted">Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button disabled={pagination.page === 1} className="btn btn-secondary px-4 py-2 disabled:opacity-50">Previous</button>
              <button disabled={pagination.page === pagination.totalPages} className="btn btn-secondary px-4 py-2 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}