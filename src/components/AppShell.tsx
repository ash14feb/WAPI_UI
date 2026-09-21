import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Zap } from "lucide-react";

export function AppShell() {
  const location = useLocation();

  const routeTitles: Record<string, string> = {
    "/dashboard": "Overview Dashboard",
    "/inbox": "WhatsApp Live Inbox",
    "/templates": "Message Template Studio",
    "/campaigns": "Broadcast Campaigns",
    "/contacts": "Audience Directory",
    "/settings": "Integration & Settings",
  };

  const currentTitle = routeTitles[location.pathname] || "Enterprise Console";

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <header className="top-header">
          <div className="top-breadcrumb">
            <span>ImmerzoWAPI</span>
            <span>/</span>
            <span className="top-breadcrumb-current">{currentTitle}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div className="top-meta-badge">
              <span className="pulse-dot" />
              <span>Meta Cloud API v20.0 • Connected</span>
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.75rem",
                color: "#64748b",
                fontWeight: 600,
                background: "#f1f5f9",
                padding: "0.35rem 0.65rem",
                borderRadius: "9999px",
              }}
            >
              <Zap size={13} color="#00a884" />
              <span>Quality: High</span>
            </div>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  );
}
