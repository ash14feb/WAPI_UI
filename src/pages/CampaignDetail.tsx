import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { CampaignDetail } from "../api/types";
import { useRealtime } from "../realtime/useRealtime";
import { PageLoader, ButtonSpinner } from "../components/Loader";
import {
  ArrowLeft,
  Send,
  XCircle,
  Users,
  Smartphone,
  Calendar,
  Sparkles,
} from "lucide-react";

export function CampaignDetailPage() {
  const { campaignId } = useParams();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!campaignId) return;
    try {
      setCampaign(await api<CampaignDetail>(`/api/v1/campaigns/${campaignId}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load campaign");
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRealtime = useCallback(
    (e: { type: string; campaignId?: string }) => {
      if (e.type === "campaign.updated" && e.campaignId === campaignId) void load();
    },
    [campaignId, load],
  );
  useRealtime(onRealtime);

  async function act(path: string) {
    if (!campaignId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/campaigns/${campaignId}/${path}`, { method: "POST", body: "{}" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!campaign) {
    return (
      <div className="page page-wide">
        <Link to="/campaigns" className="secondary-btn" style={{ width: "fit-content", marginBottom: "1rem" }}>
          <ArrowLeft size={15} />
          <span>Back to Campaigns</span>
        </Link>
        {error ? (
          <div className="error">{error}</div>
        ) : (
          <PageLoader
            message="Loading broadcast details…"
            description="Retrieving campaign recipients, delivery metrics, and message execution timeline"
            minHeight="320px"
          />
        )}
      </div>
    );
  }

  const pct =
    campaign.counts.total > 0
      ? Math.round(((campaign.counts.SENT + campaign.counts.FAILED) / campaign.counts.total) * 100)
      : 0;
  const sendable = campaign.status === "DRAFT" || campaign.status === "SCHEDULED";
  const cancellable = sendable || campaign.status === "SENDING";

  return (
    <div className="page page-wide">
      <Link to="/campaigns" className="secondary-btn" style={{ width: "fit-content", marginBottom: "1rem" }}>
        <ArrowLeft size={15} />
        <span>Back to Campaigns</span>
      </Link>

      <header className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#00a884",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background: "#e6f7f3",
                padding: "0.2rem 0.5rem",
                borderRadius: "6px",
              }}
            >
              Broadcast Mission
            </span>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>•</span>
            <span className={`badge badge-${campaign.status.toLowerCase()}`}>{campaign.status}</span>
          </div>
          <h1>{campaign.name}</h1>
          <div className="muted small" style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.35rem" }}>
            {campaign.template && (
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Sparkles size={14} color="#00a884" />
                <strong>{campaign.template.name}</strong> ({campaign.template.language})
              </span>
            )}
            {campaign.scheduledAt && (
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Calendar size={14} color="#64748b" />
                <span>Scheduled for {new Date(campaign.scheduledAt).toLocaleString()}</span>
              </span>
            )}
          </div>
        </div>

        <div className="page-actions">
          {sendable && (
            <button className="primary-btn" onClick={() => void act("send")} disabled={busy}>
              {busy ? <ButtonSpinner size={15} /> : <Send size={15} />}
              <span>{busy ? "Sending…" : "Send Broadcast Now"}</span>
            </button>
          )}
          {cancellable && (
            <button className="danger-btn" onClick={() => void act("cancel")} disabled={busy}>
              {busy ? <ButtonSpinner size={15} color="#dc2626" /> : <XCircle size={15} />}
              <span>{busy ? "Cancelling…" : "Cancel Campaign"}</span>
            </button>
          )}
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      {/* Progress & Quick Stats Card */}
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Execution Progress</h2>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "#00a884" }}>{pct}% Complete</span>
        </div>

        <div className="progress-track" style={{ height: "8px" }}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "0.75rem",
            marginTop: "1.25rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ textAlign: "center", padding: "0.5rem", background: "#f8fafc", borderRadius: "8px" }}>
            <div className="muted tiny" style={{ textTransform: "uppercase", fontWeight: 700 }}>Total Audience</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "0.2rem" }}>{campaign.counts.total}</div>
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem", background: "#f0fdf4", borderRadius: "8px" }}>
            <div style={{ color: "#16a34a", fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 700 }}>Sent</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#15803d", marginTop: "0.2rem" }}>{campaign.counts.SENT}</div>
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem", background: "#fef2f2", borderRadius: "8px" }}>
            <div style={{ color: "#dc2626", fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 700 }}>Failed</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#b91c1c", marginTop: "0.2rem" }}>{campaign.counts.FAILED}</div>
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem", background: "#fffbeb", borderRadius: "8px" }}>
            <div style={{ color: "#d97706", fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 700 }}>Pending</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#b45309", marginTop: "0.2rem" }}>{campaign.counts.PENDING}</div>
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem", background: "#f1f5f9", borderRadius: "8px" }}>
            <div className="muted tiny" style={{ textTransform: "uppercase", fontWeight: 700 }}>Cancelled</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#475569", marginTop: "0.2rem" }}>{campaign.counts.CANCELLED}</div>
          </div>
        </div>
      </section>

      {/* Recipients Table */}
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2>
            <Users size={18} color="#00a884" />
            <span>Target Recipients ({campaign.recipients.length})</span>
          </h2>
        </div>

        <div className="table-container">
          <table className="tbl">
            <thead>
              <tr>
                <th>Recipient Name</th>
                <th>Phone Number</th>
                <th>Recipient Status</th>
                <th>Delivery State</th>
                <th>Meta Error / Notes</th>
              </tr>
            </thead>
            <tbody>
              {campaign.recipients.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>
                      {r.contact.name || r.contact.profileName || "Anonymous"}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontFamily: "var(--font-mono)", color: "#475569" }}>
                      <Smartphone size={13} color="#94a3b8" />
                      <span>{r.contact.phone}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${r.status.toLowerCase()}`}>{r.status}</span>
                  </td>
                  <td>
                    {r.message ? (
                      <span className={`badge badge-${r.message.status.toLowerCase()}`}>
                        {r.message.status}
                      </span>
                    ) : (
                      <span className="muted small">—</span>
                    )}
                  </td>
                  <td className="muted small">
                    {r.message?.errorCode ? `${r.message.errorCode}: ` : ""}
                    {r.errorMessage ?? r.message?.errorMessage ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
