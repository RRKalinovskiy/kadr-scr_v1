import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'busy' | 'away' | 'offline';
  role: 'admin' | 'manager' | 'user';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateStatus: (status: User['status']) => void;
  updateUser: (user: Partial<User>) => void;
}

const defaultUser: User = {
  id: '1',
  name: 'Пользователь',
  email: 'user@example.com',
  avatar: 'https://via.placeholder.com/150',
  status: 'online',
  role: 'admin',
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: defaultUser,
      isAuthenticated: true,

      login: async (email: string, password: string) => {
        // Имитация входа
        await new Promise(resolve => setTimeout(resolve, 500));
        set({
          user: { ...defaultUser, email, name: email.split('@')[0] },
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      updateStatus: (status: User['status']) => {
        set((state) => ({
          user: state.user ? { ...state.user, status } : null,
        }));
      },

      updateUser: (userData: Partial<User>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        }));
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
