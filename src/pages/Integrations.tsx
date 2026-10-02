import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";

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
      if (data?.connected) {
        try {
          const ev = await api<{ events: typeof events }>("/api/v1/integrations/shopify/events");
          setEvents(ev.events ?? []);
        } catch { /* events optional */ }
      }
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
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1>Integrations</h1>
      {shopifyResult === "connected" && (
        <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", color: "#065f46", borderRadius: 10, padding: "12px 16px", marginTop: 12 }}>
          ✅ Connected to <strong>{shopParam ?? status?.shop ?? "your store"}</strong> — order notifications are active.
        </div>
      )}
      {shopifyResult === "error" && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", borderRadius: 10, padding: "12px 16px", marginTop: 12 }}>
          ❌ Shopify connection failed — please try Connect again.
        </div>
      )}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginTop: 16 }}>
        <h2 style={{ margin: 0 }}>Shopify</h2>
        <p style={{ color: "#6b7280" }}>Connect your store to send order, shipping and abandoned-checkout WhatsApp messages.</p>
        {!status?.configured && <p style={{ color: "#b45309" }}>Backend missing SHOPIFY_API_KEY — set it in API .env first.</p>}
        {status?.connected ? (
          <div>
            <p>Connected: <strong>{status.shop}</strong></p>
            <button onClick={disconnect} disabled={busy}>Disconnect</button>
          </div>
        ) : (
          <form onSubmit={connect} style={{ display: "flex", gap: 8 }}>
            <input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="your-store.myshopify.com" style={{ flex: 1, padding: 8 }} />
            <button type="submit" disabled={busy || !shop}>Connect</button>
          </form>
        )}
        {msg && <p>{msg}</p>}
        <ul style={{ color: "#6b7280", fontSize: 14 }}>
          <li>orders/create → order_confirm template</li>
          <li>orders/fulfilled → shipment_update template</li>
          <li>checkouts/create|update → abandoned_checkout template</li>
        </ul>
        {status?.connected && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ margin: 0 }}>Recent Shopify events</h3>
              <button onClick={() => void load()} disabled={busy}>Refresh</button>
            </div>
            {events.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: 14 }}>No webhooks received yet — hit Send test in Shopify, then Refresh.</p>
            ) : (
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginTop: 8 }}>
                <thead><tr style={{ textAlign: "left", color: "#6b7280" }}><th>Time</th><th>Topic</th><th>Status</th><th>Detail</th></tr></thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.externalEventId} style={{ borderTop: "1px solid #eee" }}>
                      <td>{new Date(e.receivedAt).toLocaleString()}</td>
                      <td>{e.eventType.replace("shopify:", "")}</td>
                      <td>{e.processingStatus}</td>
                      <td style={{ color: "#6b7280" }}>{e.errorMessage ?? e.externalEventId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginTop: 16 }}>
        <h2 style={{ margin: 0 }}>Instagram</h2>
        <p style={{ color: "#6b7280" }}>Receive DMs as webhook events, reply from the API. Meta → App → Webhooks → Instagram → Subscribe to <code>messages</code>.</p>
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
  async function load() {
    try {
      const d = await api<{ events: typeof events }>("/api/v1/integrations/instagram/events");
      setEvents(d.events ?? []);
    } catch { setMsg("Load failed — log in again"); }
  }
  useEffect(() => { void load(); }, []);
  async function send(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    try {
      await api("/api/v1/integrations/instagram/send", { method: "POST", body: JSON.stringify({ to, text }) });
      setMsg("Sent"); setText("");
    } catch (err) { setMsg(err instanceof Error ? err.message : "Send failed"); }
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Recent DMs</h3>
        <button onClick={() => void load()}>Refresh</button>
      </div>
      {events.length === 0 ? (
        <p style={{ color: "#6b7280", fontSize: 14 }}>No DMs yet — DM your Business account, then Refresh.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {events.map((e, i) => (
            <li key={i}><strong>{e.senderId}</strong>: {e.text} <span style={{ color: "#9ca3af" }}>({new Date(e.receivedAt).toLocaleString()})</span></li>
          ))}
        </ul>
      )}
      <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="IG user ID" style={{ width: 160, padding: 8 }} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply text" style={{ flex: 1, padding: 8 }} />
        <button type="submit" disabled={!to || !text}>Send</button>
      </form>
      {msg && <p>{msg}</p>}
    </div>
  );
}
