export interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  shortDescription?: string;
  sku: string;
  barcode?: string;
  categoryId: string;
  basePrice: number;
  compareAtPrice?: number;
  costPrice?: number;
  weight?: number;
  weightUnit: string;
  fabric?: string;
  gsm?: number;
  fit?: string;
  careInstructions?: string;
  isActive: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestseller: boolean;
  isLimitedEdition: boolean;
  limitedEditionNumber?: number;
  limitedEditionTotal?: number;
  launchDate?: string;
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  images: ProductImage[];
  variants: ProductVariant[];
  collections: Collection[];
  sizeChart?: SizeChart;
  reviews?: Review[];
  relatedProducts?: ProductRelation[];
  frequentlyBought?: FrequentlyBought[];
  minPrice?: number;
  maxPrice?: number;
  totalStock?: number;
  colors?: string[];
  sizes?: string[];
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  barcode?: string;
  title: string;
  color?: string;
  size?: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  weight?: number;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  inventory?: Inventory;
  images: ProductImage[];
}

export interface ProductImage {
  id: string;
  productId: string;
  variantId?: string;
  url: string;
  altText?: string;
  position: number;
  isPrimary: boolean;
  type: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  parent?: Category;
  children?: Category[];
  sortOrder: number;
  isActive: boolean;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  bannerImage?: string;
  isActive: boolean;
  isFeatured: boolean;
  publishAt?: string;
  unpublishAt?: string;
  sortOrder: number;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
  updatedAt: string;
  products?: ProductCollection[];
  _count?: { products: number };
}

export interface ProductCollection {
  id: string;
  productId: string;
  product?: Product;
  collectionId: string;
  collection?: Collection;
  sortOrder: number;
  createdAt: string;
}

export interface SizeChart {
  id: string;
  productId: string;
  type: 'TOPS' | 'BOTTOMS' | 'SETS' | 'OUTERWEAR' | 'ACCESSORIES';
  unit: string;
  chest?: Record<string, any>;
  waist?: Record<string, any>;
  hips?: Record<string, any>;
  length?: Record<string, any>;
  shoulder?: Record<string, any>;
  sleeve?: Record<string, any>;
  inseam?: Record<string, any>;
  rise?: Record<string, any>;
  thigh?: Record<string, any>;
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Inventory {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  reserved: number;
  lowStockThreshold: number;
  trackQuantity: boolean;
  allowBackorder: boolean;
  location?: string;
  lastCountedAt?: string;
  createdAt: string;
  updatedAt: string;
}
export interface Customer {
  id: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  isVerified: boolean;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt?: string;
  createdAt: string;
  loyaltyAccount?: LoyaltyAccount;
  addresses?: Address[];
  wishlist?: WishlistItem[];
  _count?: { orders: number; wishlist: number; reviews: number };
}

export interface Address {
  id: string;
  type: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: string;
  postalCode?: string;
  country: string;
  phone?: string;
  isDefault: boolean;
}

export interface LoyaltyAccount {
  id: string;
  tier: 'SILVER' | 'GOLD' | 'BLACK';
  pointsBalance: number;
  lifetimePoints: number;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  product: Product;
  variant?: ProductVariant;
  unitPrice: number;
  totalPrice: number;
}

export interface CmsContent {
  id: string;
  key: string;
  type: string;
  title?: string;
  content: Record<string, any>;
  isActive: boolean;
}

export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'PACKED' | 'SHIPPED'
  | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'REFUNDED';

export interface OrderItem {
  id: string;
  title: string;
  sku: string;
  color?: string;
  size?: string;
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
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod?: string;
  subtotal: number;
  shippingTotal: number;
  total: number;
  notes?: string;
  trackingNumber?: string;
  trackingCompany?: string;
  createdAt: string;
  items: OrderItem[];
  customer?: { firstName?: string; lastName?: string; email?: string };
  shippingAddress?: Record<string, any>;
  statusHistory?: Array<{ id: string; status: string; note?: string; createdAt: string }>;
}

export interface WishlistItem {
  id: string;
  productId: string;
  variantId?: string;
  product: Product;
  variant?: ProductVariant;
  createdAt: string;
}

export interface Review {
  id: string;
  rating: number;
  title?: string;
  content: string;
  createdAt: string;
  customer?: { firstName?: string; lastName?: string };
}

export interface ProductRelation {
  id: string;
  productId: string;
  relatedId: string;
  type: string;
  related?: Product;
}

export interface FrequentlyBought {
  id: string;
  productId: string;
  withProductId: string;
  frequency: number;
  withProduct?: Product;
}
