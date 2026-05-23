"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <p className="text-lg font-semibold text-destructive mb-2">Ocurrio un error</p>
          <p className="text-sm text-muted-foreground mb-4">{this.state.error?.message ?? "Error desconocido"}</p>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}