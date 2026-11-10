import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { accountLabel, useAccounts } from "../accounts/AccountContext";
import { Building2, ChevronDown, Menu, PanelLeft } from "lucide-react";

function AccountSwitcher() {
  const { accounts, selectedId, select, loading } = useAccounts();
  if (loading) return null;
  if (accounts.length === 0) {
    return (
      <span style={{ fontSize: "0.75rem", color: "var(--danger)", fontWeight: 700 }}>
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
          fontSize: "0.75rem", color: "var(--text)", fontWeight: 700,
          background: "var(--bg-subtle)", padding: "0.35rem 0.65rem", borderRadius: "9999px",
          maxWidth: "14rem", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
        }}
      >
        <Building2 size={13} color="var(--brand-teal)" />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{accountLabel(selected)}</span>
      </span>
    );
  }
  return (
    <label
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.3rem",
        fontSize: "0.75rem", fontWeight: 700, background: "var(--bg-subtle)",
        padding: "0.3rem 0.5rem", borderRadius: "9999px", cursor: "pointer",
      }}
      title="Sending number — actions use the selected number"
    >
      <Building2 size={13} color="var(--brand-teal)" />
      <select
        value={selected.id}
        onChange={(e) => select(e.target.value)}
        style={{ border: "none", background: "transparent", fontSize: "0.75rem", fontWeight: 700, color: "var(--text)", cursor: "pointer", maxWidth: "12rem" }}
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{accountLabel(a)}</option>
        ))}
      </select>
      <ChevronDown size={13} color="var(--text-muted)" />
    </label>
  );
}

export function AppShell() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("iwapi.sidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });

  function toggleCollapse() {
    setCollapsed((prev) => {
      try {
        window.localStorage.setItem("iwapi.sidebarCollapsed", prev ? "0" : "1");
      } catch {
        // Non-fatal; layout still toggles for the session.
      }
      return !prev;
    });
  }

  // Close mobile sidebar whenever route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const routeTitles: Record<string, string> = {
    "/dashboard": "Overview Dashboard",
    "/inbox": "WhatsApp Live Inbox",
    "/templates": "Message Template Studio",
    "/campaigns": "Broadcast Campaigns",
    "/contacts": "Audience Directory",
    "/bots": "Chatbot Auto-Replies",
    "/flows": "Flow Builder Studio",
    "/integrations": "Connected Integrations",
    "/settings": "Integration & Settings",
  };

  const currentTitle = routeTitles[location.pathname] || "Enterprise Console";

  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      <div className="app-content">
        <header className="top-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0 }}>
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar menu"
              title="Open menu"
            >
              <Menu size={20} />
            </button>
            <button
              type="button"
              className="desktop-collapse-btn"
              onClick={toggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            >
              <PanelLeft size={18} />
            </button>
            <div className="top-breadcrumb">
              <span>UnifyLead</span>
              <span>/</span>
              <span className="top-breadcrumb-current">{currentTitle}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
            <AccountSwitcher />
            <div className="top-meta-badge header-badge-desktop">
              <span className="pulse-dot" />
              <span>Connected (v20.0)</span>
            </div>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  );
}
