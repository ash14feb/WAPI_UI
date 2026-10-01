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

  async function load() {
    try {
      const data = await api<{ connected: boolean; shop: string | null; configured: boolean }>("/api/v1/integrations/shopify/status");
      setStatus(data ?? null);
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
      </section>
    </div>
  );
}
