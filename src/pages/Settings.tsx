import { useCallback, useEffect, useState } from "react";
import { api, ApiError, asArray, API_URL } from "../api/client";
import type { WhatsappAccount } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useAccounts } from "../accounts/AccountContext";
import { ShieldCheck, Eye, EyeOff, Building, Plus } from "lucide-react";

function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "XXXX";
  return `+${digits.slice(0, 2)} XXXXX ${digits.slice(-5)}`;
}

function maskId(val: string | null): string {
  if (!val) return "—";
  if (val.length <= 4) return "************";
  return `${"*".repeat(Math.max(0, val.length - 4))}${val.slice(-4)}`;
}

declare global {
  interface Window {
    FB?: {
      init: (opts: { appId: string; version: string; xfbml?: boolean }) => void;
      login: (
        cb: (resp: { authResponse?: { code?: string } }) => void,
        opts: {
          config_id: string;
          response_type: string;
          override_default_response_type?: boolean;
          scope: string;
          extras?: Record<string, unknown>;
        },
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

function loadFacebookSdk(): Promise<void> {
  if (window.FB) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => resolve();
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => reject(new Error("Facebook SDK failed to load"));
    document.head.appendChild(script);
    setTimeout(() => reject(new Error("Facebook SDK timed out")), 15000);
  });
}

export function SettingsPage() {
  const { tenant, user } = useAuth();
  const { refresh: refreshAccounts } = useAccounts();
  const [accounts, setAccounts] = useState<WhatsappAccount[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAccounts(asArray(await api<WhatsappAccount[] | { items: WhatsappAccount[] }>("/api/v1/whatsapp/accounts")));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load settings");
    }
  }, []);

  /** Embedded Signup: FB popup → code → backend exchange/subscribe/register. */
  const connectWhatsapp = useCallback(async () => {
    setConnecting(true);
    setError(null);
    setNotice(null);
    try {
      const cfg = await api<{ appId: string; configId: string; graphVersion: string }>(
        "/api/v1/whatsapp/onboarding/config",
      );
      if (!cfg.appId || !cfg.configId) {
        throw new Error("Embedded Signup is not configured (META_APP_ID / META_CONFIG_ID missing on server)");
      }
      await loadFacebookSdk();
      window.FB!.init({ appId: cfg.appId, version: cfg.graphVersion || "v21.0", xfbml: false });
      const code = await new Promise<string>((resolve, reject) => {
        window.FB!.login(
          (resp) => {
            if (resp.authResponse?.code) resolve(resp.authResponse.code);
            else reject(new Error("Signup was cancelled or no code returned"));
          },
          {
            config_id: cfg.configId,
            response_type: "code",
            override_default_response_type: true,
            scope: "whatsapp_business_management,whatsapp_business_messaging",
            extras: { feature: "whatsapp_embedded_signup", version: 2 },
          },
        );
      });
      const result = await api<{ accounts: WhatsappAccount[] }>(`/api/v1/whatsapp/onboarding/complete`, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      await Promise.all([load(), refreshAccounts()]);
      setNotice(`Connected ${result.accounts.length} number(s). They now appear in the top-bar switcher.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Connect failed");
    } finally {
      setConnecting(false);
    }
  }, [load, refreshAccounts]);

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
    <div className="page page-wide">
      <header className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
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
              Enterprise Config
            </span>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>•</span>
            <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>
              Cloud API v21.0
            </span>
          </div>
          <h1>System & API Settings</h1>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            Manage your Meta WhatsApp Business Accounts, Cloud API endpoints, and webhook security.
          </p>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {notice && (
        <div style={{ background: "#e6f7f3", color: "#047857", padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.875rem", fontWeight: 600 }}>
          {notice}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Connected WhatsApp Account Card */}
        <section className="card" style={{ gridColumn: "1 / -1", marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h2>
              <ShieldCheck size={20} color="#00a884" />
              <span>Connected WhatsApp Business Accounts</span>
            </h2>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span className="badge badge-approved">Official Cloud API</span>
              <button
                className="primary-btn"
                style={{ fontSize: "0.8rem", padding: "0.45rem 0.9rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                onClick={() => void connectWhatsapp()}
                disabled={connecting}
                title="Connect another number via Facebook Embedded Signup"
              >
                <Plus size={15} />
                <span>{connecting ? "Connecting…" : accounts.length === 0 ? "Connect WhatsApp" : "Connect another number"}</span>
              </button>
            </div>
          </div>

          {accounts.length === 0 && !error && <div className="muted">Loading accounts…</div>}
          {accounts.length === 0 && !error ? null : accounts.length === 0 ? (
            <div className="muted">No WhatsApp number connected yet.</div>
          ) : (
            accounts.map((a) => {
              const show = revealed.has(a.id);
              const connected = a.status === "ACTIVE";

              return (
                <div
                  key={a.id}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "1.25rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "1.125rem", color: "#0f172a" }}>
                          {a.businessName || tenant?.name || "WhatsApp Business Account"}
                        </span>
                        <span className={`badge badge-${connected ? "approved" : "rejected"}`}>
                          {connected ? "● Connected" : "● Offline"}
                        </span>
                      </div>
                      <div className="muted small" style={{ marginTop: "0.2rem" }}>
                        Registered Meta WhatsApp Business API Account
                      </div>
                    </div>

                    <button
                      className="secondary-btn"
                      style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem" }}
                      onClick={() => toggleReveal(a.id)}
                    >
                      {show ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>{show ? "Mask Credentials" : "Reveal Credentials"}</span>
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "1rem",
                      background: "#ffffff",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "10px",
                      padding: "1rem",
                    }}
                  >
                    <div>
                      <div className="muted tiny" style={{ textTransform: "uppercase", fontWeight: 700 }}>
                        Display Phone Number
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "#0f172a", marginTop: "0.25rem" }}>
                        {show ? (a.displayPhoneNumber || "—") : maskPhone(a.displayPhoneNumber)}
                      </div>
                    </div>

                    <div>
                      <div className="muted tiny" style={{ textTransform: "uppercase", fontWeight: 700 }}>
                        Phone Number ID
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "#475569", marginTop: "0.25rem" }}>
                        {show ? a.phoneNumberId : maskId(a.phoneNumberId)}
                      </div>
                    </div>

                    <div>
                      <div className="muted tiny" style={{ textTransform: "uppercase", fontWeight: 700 }}>
                        WABA Account ID
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "#475569", marginTop: "0.25rem" }}>
                        {show ? a.wabaId : maskId(a.wabaId)}
                      </div>
                    </div>

                    <div>
                      <div className="muted tiny" style={{ textTransform: "uppercase", fontWeight: 700 }}>
                        Account Status
                      </div>
                      <div style={{ fontWeight: 600, color: a.status === "ACTIVE" ? "#16a34a" : "#00a884", marginTop: "0.25rem" }}>
                        {a.status || "ACTIVE"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Workspace & Org Profile Card */}
        <section className="card" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2>
              <Building size={18} color="#00a884" />
              <span>Workspace & Security</span>
            </h2>
            <span className="badge badge-approved">Active</span>
          </div>

          <p className="muted small" style={{ margin: "0 0 1rem" }}>
            Workspace profile details and current authentication credentials.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
              <span className="muted small">Workspace Name</span>
              <strong style={{ fontSize: "0.875rem" }}>{tenant?.name || "Workspace"}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
              <span className="muted small">Admin Account</span>
              <span style={{ fontSize: "0.875rem", color: "#334155" }}>{user?.email || "—"}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
              <span className="muted small">Data Encryption</span>
              <span style={{ fontSize: "0.875rem", color: "#16a34a", fontWeight: 600 }}>AES-256 GCM</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0" }}>
              <span className="muted small">Connected API Endpoint</span>
              <span className="mono" style={{ fontSize: "0.8125rem", color: "#00a884", fontWeight: 600 }}>{API_URL}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
