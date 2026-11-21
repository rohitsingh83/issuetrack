import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/react';
import App from './App';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/hooks/useAuth';
import { RealtimeProvider } from '@/hooks/useRealtime';
import { CLERK_PUBLISHABLE_KEY, isClerkConfigured } from '@/lib/clerk';
import { queryClient } from '@/lib/queryClient';
import './index.css';

/** Clerk is optional: without a publishable key the app runs on email + password only. */
function MaybeClerkProvider({ children }: { children: ReactNode }) {
  if (!isClerkConfigured) return <>{children}</>;
  return <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>{children}</ClerkProvider>;
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <MaybeClerkProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <RealtimeProvider>
                <App />
              </RealtimeProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </MaybeClerkProvider>
    </ErrorBoundary>
  </StrictMode>,
);
