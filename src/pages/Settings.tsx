import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { WhatsappAccount } from "../api/types";

function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "XXXX";
  return `+${digits.slice(0, 2)} XXXXX ${digits.slice(-5)}`;
}

function maskWaba(waba: string): string {
  if (waba.length <= 4) return "************";
  return `${"*".repeat(Math.max(0, waba.length - 4))}${waba.slice(-4)}`;
}

export function SettingsPage() {
  const [accounts, setAccounts] = useState<WhatsappAccount[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAccounts(await api<WhatsappAccount[]>("/api/v1/whatsapp/accounts"));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load settings");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            Connected numbers and workspace connection status.
          </p>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="card">
        <h2>WhatsApp Business</h2>
        {accounts.length === 0 && !error && <div className="muted">Loading…</div>}
        {accounts.length === 0 && !error ? null : accounts.length === 0 ? (
          <div className="muted">No WhatsApp number connected yet.</div>
        ) : (
          accounts.map((a) => {
            const show = revealed.has(a.id);
            const connected = a.status === "ACTIVE";
            return (
              <div key={a.id} className="account-block">
                <div className="account-rows">
                  <div className="account-row">
                    <span className="muted">Status</span>
                    <span>{connected ? "🟢 Connected" : "🔴 Disconnected"}</span>
                  </div>
                  <div className="account-row">
                    <span className="muted">Business</span>
                    <span>{a.businessName ?? "—"}</span>
                  </div>
                  <div className="account-row">
                    <span className="muted">Phone</span>
                    <span>{show ? (a.displayPhoneNumber ?? "—") : maskPhone(a.displayPhoneNumber)}</span>
                  </div>
                  <div className="account-row">
                    <span className="muted">WABA</span>
                    <span className="mono">{show ? a.wabaId : maskWaba(a.wabaId)}</span>
                  </div>
                </div>
                <button className="link-btn" onClick={() => toggleReveal(a.id)}>
                  {show ? "Hide details" : "Reveal details"}
                </button>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
