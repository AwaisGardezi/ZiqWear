import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productApi } from '../services/api';
import { Product } from '../types';
import { usePageMeta } from '../hooks/usePageMeta';
import { formatPrice } from '../utils/format';
import { useCartStore } from '../store/cartStore';
import { ProductGallery } from '../components/ProductGallery';

export function ProductDetail() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [color, setColor] = useState<string>('');
  const [size, setSize] = useState<string>('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!handle) return;
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const response = await productApi.getByHandle(handle);
        setProduct(response.data.product);
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [handle]);

  const variants = useMemo(() => product?.variants || [], [product]);
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[], [variants]);
  const sizes = useMemo(() => [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[], [variants]);

  useEffect(() => {
    if (!product) return;
    if (colors.length) setColor(colors[0]);
    if (sizes.length) setSize(sizes[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const selectedVariant = variants.find(
    (v) => (!colors.length || v.color === color) && (!sizes.length || v.size === size)
  ) || variants[0];

  const primaryImage = product?.images.find((image) => image.isPrimary) ?? product?.images[0];

  const pageMeta = useMemo(() => {
    if (!product) return null;
    const description = (product.seoDescription || product.shortDescription || product.description || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      title: product.seoTitle || product.title,
      description: description.slice(0, 160),
      image: primaryImage?.url,
      url: `/product/${product.handle}`,
    };
  }, [product, primaryImage]);

  usePageMeta(pageMeta);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gold-600 border-t-transparent" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-medium">Product not found</h2>
        <Link to="/shop" className="btn btn-primary">Continue Shopping</Link>
      </div>
    );
  }

  const price = Number(selectedVariant?.price ?? product.minPrice ?? product.basePrice);
  const compareAtPrice = Number(selectedVariant?.compareAtPrice ?? product.compareAtPrice ?? 0);
  const discount = compareAtPrice > price ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : 0;
  const stock = selectedVariant?.inventory?.quantity ?? product.totalStock ?? 0;
  const inStock = stock > 0;

  const handleAdd = async (goToCheckout = false) => {
    setAdding(true);
    try {
      await addItem(product, selectedVariant, quantity);
      toast.success('Added to cart');
      if (goToCheckout) navigate('/checkout');
    } catch {
      toast.error('Could not add to cart');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="pt-32 pb-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="mb-8 text-sm text-muted">
          <Link to="/" className="hover:text-brass-dark">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/shop" className="hover:text-brass-dark">Shop</Link>
          <span className="mx-2">/</span>
          <span className="text-ink">{product.title}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12">
          <ProductGallery
            images={product.images}
            variants={variants}
            activeColor={colors.length > 1 ? color : undefined}
            title={product.title}
          />

          <div className="space-y-6">
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-ink mb-2">{product.title}</h1>
              <p className="text-muted text-sm">SKU: {selectedVariant?.sku || product.sku}</p>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-2xl font-medium">{formatPrice(price)}</span>
              {compareAtPrice > price && (
                <>
                  <span className="text-muted line-through text-xl">{formatPrice(compareAtPrice)}</span>
                  <span className="bg-sale text-[#faf7f1] text-sm px-2 py-1">-{discount}%</span>
                </>
              )}
            </div>

            <p className="text-body">{product.description}</p>

            {colors.length > 1 && (
              <div>
                <label className="label">Colour: {color}</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((option) => (
                    <button
                      key={option}
                      onClick={() => setColor(option)}
                      className={`px-3 py-2 text-sm border ${color === option ? 'border-brass text-brass-dark font-medium' : 'border-line text-muted hover:text-ink'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sizes.length > 1 && (
              <div>
                <label className="label">Size: {size}</label>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((option) => (
                    <button
                      key={option}
                      onClick={() => setSize(option)}
                      className={`px-4 py-2 text-sm border ${size === option ? 'border-brass text-brass-dark font-medium' : 'border-line text-muted hover:text-ink'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label">Quantity</label>
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-line">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-2 text-muted hover:text-ink">−</button>
                  <span className="px-4 py-2 w-12 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(99, quantity + 1))} className="px-4 py-2 text-muted hover:text-ink">+</button>
                </div>
                {inStock ? (
                  <span className="text-ok text-sm">{stock} in stock</span>
                ) : (
                  <span className="text-sale text-sm">Out of stock</span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => handleAdd(false)} disabled={!inStock || adding} className="btn btn-primary flex-1 py-4 disabled:opacity-50">
                {adding ? 'Adding...' : 'Add to Cart'}
              </button>
              <button onClick={() => handleAdd(true)} disabled={!inStock || adding} className="btn btn-secondary flex-1 py-4 disabled:opacity-50">
                Buy now
              </button>
            </div>

            <details className="border-t border-line pt-4">
              <summary className="cursor-pointer font-medium">Details</summary>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                <li>Fabric: {product.fabric || 'Combed cotton'}{product.gsm ? `, ${product.gsm} GSM` : ''}</li>
                <li>Fit: {product.fit || 'Oversized'}</li>
                {product.careInstructions && <li>{product.careInstructions}</li>}
              </ul>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
