import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { Link } from 'wouter';
import { RotateCcw } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="paper-grid flex min-h-[100dvh] w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-3xl bg-card p-8 text-center ring-1 ring-border warm-shadow">
        <BrandLogo className="mx-auto h-16 w-16" />
        <p className="mt-6 font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Pausa inesperada</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-primary">
          Algo no salió como esperábamos.
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Reintentemos esta parte. Tu pedido y tu carrito siguen a salvo.
        </p>
        {/* Dev only: messages can carry API responses and other internals. */}
        {import.meta.env.DEV ? (
          <pre className="mt-4 overflow-x-auto rounded-xl bg-muted p-3 text-left text-xs text-muted-foreground">
            {error.message || String(error)}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={resetError}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary/90"
          data-testid="button-error-retry"
        >
          <RotateCcw className="h-4 w-4 text-secondary" /> Reintentar
        </button>
        <Link href="/" className="mt-5 block text-xs font-bold text-accent" data-testid="link-error-home">Volver al inicio</Link>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      'ErrorBoundary caught an error:',
      toError(error),
      info.componentStack,
    );
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
