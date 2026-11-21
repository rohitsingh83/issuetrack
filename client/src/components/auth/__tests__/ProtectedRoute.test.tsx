import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/auth/ProtectedRoute';

const authState = {
  isAuthenticated: false,
  isLoading: false,
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    ...authState,
    user: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
    isLoggingOut: false,
  }),
}));

function renderRoutes(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login screen</div>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>Protected dashboard</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/public"
          element={
            <PublicOnlyRoute>
              <div>Public page</div>
            </PublicOnlyRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects anonymous visitors to the login screen', () => {
    authState.isAuthenticated = false;
    authState.isLoading = false;
    renderRoutes('/dashboard');
    expect(screen.getByText('Login screen')).toBeInTheDocument();
    expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument();
  });

  it('renders the protected page for authenticated users', () => {
    authState.isAuthenticated = true;
    renderRoutes('/dashboard');
    expect(screen.getByText('Protected dashboard')).toBeInTheDocument();
  });

  it('shows a loading state while the session is being resolved', () => {
    authState.isAuthenticated = false;
    authState.isLoading = true;
    renderRoutes('/dashboard');
    expect(screen.getByText(/checking your session/i)).toBeInTheDocument();
    authState.isLoading = false;
  });

  it('keeps authenticated users away from public-only screens', () => {
    authState.isAuthenticated = true;
    renderRoutes('/public');
    expect(screen.queryByText('Public page')).not.toBeInTheDocument();
  });

  it('allows anonymous visitors onto public-only screens', () => {
    authState.isAuthenticated = false;
    renderRoutes('/public');
    expect(screen.getByText('Public page')).toBeInTheDocument();
  });
});
