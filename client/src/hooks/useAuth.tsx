import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: { email: string; password: string }) => Promise<User>;
  register: (payload: { name: string; email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  isLoggingOut: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      try {
        const { data: payload } = await api.auth.me();
        return payload.user;
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403))
          return null;
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const { data: result } = await api.auth.login(payload);
      return result.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.me, user);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (payload: { name: string; email: string; password: string }) => {
      const { data: result } = await api.auth.register(payload);
      return result.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.me, user);
      toast.success(`Account created — welcome, ${user.name.split(' ')[0]}!`);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.me, null);
      queryClient.clear();
      toast.success('You have been signed out');
    },
    onError: () => {
      toast.error('Could not sign out. Please try again.');
    },
  });

  const login = useCallback(
    async (payload: { email: string; password: string }) => loginMutation.mutateAsync(payload),
    [loginMutation],
  );

  const register = useCallback(
    async (payload: { name: string; email: string; password: string }) =>
      registerMutation.mutateAsync(payload),
    [registerMutation],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const updateUser = useCallback(
    (user: User) => {
      queryClient.setQueryData(queryKeys.me, user);
    },
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data ?? null,
      isLoading,
      isAuthenticated: Boolean(data),
      login,
      register,
      logout,
      updateUser,
      isLoggingOut: logoutMutation.isPending,
    }),
    [data, isLoading, login, register, logout, updateUser, logoutMutation.isPending],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
