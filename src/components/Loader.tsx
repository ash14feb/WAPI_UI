import { Loader2 } from "lucide-react";

interface SpinnerProps {
  size?: number;
  color?: string;
  className?: string;
}

export function LoadingSpinner({ size = 20, color = "var(--brand-teal)", className = "" }: SpinnerProps) {
  return (
    <Loader2
      size={size}
      color={color}
      className={`animate-spin ${className}`}
      style={{ display: "inline-block", flexShrink: 0 }}
    />
  );
}

export function ButtonSpinner({ size = 14, color = "currentColor" }: SpinnerProps) {
  return (
    <Loader2
      size={size}
      color={color}
      className="animate-spin"
      style={{ display: "inline-block", marginRight: "0.4rem", flexShrink: 0 }}
    />
  );
}

interface PageLoaderProps {
  message?: string;
  description?: string;
  minHeight?: string | number;
}

export function PageLoader({
  message = "Loading data…",
  description,
  minHeight = "320px",
}: PageLoaderProps) {
  return (
    <div
      className="page-loader-wrap"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight,
        padding: "2.5rem 1.5rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "56px",
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1rem",
        }}
      >
        {/* Soft background pulse halo */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "var(--accent-light)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
        <Loader2
          size={30}
          color="var(--brand-teal)"
          className="animate-spin"
          style={{ position: "relative", zIndex: 2 }}
        />
      </div>

      <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text)", marginBottom: "0.25rem" }}>
        {message}
      </div>

      {description && (
        <div
          className="muted small"
          style={{ maxWidth: "380px", margin: "0 auto", lineHeight: 1.5 }}
        >
          {description}
        </div>
      )}
    </div>
  );
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = "Please wait…" }: LoadingOverlayProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(255, 255, 255, 0.78)",
        backdropFilter: "blur(2px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        borderRadius: "inherit",
        gap: "0.75rem",
      }}
    >
      <Loader2 size={28} color="var(--brand-teal)" className="animate-spin" />
      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>{message}</span>
    </div>
  );
}
