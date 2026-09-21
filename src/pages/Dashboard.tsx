import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { DashboardSummary } from "../api/types";
import { useAuth } from "../auth/AuthContext";

function StatCard({
  label,
  value,
  sub,
  to,
  theme,
  icon,
}: {
  label: string;
  value: number | string;
  sub: string;
  to: string;
  theme: string;
  icon: string;
}) {
  return (
    <Link to={to} className={`stat-card stat-${theme}`}>
      <div className="stat-top">
        <span className="stat-icon">{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </Link>
  );
}

export function DashboardPage() {
  const { tenant } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await api<DashboardSummary>("/api/v1/dashboard/summary"));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page page-wide">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            {tenant ? `Welcome back, ${tenant.name} — here's today at a glance.` : "Here's today at a glance."}
          </p>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {!summary && !error && <div className="center muted">Loading…</div>}

      {summary && (
        <>
          <div className="stat-grid">
            <StatCard label="Messages Today" value={summary.messagesToday} sub="sent + received" to="/inbox" theme="blue" icon="💬" />
            <StatCard label="Delivered" value={summary.deliveredToday} sub="today" to="/inbox" theme="green" icon="✓" />
            <StatCard label="Conversations" value={summary.openConversations} sub="open now" to="/inbox" theme="amber" icon="✉" />
            <StatCard label="Campaigns" value={summary.totalCampaigns} sub="all time" to="/campaigns" theme="purple" icon="◉" />
          </div>

          <section className="card account-card">
            <div>
              <h2>WhatsApp Account</h2>
              {summary.whatsapp ? (
                <div className="account-rows">
                  <div className="account-row">
                    <span className="muted">Status</span>
                    <span>{summary.whatsapp.connected ? "🟢 Connected" : "🔴 Disconnected"}</span>
                  </div>
                  <div className="account-row">
                    <span className="muted">Business</span>
                    <span>{summary.whatsapp.businessName ?? "—"}</span>
                  </div>
                  <div className="account-row">
                    <span className="muted">Phone</span>
                    <span>{summary.whatsapp.displayPhoneNumber ?? "—"}</span>
                  </div>
                </div>
              ) : (
                <div className="muted">No WhatsApp number connected yet.</div>
              )}
            </div>
            <Link to="/settings" className="link-btn">Manage in Settings →</Link>
          </section>
        </>
      )}
    </div>
  );
}
