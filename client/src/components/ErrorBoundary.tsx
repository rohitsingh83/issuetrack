import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/** Catches rendering errors so a single broken view never blanks the app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
          <div className="surface-card w-full max-w-md p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
            <p className="mt-1 text-sm text-slate-600">
              The interface hit an unexpected error. Reloading usually fixes it.
            </p>
            <p className="mt-2 break-words rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
              {this.state.message}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button
                variant="secondary"
                onClick={() => this.setState({ hasError: false, message: '' })}
              >
                Try again
              </Button>
              <Button onClick={() => window.location.reload()}>Reload app</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
