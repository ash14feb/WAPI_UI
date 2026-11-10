import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info";

export interface ToastOptions {
  title: string;
  message?: string;
  /** Mono text for raw provider payloads (fbtrace id, blame field, …). */
  detail?: string;
  kind?: ToastKind;
  /** Auto-dismiss delay in ms; 0 keeps the toast until closed. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

type Listener = (toast: ToastItem) => void;

const listeners = new Set<Listener>();
let nextId = 1;

/** Fire a notification from anywhere — including non-component code such as API helpers. */
export function toast(options: ToastOptions): void {
  const item: ToastItem = { kind: "info", duration: 6000, ...options, id: nextId++ };
  listeners.forEach((l) => l(item));
}

const KIND_STYLE: Record<ToastKind, { accent: string; bg: string; border: string; Icon: typeof Info }> = {
  success: { accent: "#059669", bg: "#f0fdf4", border: "#bbf7d0", Icon: CheckCircle2 },
  error: { accent: "#dc2626", bg: "#fef2f2", border: "#fecaca", Icon: AlertCircle },
  info: { accent: "#0284c7", bg: "#f0f9ff", border: "#bae6fd", Icon: Info },
};

const MAX_VISIBLE = 4;

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const listener: Listener = (item) => {
      setItems((prev) => [...prev.filter((t) => t.id !== item.id), item].slice(-MAX_VISIBLE));
      if (item.duration && item.duration > 0) {
        const timer = window.setTimeout(() => dismiss(item.id), item.duration);
        timers.current.set(item.id, timer);
      }
    };
    listeners.add(listener);
    const timersOnMount = timers.current;
    return () => {
      listeners.delete(listener);
      timersOnMount.forEach((t) => window.clearTimeout(t));
      timersOnMount.clear();
    };
  }, [dismiss]);

  if (items.length === 0) return null;

  return (
    <div className="toast-stack" role="region" aria-label="Notifications" aria-live="polite">
      {items.map((t) => {
        const style = KIND_STYLE[t.kind ?? "info"];
        return (
          <div key={t.id} className="toast" role={t.kind === "error" ? "alert" : "status"} style={{ background: style.bg, borderColor: style.border }}>
            <style.Icon size={18} color={style.accent} style={{ flexShrink: 0, marginTop: "0.1rem" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{t.title}</div>
              {t.message && (
                <div style={{ fontSize: "0.8125rem", color: "#334155", marginTop: "0.15rem", lineHeight: 1.45, wordBreak: "break-word" }}>
                  {t.message}
                </div>
              )}
              {t.detail && (
                <pre
                  style={{
                    margin: "0.4rem 0 0",
                    padding: "0.4rem 0.5rem",
                    background: "rgba(255,255,255,0.75)",
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: "6px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.6875rem",
                    color: "#475569",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: "140px",
                    overflowY: "auto",
                  }}
                >
                  {t.detail}
                </pre>
              )}
            </div>
            <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
