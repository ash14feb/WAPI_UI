import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { accountLabel, useAccounts } from "../accounts/AccountContext";
import { Building2, ChevronDown, Zap } from "lucide-react";

function AccountSwitcher() {
  const { accounts, selectedId, select, loading } = useAccounts();
  if (loading) return null;
  if (accounts.length === 0) {
    return (
      <span style={{ fontSize: "0.75rem", color: "#b91c1c", fontWeight: 700 }}>
        No number connected
      </span>
    );
  }
  const selected = accounts.find((a) => a.id === selectedId) ?? accounts[0];
  if (accounts.length === 1) {
    return (
      <span
        title={accountLabel(selected)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          fontSize: "0.75rem", color: "#0f172a", fontWeight: 700,
          background: "#f1f5f9", padding: "0.35rem 0.65rem", borderRadius: "9999px",
          maxWidth: "16rem", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
        }}
      >
        <Building2 size={13} color="#00a884" />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{accountLabel(selected)}</span>
      </span>
    );
  }
  return (
    <label
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.3rem",
        fontSize: "0.75rem", fontWeight: 700, background: "#f1f5f9",
        padding: "0.3rem 0.5rem", borderRadius: "9999px", cursor: "pointer",
      }}
      title="Sending number — actions use the selected number"
    >
      <Building2 size={13} color="#00a884" />
      <select
        value={selected.id}
        onChange={(e) => select(e.target.value)}
        style={{ border: "none", background: "transparent", fontSize: "0.75rem", fontWeight: 700, color: "#0f172a", cursor: "pointer", maxWidth: "14rem" }}
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{accountLabel(a)}</option>
        ))}
      </select>
      <ChevronDown size={13} color="#64748b" />
    </label>
  );
}

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
            <AccountSwitcher />
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
