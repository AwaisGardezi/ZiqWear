import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      loading: false,

      login: async (email: string, password: string, rememberMe = false) => {
        set({ loading: true });
        try {
          await api.post('/admin/auth/login', { email, password, rememberMe });
          await get().fetchProfile();
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await api.post('/admin/auth/logout');
        } finally {
          set({ user: null, isAuthenticated: false });
        }
      },

      fetchProfile: async () => {
        try {
          const response = await api.get('/admin/auth/me');
          set({ user: response.data.admin, isAuthenticated: true, loading: false });
        } catch {
          set({ user: null, isAuthenticated: false, loading: false });
        }
      },

      clearError: () => {},
    }),
    {
      name: 'ziqwear-admin-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);