import { useEffect, useState } from "react";
import { api } from "../api/client";

export function IntegrationsPage() {
  const [status, setStatus] = useState<{ connected: boolean; shop: string | null; configured: boolean } | null>(null);
  const [shop, setShop] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api<{ connected: boolean; shop: string | null; configured: boolean }>("/api/v1/integrations/shopify/status");
      setStatus(data ?? null);
    } catch { setMsg("Could not reach API — please log in again"); }
  }
  useEffect(() => { void load(); }, []);

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
      </section>
    </div>
  );
}
