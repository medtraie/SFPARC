import React, { Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught React error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          backgroundColor: "#070B16",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, sans-serif"
        }}>
          <div style={{
            maxWidth: "600px",
            width: "100%",
            backgroundColor: "#121A2B",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
          }}>
            <h2 style={{ color: "#F0447A", fontSize: "20px", fontWeight: "bold", marginBottom: "12px" }}>
              Une erreur est survenue lors de l'affichage
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "16px" }}>
              {this.state.error?.message || "Erreur inattendue"}
            </p>
            <pre style={{
              backgroundColor: "#0B1020",
              padding: "12px",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#55D6E8",
              overflowX: "auto",
              whiteSpace: "pre-wrap"
            }}>
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: "16px",
                padding: "8px 16px",
                borderRadius: "8px",
                backgroundColor: "#55D6E8",
                color: "#070B16",
                fontWeight: "bold",
                border: "none",
                cursor: "pointer"
              }}
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
