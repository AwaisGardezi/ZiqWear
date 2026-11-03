import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Customer } from '../types';
import { authApi, customerApi } from '../services/api';

interface AuthState {
  customer: Customer | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<Customer>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      customer: null,
      isAuthenticated: false,
      loading: false,

      login: async (email: string, password: string, rememberMe = false) => {
        set({ loading: true });
        try {
          await authApi.login({ email, password, rememberMe });
          await get().fetchProfile();
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      register: async (data) => {
        set({ loading: true });
        try {
          await authApi.register(data);
          await get().fetchProfile();
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          set({ customer: null, isAuthenticated: false });
        }
      },

      forgotPassword: async (email) => {
        await authApi.forgotPassword(email);
      },

      resetPassword: async (token, password) => {
        await authApi.resetPassword({ token, password });
      },

      verifyEmail: async (token) => {
        await authApi.verifyEmail(token);
      },

      resendVerification: async () => {
        await authApi.resendVerification();
      },

      fetchProfile: async () => {
        try {
          const response = await authApi.me();
          set({ customer: response.data.customer, isAuthenticated: true, loading: false });
        } catch {
          set({ customer: null, isAuthenticated: false, loading: false });
        }
      },

      updateProfile: async (data) => {
        const response = await customerApi.updateProfile(data);
        set({ customer: response.data.customer });
      },

      clearError: () => {},
    }),
    {
      name: 'ziqwear-auth',
      partialize: (state) => ({ customer: state.customer, isAuthenticated: state.isAuthenticated }),
    }
  )
);