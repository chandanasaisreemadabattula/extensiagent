import * as React from "react";
import { toast } from "@/hooks/use-toast";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<{}, ErrorBoundaryState> {
  constructor(props: {}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    toast({
      title: "Extension UI error",
      description: error.message || "An unexpected error occurred.",
      variant: "destructive",
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white p-6">
          <div className="max-w-lg rounded-3xl border border-red-500 bg-slate-900/95 p-8 shadow-2xl shadow-red-900/30">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-sm text-slate-300 mb-6">
              The extension UI encountered an unexpected error. Try reloading the extension, or open the developer console for more details.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center rounded-full bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
              >
                Reload UI
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
