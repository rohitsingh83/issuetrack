import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '@/pages/LoginPage';
import { renderWithProviders } from '@/test/utils';

const loginMock = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: loginMock,
    register: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
    isLoggingOut: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() },
}));

describe('LoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it('renders an accessible sign-in form', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('heading', { name: /sign in to issuetrack/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });

  it('blocks submission and shows validation errors when fields are empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('validates the email format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.type(screen.getByLabelText(/^password/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('submits valid credentials through the auth hook', async () => {
    loginMock.mockResolvedValue({ id: '1', name: 'Ada', email: 'ada@test.dev' });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'ada@test.dev');
    await user.type(screen.getByLabelText(/^password/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith({ email: 'ada@test.dev', password: 'Password123!' }),
    );
  });

  it('surfaces API errors returned by the login attempt', async () => {
    const { ApiError } = await import('@/lib/api');
    loginMock.mockRejectedValue(new ApiError('Invalid email or password', 401, 'UNAUTHORIZED'));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'ada@test.dev');
    await user.type(screen.getByLabelText(/^password/i), 'WrongPassword1');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
  });

  it('toggles password visibility without losing the value', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const password = screen.getByLabelText(/^password/i);
    await user.type(password, 'secret123');
    expect(password).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(password).toHaveAttribute('type', 'text');
    expect(password).toHaveValue('secret123');
  });
  it('signs in with one click from a demo persona', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({ id: 'u1', name: 'Avery Chen' });
    renderWithProviders(<LoginPage />);
    await user.click(screen.getByRole('button', { name: /sign in as avery chen, owner/i }));
    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith({ email: 'owner@demo.dev', password: 'Password123!' }),
    );
  });});
