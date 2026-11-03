import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { productApi, wishlistApi } from "../../services/api";
import { useCartStore } from "../../store/cartStore";
import { useAuthStore } from "../../store/authStore";
import { formatPrice } from "../../utils/format";
import type { Product } from "../../types";
import { Rail, type RailProduct, type RailSelection } from "../../lib/rail";
import "../../lib/rail.css";

/** Map an API Product (Prisma shape) into the shape the rail needs. */
function toRailProduct(p: Product): RailProduct {
  const variantSizes = [...new Set((p.variants || []).map((v) => v.size).filter(Boolean))] as string[];
  const variantColors = [...new Set((p.variants || []).map((v) => v.color).filter(Boolean))] as string[];
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    price: Number(p.minPrice ?? p.basePrice ?? 0),
    compareAt: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
    stock: Number(p.totalStock ?? 0),
    sizes: (p.sizes && p.sizes.length ? p.sizes : variantSizes) || [],
    colors: (p.colors && p.colors.length ? p.colors : variantColors) || [],
    image: p.images?.[0]?.url,
    active: p.isActive,
  };
}

/**
 * Mounts the imperative 3D Rail and feeds it from the real catalogue.
 * The rail owns its own DOM inside the host ref; React only supplies the data,
 * the callbacks and the teardown (destroy() on unmount / data change).
 */
export function RailFrame({
  panel,
  limit = 40,
  hostClassName,
}: {
  panel: boolean;
  limit?: number;
  hostClassName?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<Rail | null>(null);
  const navigate = useNavigate();

  const addItem = useCartStore((s) => s.addItem);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");
  const [wished, setWished] = useState<Set<string>>(new Set());

  // pull the catalogue
  useEffect(() => {
    let alive = true;
    productApi
      .getAll({ limit })
      .then((res) => {
        if (!alive) return;
        const list: Product[] = res.data.products || [];
        setProducts(list);
        setStatus(list.length ? "ready" : "empty");
      })
      .catch(() => {
        if (!alive) return;
        setStatus("empty");
      });
    return () => {
      alive = false;
    };
  }, [limit]);

  // seed wishlist state (best-effort; only meaningful when signed in)
  useEffect(() => {
    if (!isAuthenticated) {
      setWished(new Set());
      return;
    }
    let alive = true;
    wishlistApi
      .get()
      .then((res) => {
        if (!alive) return;
        const items: Array<{ productId: string }> = res.data.items || [];
        setWished(new Set(items.map((i) => i.productId)));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  const railProducts = useMemo(() => products.map(toRailProduct).filter((p) => p.active !== false), [products]);
  const rawById = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const handleAddToCart = useCallback(
    async (railProd: RailProduct, sel: RailSelection) => {
      const raw = rawById.get(railProd.id);
      if (!raw) return;
      const variants = raw.variants || [];
      const variant =
        variants.find((v) => (!v.size || v.size === sel.size) && (!v.color || v.color === sel.color)) ||
        variants.find((v) => v.size === sel.size) ||
        variants[0];
      try {
        await addItem(raw, variant, sel.qty || 1);
        toast.success("Added to bag");
      } catch {
        toast.error("Could not add to bag");
      }
    },
    [addItem, rawById]
  );

  const handleToggleWish = useCallback(
    async (railProd: RailProduct) => {
      if (!isAuthenticated) {
        toast("Sign in to save pieces to your wishlist");
        navigate("/login");
        return;
      }
      const already = wished.has(railProd.id);
      try {
        if (already) {
          await wishlistApi.remove(railProd.id);
          setWished((prev) => {
            const next = new Set(prev);
            next.delete(railProd.id);
            return next;
          });
          toast("Removed from wishlist");
        } else {
          await wishlistApi.add({ productId: railProd.id });
          setWished((prev) => new Set(prev).add(railProd.id));
          toast.success("Saved to wishlist");
        }
      } catch {
        toast.error("Could not update wishlist");
      }
    },
    [isAuthenticated, navigate, wished]
  );

  const handleToast = useCallback((msg: string) => toast(msg), []);
  const handleNavigate = useCallback((href: string) => navigate(href), [navigate]);

  // Keep the live handlers in a ref so the rail is mounted once and never
  // rebuilt when transient state (wishlist set) changes underneath it.
  const handlersRef = useRef({
    addToCart: handleAddToCart,
    toggleWish: handleToggleWish,
    toast: handleToast,
    navigate: handleNavigate,
    isWished: (_p: RailProduct): boolean => false,
  });
  const isWished = useCallback((p: RailProduct) => wished.has(p.id), [wished]);
  handlersRef.current = {
    addToCart: handleAddToCart,
    toggleWish: handleToggleWish,
    toast: handleToast,
    navigate: handleNavigate,
    isWished,
  };

  // (re)mount the imperative rail whenever its data changes
  useEffect(() => {
    const host = hostRef.current;
    if (!host || status !== "ready") return;

    railRef.current?.destroy();
    const rail = new Rail(host, {
      panel,
      products: railProducts,
      storeName: "ZIQWEAR",
      tagline: "Wear your identity",
      onAddToCart: (p, sel) => void handlersRef.current.addToCart(p, sel),
      onToggleWish: (p) => void handlersRef.current.toggleWish(p),
      onToast: (m) => handlersRef.current.toast(m),
      onNavigate: (h) => handlersRef.current.navigate(h),
      isWished: (p) => handlersRef.current.isWished(p),
      formatPrice,
    });
    railRef.current = rail;
    rail.caption();
    rail.layout();

    return () => {
      rail.destroy();
      railRef.current = null;
    };
  }, [status, panel, railProducts]);

  // refresh the focus-mode heart without rebuilding the rail
  useEffect(() => {
    railRef.current?.paintBuy();
  }, [wished]);

  if (status === "empty") {
    return (
      <div className={hostClassName}>
        <div className="rail-band__empty">
          Nothing is hanging on the rail yet —{" "}
          <a className="rail-band__link" href="/shop">
            browse the shop
          </a>{" "}
          or add pieces from the admin.
        </div>
      </div>
    );
  }

  return <div ref={hostRef} className={hostClassName} />;
}
