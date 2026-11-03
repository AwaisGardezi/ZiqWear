import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add any auth headers if needed
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        await api.post('/auth/refresh');
        return api(originalRequest);
      } catch {
        // Refresh failed, redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

// API functions
export const productApi = {
  getAll: (params?: Record<string, any>) => api.get('/products', { params }),
  getByHandle: (handle: string) => api.get(`/products/${handle}`),
  getFilters: () => api.get('/products/meta/filters'),
};

export const categoryApi = {
  getAll: () => api.get('/categories'),
  getBySlug: (slug: string) => api.get(`/categories/${slug}`),
};

export const collectionApi = {
  getAll: () => api.get('/collections'),
  getBySlug: (slug: string) => api.get(`/collections/${slug}`),
};

export const cartApi = {
  get: () => api.get('/cart'),
  add: (data: { productId: string; variantId?: string; quantity: number }) => api.post('/cart', data),
  update: (id: string, quantity: number) => api.patch(`/cart/${id}`, { quantity }),
  remove: (id: string) => api.delete(`/cart/${id}`),
  clear: () => api.delete('/cart'),
};

export const wishlistApi = {
  get: () => api.get('/wishlist'),
  add: (data: { productId: string; variantId?: string }) => api.post('/wishlist', data),
  remove: (productId: string, variantId?: string) => api.delete(`/wishlist/${productId}`, { params: { variantId } }),
  clear: () => api.delete('/wishlist'),
};

export const orderApi = {
  create: (data: any) => api.post('/orders', data),
  getAll: (params?: { page?: number; limit?: number }) => api.get('/orders', { params }),
  getById: (id: string) => api.get(`/orders/${id}`),
  cancel: (id: string) => api.post(`/orders/${id}/cancel`),
};

export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: { token: string; password: string }) => api.post('/auth/reset-password', data),
  verifyEmail: (token: string) => api.post('/auth/verify-email', { token }),
  resendVerification: () => api.post('/auth/resend-verification'),
  refresh: () => api.post('/auth/refresh'),
};

export const customerApi = {
  getProfile: () => api.get('/customers/profile'),
  updateProfile: (data: any) => api.patch('/customers/profile', data),
  getAddresses: () => api.get('/customers/addresses'),
  addAddress: (data: any) => api.post('/customers/addresses', data),
  updateAddress: (id: string, data: any) => api.patch(`/customers/addresses/${id}`, data),
  deleteAddress: (id: string) => api.delete(`/customers/addresses/${id}`),
};

export const reviewApi = {
  getByProduct: (productId: string, params?: { page?: number; limit?: number; rating?: number }) => 
    api.get(`/reviews/product/${productId}`, { params }),
  create: (data: any) => api.post('/reviews', data),
  update: (id: string, data: any) => api.patch(`/reviews/${id}`, data),
  delete: (id: string) => api.delete(`/reviews/${id}`),
  getMyReviews: () => api.get('/reviews/my-reviews'),
};

export const couponApi = {
  validate: (data: { code: string; subtotal: number; items?: any[] }) => api.post('/coupons/validate', data),
};

export const loyaltyApi = {
  getAccount: () => api.get('/loyalty/account'),
  getTiers: () => api.get('/loyalty/tiers'),
  redeem: (data: { points: number; rewardId: string }) => api.post('/loyalty/redeem', data),
};

export const shippingApi = {
  calculate: (data: { city: string; province: string; postalCode?: string; subtotal: number; weight?: number }) => 
    api.post('/shipping/calculate', data),
  getZones: () => api.get('/shipping/zones'),
};

export const cmsApi = {
  getHomepage: () => api.get('/cms/homepage'),
  getPage: (key: string) => api.get(`/cms/page/${key}`),
  getType: (type: string) => api.get(`/cms/type/${type}`),
  getLookbook: () => api.get('/cms/lookbook'),
};

export const settingsApi = {
  get: () => api.get('/settings'),
  getSeo: (path: string) => api.get(`/settings/seo/${path}`),
};

export const newsletterApi = {
  subscribe: (data: { email: string; name?: string; source?: string; tags?: string[] }) => 
    api.post('/newsletter/subscribe', data),
  unsubscribe: (email: string) => api.post('/newsletter/unsubscribe', { email }),
};

export const analyticsApi = {
  track: (data: { eventName: string; properties?: any; pageUrl?: string; referrer?: string }) => 
    api.post('/analytics/track', data),
  trackBatch: (events: any[]) => api.post('/analytics/track/batch', { events }),
};

export default api;