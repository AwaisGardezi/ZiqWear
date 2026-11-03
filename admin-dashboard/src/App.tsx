import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/layout/AdminLayout';
import { Login } from './pages/auth/Login';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { ProductForm } from './pages/ProductForm';
import { Categories } from './pages/Categories';
import { Collections } from './pages/Collections';
import { Orders } from './pages/Orders';
import { Customers } from './pages/Customers';
import { Coupons } from './pages/Coupons';
import { Inventory } from './pages/Inventory';
import { CMS } from './pages/CMS';
import { Settings } from './pages/Settings';
import { Analytics } from './pages/Analytics';
import { Users } from './pages/Users';
import { ActivityLog } from './pages/ActivityLog';
import { Returns } from './pages/Returns';
import { Loyalty } from './pages/Loyalty';
import { Shipping } from './pages/Shipping';
import { useAuthStore } from './store/authStore';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuthStore();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gold-600 border-t-transparent"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id/edit" element={<ProductForm />} />
        <Route path="categories" element={<Categories />} />
        <Route path="collections" element={<Collections />} />
        <Route path="orders" element={<Orders />} />
        <Route path="customers" element={<Customers />} />
        <Route path="coupons" element={<Coupons />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="cms" element={<CMS />} />
        <Route path="settings" element={<Settings />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="users" element={<Users />} />
        <Route path="activity" element={<ActivityLog />} />
        <Route path="returns" element={<Returns />} />
        <Route path="loyalty" element={<Loyalty />} />
        <Route path="shipping" element={<Shipping />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;