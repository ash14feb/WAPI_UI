import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Extra head actions rendered before the close button. */
  headActions?: ReactNode;
  closeTitle?: string;
}

/**
 * Dialog shell. Outside clicks are intentionally ignored: a long form (template,
 * campaign, bot) must only close via its own Close/Cancel controls so a stray
 * click cannot discard what the user typed.
 */
export function Modal({
  title,
  subtitle,
  icon,
  onClose,
  children,
  className = "",
  style,
  headActions,
  closeTitle = "Close",
}: ModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div className="modal-overlay">
      <div
        className={`modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        style={style}
      >
        <div className="modal-head">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
            {icon}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>{title}</h2>
              {subtitle && <div className="muted small">{subtitle}</div>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {headActions}
            <button type="button" className="ghost-btn" onClick={onClose} title={closeTitle} aria-label={closeTitle}>
              <X size={18} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
