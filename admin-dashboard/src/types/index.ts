export interface ProductImage {
  id: string;
  url: string;
  altText?: string;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: string;
  sku: string;
  title: string;
  color?: string;
  size?: string;
  price: number;
  position: number;
  isActive: boolean;
  inventory?: { id: string; quantity: number; lowStockThreshold: number };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  sortOrder: number;
  isActive: boolean;
  image?: string;
  _count?: { products: number };
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  isFeatured: boolean;
  _count?: { products: number };
}

export interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  sku: string;
  categoryId: string;
  category?: Category;
  basePrice: number;
  compareAtPrice?: number;
  isActive: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestseller: boolean;
  tags: string[];
  images: ProductImage[];
  variants: ProductVariant[];
  collections?: Array<{ id: string; collectionId: string; collection?: Collection }>;
  minPrice?: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  isVerified: boolean;
  isBlocked: boolean;
  tags: string[];
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  lastOrderAt?: string;
  loyaltyAccount?: { tier: string; pointsBalance: number };
}

export interface OrderItem {
  id: string;
  title: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product?: Product;
}

export interface Order {
  id: string;
  orderNumber: string;
  email: string;
  phone: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  subtotal: number;
  shippingTotal: number;
  total: number;
  notes?: string;
  internalNotes?: string;
  trackingNumber?: string;
  createdAt: string;
  customer?: { firstName?: string; lastName?: string; email?: string };
  items: OrderItem[];
  shippingAddress?: Record<string, any>;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  minPurchase?: number;
  usageCount: number;
  usageLimit?: number;
  isActive: boolean;
  startsAt?: string;
  expiresAt?: string;
}

export interface InventoryRow {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  reserved: number;
  lowStockThreshold: number;
  product?: { id: string; title: string; handle: string; images: ProductImage[] };
  variant?: { id: string; title: string; color?: string; size?: string; sku: string };
}

export interface ReturnRequest {
  id: string;
  status: string;
  type: string;
  reason: string;
  refundAmount?: number;
  createdAt: string;
  order?: { orderNumber: string; total: number };
  customer?: { email: string; firstName?: string; lastName?: string };
}
