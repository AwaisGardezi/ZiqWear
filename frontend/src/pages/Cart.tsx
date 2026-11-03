import { Link } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { formatPrice } from '../utils/format';

export function Cart() {
  const { items, subtotal, itemCount, removeItem, updateQuantity } = useCartStore();

  const shippingThreshold = 5000;
  const remainingForFreeShipping = Math.max(0, shippingThreshold - subtotal);
  const freeShippingProgress = Math.min(100, (subtotal / shippingThreshold) * 100);
  const shippingFee = subtotal >= shippingThreshold ? 0 : 250;

  return (
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="heading-2 mb-8">Shopping Bag ({itemCount})</h1>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <h2 className="text-xl font-medium mb-2">Your bag is empty</h2>
            <p className="text-muted mb-8">Looks like you haven't added anything yet.</p>
            <Link to="/shop" className="btn btn-primary">Continue Shopping</Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 p-4 bg-cream border border-line">
                  <Link to={`/product/${item.product.handle}`} className="w-24 h-24 flex-shrink-0 overflow-hidden">
                    <img
                      src={item.variant?.images?.[0]?.url || item.product.images?.[0]?.url || '/placeholder.jpg'}
                      alt={item.product.title}
                      className="w-full h-full object-cover"
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${item.product.handle}`}>
                      <h3 className="font-medium">{item.product.title}</h3>
                      <p className="text-sm text-muted mt-1">
                        {[item.variant?.color, item.variant?.size].filter(Boolean).join(' · ')}
                      </p>
                    </Link>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-line">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-3 py-1 text-muted hover:text-ink">−</button>
                        <span className="px-3 py-1 w-8 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-3 py-1 text-muted hover:text-ink">+</button>
                      </div>
                      <span className="font-medium">{formatPrice(item.unitPrice * item.quantity)}</span>
                    </div>
                  </div>

                  <button onClick={() => removeItem(item.id)} className="p-2 text-muted hover:text-sale" aria-label="Remove">
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-32 bg-cream border border-line p-6 space-y-6">
                <h2 className="font-medium">Order Summary</h2>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="font-medium">{formatPrice(subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Shipping</span><span>{shippingFee === 0 ? 'Free' : formatPrice(shippingFee)}</span></div>
                </div>

                <div className="border-t border-line pt-4">
                  <div className="flex justify-between text-lg font-medium"><span>Total</span><span>{formatPrice(subtotal + shippingFee)}</span></div>
                </div>

                <Link to="/checkout" className="btn btn-primary w-full">Proceed to Checkout</Link>
                <Link to="/shop" className="btn btn-secondary w-full">Continue Shopping</Link>

                <div className="border-t border-line pt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted">Free shipping at Rs 5,000</span>
                    {remainingForFreeShipping > 0 ? (
                      <span className="text-brass-dark font-medium">Add {formatPrice(remainingForFreeShipping)}</span>
                    ) : (
                      <span className="text-ok font-medium">Free shipping unlocked</span>
                    )}
                  </div>
                  <div className="h-1.5 bg-sand rounded-full overflow-hidden">
                    <div className="h-full bg-brass transition-all duration-500" style={{ width: `${freeShippingProgress}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
