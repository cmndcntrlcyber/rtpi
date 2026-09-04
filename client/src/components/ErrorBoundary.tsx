import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  isolationLevel?: "app" | "route";
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    if (this.props.isolationLevel === "route") {
      return (
        <RouteErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return (
      <AppErrorFallback
        error={this.state.error}
        onReset={this.handleReset}
      />
    );
  }
}

function AppErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-2" />
          <CardTitle className="text-xl">Something went wrong</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            An unexpected error occurred. You can try reloading the page.
          </p>
        </CardHeader>
        {import.meta.env.DEV && error && (
          <CardContent>
            <pre className="font-mono text-xs bg-muted p-3 rounded-md overflow-auto max-h-40 text-muted-foreground">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </CardContent>
        )}
        <CardFooter className="flex justify-center gap-3">
          <Button variant="outline" onClick={onReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button variant="destructive" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function RouteErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  return (
    <div className="p-8 flex flex-col items-center justify-center text-center">
      <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
      <h1 className="text-2xl font-bold mb-2">This page encountered an error</h1>
      <p className="text-muted-foreground mb-4">
        Something went wrong while rendering this page.
      </p>
      {import.meta.env.DEV && error && (
        <pre className="font-mono text-xs bg-muted p-3 rounded-md overflow-auto max-h-32 max-w-lg w-full text-muted-foreground mb-4">
          {error.message}
        </pre>
      )}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onReset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
        <Button variant="ghost" onClick={() => (window.location.href = "/")}>
          <Home className="h-4 w-4 mr-2" />
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
