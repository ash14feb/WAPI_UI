import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ButtonSpinner } from "../components/Loader";

const card: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginTop: 16, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" };
const btn: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid #CDDAD7", background: "var(--text)", color: "#fff", cursor: "pointer" };
const btnGhost: React.CSSProperties = { ...btn, background: "#fff", color: "var(--text)" };
const input: React.CSSProperties = { padding: 9, borderRadius: 8, border: "1px solid #CDDAD7", fontSize: 14 };
const pill = (ok: boolean): React.CSSProperties => ({ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: ok ? "var(--success-bg)" : "var(--danger-bg)", color: ok ? "var(--success)" : "var(--danger)", border: `1px solid ${ok ? "#7FD9B9" : "var(--danger-border)"}` });

function shortMid(t: string): string {
  if (t.startsWith("seen ")) return `seen ${t.slice(5, 5 + 12)}…`;
  return t.length > 60 ? `${t.slice(0, 60)}…` : t;
}

export function IntegrationsPage() {
  const [params, setParams] = useSearchParams();
  const shopifyResult = params.get("shopify");
  const shopParam = params.get("shop");
  const [status, setStatus] = useState<{ connected: boolean; shop: string | null; configured: boolean } | null>(null);
  const [shop, setShop] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<{ eventType: string; externalEventId: string; processingStatus: string; errorMessage: string | null; receivedAt: string }[]>([]);

  async function load() {
    try {
      const data = await api<{ connected: boolean; shop: string | null; configured: boolean }>("/api/v1/integrations/shopify/status");
      setStatus(data ?? null);
      try {
        const ev = await api<{ events: typeof events }>("/api/v1/integrations/shopify/events");
        setEvents(ev.events ?? []);
      } catch { /* events optional */ }
    } catch { setMsg("Could not reach API — please log in again"); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (shopifyResult) {
      const t = setTimeout(() => { params.delete("shopify"); params.delete("shop"); setParams(params, { replace: true }); }, 8000);
      return () => clearTimeout(t);
    }
  }, [shopifyResult]);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const data = await api<{ installUrl: string }>("/api/v1/integrations/shopify/connect", {
        method: "POST", body: JSON.stringify({ shop }),
      });
      window.location.href = data.installUrl;
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Connect failed");
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try { await api("/api/v1/integrations/shopify/disconnect", { method: "DELETE" }); } catch { /* ignore */ }
    setBusy(false); void load();
  }

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto", height: "100%", overflowY: "auto", paddingBottom: 48 }}>
      <h1 style={{ marginBottom: 4 }}>Integrations</h1>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>Connect stores and channels to this workspace.</p>
      {shopifyResult === "connected" && (
        <div style={{ background: "var(--success-bg)", border: "1px solid #7FD9B9", color: "var(--success)", borderRadius: 10, padding: "12px 16px", marginTop: 12 }}>
          ✅ Connected to <strong>{shopParam ?? status?.shop ?? "your store"}</strong> — order notifications are active.
        </div>
      )}
      {shopifyResult === "error" && (
        <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", color: "var(--danger)", borderRadius: 10, padding: "12px 16px", marginTop: 12 }}>
          ❌ Shopify connection failed — please try Connect again.
        </div>
      )}
      <section style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>🛍️ Shopify</h2>
          {status && <span style={pill(status.connected)}>● {status.connected ? "Connected" : "Not connected"}</span>}
        </div>
        <p style={{ color: "var(--text-muted)" }}>Order, shipping and abandoned-checkout WhatsApp messages.</p>
        {!status?.configured && <p style={{ color: "var(--warning)" }}>Backend missing SHOPIFY_API_KEY — set it in API .env first.</p>}
        {status?.connected ? (
          <div>
            <p>Connected: <strong>{status.shop}</strong></p>
            <button onClick={disconnect} disabled={busy}>{busy && <ButtonSpinner />}{busy ? "Working…" : "Disconnect"}</button>
          </div>
        ) : (
          <form onSubmit={connect} style={{ display: "flex", gap: 8 }}>
            <input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="your-store.myshopify.com" style={{ flex: 1, padding: 8 }} />
            <button type="submit" disabled={busy || !shop}>{busy && <ButtonSpinner />}{busy ? "Connecting…" : "Connect"}</button>
          </form>
        )}
        {msg && <p>{msg}</p>}
        <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ margin: 0 }}>Recent Shopify events</h3>
              <button onClick={() => void load()} disabled={busy}>{busy && <ButtonSpinner />}{busy ? "Loading…" : "Refresh"}</button>
            </div>
          {events.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No webhooks received yet — hit Send test in Shopify, then Refresh.</p>
          ) : (
            <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--bg-subtle)", borderRadius: 10, marginTop: 8 }}>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, background: "var(--bg-subtle)" }}><tr style={{ textAlign: "left", color: "var(--text-muted)" }}><th style={{ padding: 8 }}>Time</th><th style={{ padding: 8 }}>Topic</th><th style={{ padding: 8 }}>Status</th><th style={{ padding: 8 }}>Detail</th></tr></thead>
                <tbody>
                  {events.map((e) => {
                    const ok = e.processingStatus === "PROCESSED";
                    return (
                      <tr key={e.externalEventId} style={{ borderTop: "1px solid var(--bg-subtle)" }}>
                        <td style={{ padding: 8, whiteSpace: "nowrap" }}>{new Date(e.receivedAt).toLocaleString()}</td>
                        <td style={{ padding: 8 }}><code>{e.eventType.replace("shopify:", "")}</code></td>
                        <td style={{ padding: 8 }}><span style={pill(ok)}>{e.processingStatus}</span></td>
                        <td style={{ padding: 8, color: "var(--text-muted)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.errorMessage ?? e.externalEventId}>{e.errorMessage ?? e.externalEventId}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      <section style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>📸 Instagram</h2>
          <span style={pill(true)}>● Webhook live</span>
        </div>
        <p style={{ color: "var(--text-muted)" }}>DMs arrive as events below. Click any sender ID to load it into the reply box.</p>
        <InstagramCard />
      </section>
    </div>
  );
}

function InstagramCard() {
  const [events, setEvents] = useState<{ senderId: string; text: string; receivedAt: string }[]>([]);
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  async function load() {
    setLoading(true);
    try {
      const d = await api<{ events: typeof events }>("/api/v1/integrations/instagram/events");
      setEvents(d.events ?? []);
    } catch { setMsg("Load failed — log in again"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function send(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); setSending(true);
    try {
      await api("/api/v1/integrations/instagram/send", { method: "POST", body: JSON.stringify({ to, text }) });
      setMsg("Sent ✓"); setText("");
    } catch (err) { setMsg(err instanceof Error ? err.message : "Send failed"); }
    finally { setSending(false); }
  }
  async function copy(id: string) {
    try { await navigator.clipboard.writeText(id); setMsg(`Copied ${id}`); } catch { setTo(id); }
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Recent DMs</h3>
        <button onClick={() => void load()} disabled={loading}>{loading && <ButtonSpinner />}{loading ? "Loading…" : "Refresh"}</button>
        <span style={{ color: "var(--text-subtle)", fontSize: 12 }}>{events.length} events</span>
      </div>
      {events.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No DMs yet — DM your Business account, then Refresh.</p>
      ) : (
        <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--bg-subtle)", borderRadius: 10, marginTop: 8 }}>
          {events.map((e, i) => {
            const isRead = e.text.startsWith("seen ");
            return (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "8px 12px", borderTop: i ? "1px solid var(--bg-subtle)" : "none", fontSize: 13 }}>
                <button title="Use as reply recipient" onClick={() => setTo(e.senderId)} style={{ ...btnGhost, padding: "2px 8px", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{e.senderId}</button>
                <span style={{ flex: 1, color: isRead ? "var(--text-subtle)" : "var(--text)" }}>{isRead ? "👁 " + shortMid(e.text) : e.text || "(no text — receipt)"}</span>
                <span style={{ color: "var(--text-subtle)", fontSize: 12, whiteSpace: "nowrap" }}>{new Date(e.receivedAt).toLocaleString()}</span>
                <button title="Copy ID" onClick={() => void copy(e.senderId)} style={{ ...btnGhost, padding: "2px 8px", fontSize: 12 }}>⧉</button>
              </div>
            );
          })}
        </div>
      )}
      <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Click a sender ID above ↑" title="IG-scoped user ID of the DM sender — click any sender chip above to fill" style={{ ...input, width: 200, fontFamily: "monospace" }} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply text" style={{ ...input, flex: 1 }} />
        <button style={btn} type="submit" disabled={!to || !text || sending}>{sending && <ButtonSpinner />}{sending ? "Sending…" : "Send"}</button>
      </form>
      <p style={{ color: "var(--text-subtle)", fontSize: 12 }}>IG user ID = the number chip on each log row (the DM sender). Click it to fill this box, then Send.</p>
      {msg && <p>{msg}</p>}
    </div>
  );
}
