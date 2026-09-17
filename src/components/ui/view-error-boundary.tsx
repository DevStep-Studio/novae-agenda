"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  currentView?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ViewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ViewErrorBoundary caught an error:", error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.currentView !== this.props.currentView && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "48px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            minHeight: "50vh",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              display: "grid",
              placeItems: "center",
            }}
          >
            <AlertTriangle size={28} />
          </div>

          <div style={{ maxWidth: 460 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
              Não foi possível carregar esta aba
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
              Ocorreu uma instabilidade pontual ao renderizar esta seção. Seus dados continuam preservados.
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              onClick={this.handleRetry}
              className="button button-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 18px" }}
            >
              <RefreshCw size={16} />
              <span>Tentar novamente</span>
            </button>
            {this.props.onReset && (
              <button
                type="button"
                onClick={this.props.onReset}
                className="button"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 18px" }}
              >
                <Home size={16} />
                <span>Ir para o Início</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
