import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { CampaignDetail } from "../api/types";
import { useRealtime } from "../realtime/useRealtime";

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
      <div className="page">
        <Link to="/campaigns" className="link-btn">← Campaigns</Link>
        {error ? <div className="error">{error}</div> : <div className="center muted">Loading…</div>}
      </div>
    );
  }

  const pct = campaign.counts.total > 0
    ? Math.round(((campaign.counts.SENT + campaign.counts.FAILED) / campaign.counts.total) * 100)
    : 0;
  const sendable = campaign.status === "DRAFT" || campaign.status === "SCHEDULED";
  const cancellable = sendable || campaign.status === "SENDING";

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/campaigns" className="link-btn">← Campaigns</Link>
          <h1>{campaign.name}</h1>
          <div className="muted small">
            {campaign.template ? `${campaign.template.name} (${campaign.template.language})` : "No template"}
            {campaign.scheduledAt ? ` · scheduled ${new Date(campaign.scheduledAt).toLocaleString()}` : ""}
          </div>
        </div>
        <div className="page-actions">
          <span className={`badge badge-${campaign.status.toLowerCase()}`}>{campaign.status}</span>
          {sendable && <button onClick={() => void act("send")} disabled={busy}>Send now</button>}
          {cancellable && (
            <button className="danger-btn" onClick={() => void act("cancel")} disabled={busy}>
              Cancel
            </button>
          )}
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="card">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="muted small" style={{ marginTop: "0.4rem" }}>
          {campaign.counts.SENT} sent · {campaign.counts.FAILED} failed · {campaign.counts.PENDING} pending ·{" "}
          {campaign.counts.CANCELLED} cancelled · {campaign.counts.total} total
        </div>
      </section>

      <section className="card">
        <h2>Recipients</h2>
        <table className="tbl">
          <thead>
            <tr><th>Contact</th><th>Phone</th><th>Recipient</th><th>Message (exact)</th><th>Error</th></tr>
          </thead>
          <tbody>
            {campaign.recipients.map((r) => (
              <tr key={r.id}>
                <td>{r.contact.name || r.contact.profileName || "—"}</td>
                <td className="muted small">{r.contact.phone}</td>
                <td><span className={`badge badge-${r.status.toLowerCase()}`}>{r.status}</span></td>
                <td>
                  {r.message ? (
                    <span className={`badge badge-${r.message.status.toLowerCase()}`}>{r.message.status}</span>
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </td>
                <td className="muted small">{r.message?.errorCode ? `${r.message.errorCode}: ` : ""}{r.errorMessage ?? r.message?.errorMessage ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
