import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import "./ErrorBoundary.css";

interface ErrorBoundaryProps {
  /** What failed, e.g. "o catálogo". */
  label: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Keeps a rendering error in one view from blanking the whole page: the view
 * shows a message with a retry, the header and the other tab keep working.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Erro ao exibir ${this.props.label}`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page-error" role="alert">
        <strong>Algo deu errado ao exibir {this.props.label}.</strong>
        <p>{this.state.error.message}</p>
        <button type="button" onClick={() => this.setState({ error: null })}>
          Tentar novamente
        </button>
      </div>
    );
  }
}
