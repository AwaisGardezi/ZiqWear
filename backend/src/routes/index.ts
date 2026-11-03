import { Router } from 'express';
import { authRoutes } from './auth';
import { productRoutes } from './products';
import { categoryRoutes } from './categories';
import { collectionRoutes } from './collections';
import { cartRoutes } from './cart';
import { wishlistRoutes } from './wishlist';
import { orderRoutes } from './orders';
import { customerRoutes } from './customers';
import { reviewRoutes } from './reviews';
import { couponRoutes } from './coupons';
import { loyaltyRoutes } from './loyalty';
import { shippingRoutes } from './shipping';
import { cmsRoutes } from './cms';
import { settingsRoutes } from './settings';
import { newsletterRoutes } from './newsletter';
import { analyticsRoutes } from './analytics';
import { paymentRoutes } from './payments';
import { adminAuthRoutes } from './admin/auth';
import { adminProductRoutes } from './admin/products';
import { adminCategoryRoutes } from './admin/categories';
import { adminCollectionRoutes } from './admin/collections';
import { adminOrderRoutes } from './admin/orders';
import { adminCustomerRoutes } from './admin/customers';
import { adminCouponRoutes } from './admin/coupons';
import { adminInventoryRoutes } from './admin/inventory';
import { adminCmsRoutes } from './admin/cms';
import { adminSettingsRoutes } from './admin/settings';
import { adminAnalyticsRoutes } from './admin/analytics';
import { adminUserRoutes } from './admin/users';
import { adminActivityRoutes } from './admin/activity';
import { adminReturnRoutes } from './admin/returns';
import { adminReviewRoutes } from './admin/reviews';
import { adminLoyaltyRoutes } from './admin/loyalty';
import { adminShippingRoutes } from './admin/shipping';
import { authMiddleware, adminAuthMiddleware, optionalAuth } from '../middleware/auth';

export const apiRoutes = Router();

// Public routes
apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/products', productRoutes);
apiRoutes.use('/categories', categoryRoutes);
apiRoutes.use('/collections', collectionRoutes);
apiRoutes.use('/shipping', shippingRoutes);
apiRoutes.use('/cms', cmsRoutes);
apiRoutes.use('/settings', settingsRoutes);
apiRoutes.use('/newsletter', newsletterRoutes);
apiRoutes.use('/analytics', analyticsRoutes);

// Reviews: reading is public, writing protects itself (each route applies
// authMiddleware / the submit rate limiter), so no router-level guard here.
apiRoutes.use('/reviews', reviewRoutes);

// Payments (Stripe + manual rails). Individual routes apply their own auth;
// the Stripe webhook is intentionally public and verifies the raw body itself.
apiRoutes.use('/payments', paymentRoutes);

// Protected customer routes
apiRoutes.use('/cart', authMiddleware, cartRoutes);
apiRoutes.use('/wishlist', authMiddleware, wishlistRoutes);
apiRoutes.use('/orders', optionalAuth, orderRoutes);
apiRoutes.use('/customers', authMiddleware, customerRoutes);
apiRoutes.use('/coupons', authMiddleware, couponRoutes);
apiRoutes.use('/loyalty', authMiddleware, loyaltyRoutes);

// Admin auth must be reachable before the auth guard (it handles login itself).
apiRoutes.use('/admin/auth', adminAuthRoutes);

// Admin routes (require admin auth)
const adminRouter = Router();
adminRouter.use(adminAuthMiddleware);
adminRouter.use('/products', adminProductRoutes);
adminRouter.use('/categories', adminCategoryRoutes);
adminRouter.use('/collections', adminCollectionRoutes);
adminRouter.use('/orders', adminOrderRoutes);
adminRouter.use('/customers', adminCustomerRoutes);
adminRouter.use('/coupons', adminCouponRoutes);
adminRouter.use('/inventory', adminInventoryRoutes);
adminRouter.use('/cms', adminCmsRoutes);
adminRouter.use('/settings', adminSettingsRoutes);
adminRouter.use('/analytics', adminAnalyticsRoutes);
adminRouter.use('/users', adminUserRoutes);
adminRouter.use('/activity', adminActivityRoutes);
adminRouter.use('/returns', adminReturnRoutes);
adminRouter.use('/reviews', adminReviewRoutes);
adminRouter.use('/loyalty', adminLoyaltyRoutes);
adminRouter.use('/shipping', adminShippingRoutes);

apiRoutes.use('/admin', adminRouter);