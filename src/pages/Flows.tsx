import { useEffect, useState } from "react";
import { api } from "../api/client";

interface FlowField { kind: string; label: string; name: string; required?: boolean; placeholder?: string; options?: string[]; }
interface FlowScreen { id: string; title: string; fields: FlowField[]; }
interface Flow { id: string; name: string; status: string; metaFlowId: string | null; categories: string | null; flowJson: string; version: number; updatedAt: string; }
interface FlowResponse { id: string; phone: string; responseJson: string; receivedAt: string; }

const KINDS = ["text", "textarea", "number", "email", "dropdown", "checkbox", "radio", "date"];
const card: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 14, padding: 20, marginTop: 16, background: "#fff" };
const btn: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#111827", color: "#fff", cursor: "pointer" };
const btnGhost: React.CSSProperties = { ...btn, background: "#fff", color: "#111827" };
const input: React.CSSProperties = { padding: 8, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 };
const pill = (s: string): React.CSSProperties => {
  const ok = s === "PUBLISHED";
  return { display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: ok ? "#ecfdf5" : "#f3f4f6", color: ok ? "#065f46" : "#374151", border: `1px solid ${ok ? "#6ee7b7" : "#d1d5db"}` };
};

function emptyScreen(n: number): FlowScreen { return { id: `SCREEN_${n}`, title: `Step ${n}`, fields: [] }; }
function emptyField(): FlowField { return { kind: "text", label: "", name: "", required: false, options: [] }; }

function prettyAnswers(json: string): string {
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    return Object.entries(o).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join("  |  ");
  } catch { return json.slice(0, 200); }
}

export function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editing, setEditing] = useState<Flow | null>(null);
  const [name, setName] = useState("");
  const [screens, setScreens] = useState<FlowScreen[]>([emptyScreen(1)]);
  const [sendFor, setSendFor] = useState<Flow | null>(null);
  const [respFor, setRespFor] = useState<Flow | null>(null);
  const [responses, setResponses] = useState<FlowResponse[]>([]);

  async function load() {
    try {
      const d = await api<{ flows: Flow[] }>("/api/v1/flows");
      setFlows(d.flows ?? []);
    } catch { setMsg("Could not load flows — log in again"); }
  }
  useEffect(() => { void load(); }, []);

  function openNew() {
    setEditing(null); setName(""); setScreens([emptyScreen(1)]); setShowBuilder(true);
  }
  function openEdit(f: Flow) {
    setEditing(f); setName(f.name);
    try {
      const j = JSON.parse(f.flowJson) as { screens?: { id?: string; title?: string }[] };
      const list = (j.screens ?? []).filter((s) => s.id !== "COMPLETE");
      setScreens(list.length ? list.map((s) => ({ id: s.id ?? "S1", title: s.title ?? s.id ?? "Step", fields: [] })) : [emptyScreen(1)]);
    } catch { setScreens([emptyScreen(1)]); }
    setShowBuilder(true);
    setMsg("Editing reloads structure only for drafts — field details must be re-entered.");
  }

  async function save() {
    if (!name.trim()) { setMsg("Name required"); return; }
    setBusy(true); setMsg("");
    try {
      if (editing) {
        await api(`/api/v1/flows/${editing.id}`, { method: "PUT", body: JSON.stringify({ name, screens }) });
      } else {
        await api("/api/v1/flows", { method: "POST", body: JSON.stringify({ name, categories: ["OTHER"], screens }) });
      }
      setShowBuilder(false); void load();
    } catch (err) { setMsg(err instanceof Error ? err.message : "Save failed"); }
    setBusy(false);
  }

  async function publish(f: Flow) {
    setBusy(true); setMsg("");
    try {
      await api(`/api/v1/flows/${f.id}/publish`, { method: "POST", body: JSON.stringify({}) });
      setMsg(`Published ${f.name} to Meta`); void load();
    } catch (err) { setMsg(err instanceof Error ? err.message : "Publish failed"); }
    setBusy(false);
  }

  async function sync() {
    setBusy(true); setMsg("");
    try {
      const d = await api<{ synced: number }>("/api/v1/flows/sync", { method: "POST", body: JSON.stringify({}) });
      setMsg(`Synced ${d.synced} flows from Meta`); void load();
    } catch (err) { setMsg(err instanceof Error ? err.message : "Sync failed"); }
    setBusy(false);
  }

  async function remove(f: Flow) {
    if (!confirm(`Delete draft ${f.name}?`)) return;
    try { await api(`/api/v1/flows/${f.id}`, { method: "DELETE" }); void load(); }
    catch (err) { setMsg(err instanceof Error ? err.message : "Delete failed"); }
  }

  async function loadResponses(f: Flow) {
    setRespFor(f);
    try {
      const d = await api<{ responses: FlowResponse[] }>(`/api/v1/flows/${f.id}/responses`);
      setResponses(d.responses ?? []);
    } catch { setResponses([]); }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", height: "100%", overflowY: "auto", paddingBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h1 style={{ margin: 0 }}>Flows</h1>
        <button style={btnGhost} onClick={() => void sync()} disabled={busy}>Sync from Meta</button>
        <button style={btn} onClick={openNew}>+ New flow</button>
      </div>
      <p style={{ color: "#6b7280" }}>Static form flows — build screens, publish to Meta, send as interactive messages. Like Templates, Meta is the store of record.</p>
      {msg && <p>{msg}</p>}
      {flows.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No flows yet — create one or Sync from Meta.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {flows.map((f) => (
            <div key={f.id} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong>{f.name}</strong>
                <span style={pill(f.status)}>{f.status}</span>
                <span style={{ color: "#9ca3af", fontSize: 12 }}>v{f.version}{f.metaFlowId ? ` · Meta ${f.metaFlowId}` : " · local only"}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {f.status === "DRAFT" && <><button style={btnGhost} onClick={() => openEdit(f)}>Edit</button><button style={btn} onClick={() => void publish(f)} disabled={busy}>Publish to Meta</button><button style={btnGhost} onClick={() => void remove(f)}>Delete</button></>}
                {f.status === "PUBLISHED" && <><button style={btn} onClick={() => setSendFor(f)}>Send</button><button style={btnGhost} onClick={() => void loadResponses(f)}>Responses</button></>}
              </div>
              {respFor?.id === f.id && (
                <div style={{ marginTop: 10 }}>
                  <h4 style={{ margin: "4px 0" }}>Responses ({responses.length})</h4>
                  {responses.length === 0 ? <p style={{ color: "#6b7280", fontSize: 13 }}>No answers yet.</p> : (
                    <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #f3f4f6", borderRadius: 8 }}>
                      {responses.map((r) => (
                        <div key={r.id} style={{ padding: "6px 10px", borderTop: "1px solid #f3f4f6", fontSize: 13 }}>
                          <strong>{r.phone}</strong> — {prettyAnswers(r.responseJson)} <span style={{ color: "#9ca3af" }}>({new Date(r.receivedAt).toLocaleString()})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showBuilder && (
        <div style={{ ...card, borderColor: "#111827" }}>
          <h3 style={{ marginTop: 0 }}>{editing ? `Edit draft: ${editing.name}` : "New flow"}</h3>
          <label>Name<br /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="cod_confirm_form" style={{ ...input, width: 320 }} /></label>
          {screens.map((s, si) => (
            <div key={si} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginTop: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={s.id} onChange={(e) => { const c = [...screens]; c[si] = { ...s, id: e.target.value }; setScreens(c); }} placeholder="SCREEN_ID" style={{ ...input, width: 160, fontFamily: "monospace" }} />
                <input value={s.title} onChange={(e) => { const c = [...screens]; c[si] = { ...s, title: e.target.value }; setScreens(c); }} placeholder="Step title" style={{ ...input, flex: 1 }} />
                <button style={btnGhost} onClick={() => setScreens(screens.filter((_, i) => i !== si))} disabled={screens.length <= 1}>✕</button>
              </div>
              {s.fields.map((f, fi) => (
                <div key={fi} style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={f.kind} onChange={(e) => { const c = [...screens]; const fl = [...s.fields]; fl[fi] = { ...f, kind: e.target.value }; c[si] = { ...s, fields: fl }; setScreens(c); }} style={input}>
                    {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <input value={f.label} onChange={(e) => { const c = [...screens]; const fl = [...s.fields]; fl[fi] = { ...f, label: e.target.value }; c[si] = { ...s, fields: fl }; setScreens(c); }} placeholder="Label" style={{ ...input, width: 160 }} />
                  <input value={f.name} onChange={(e) => { const c = [...screens]; const fl = [...s.fields]; fl[fi] = { ...f, name: e.target.value }; c[si] = { ...s, fields: fl }; setScreens(c); }} placeholder="field_name" style={{ ...input, width: 140, fontFamily: "monospace" }} />
                  <label style={{ fontSize: 13 }}><input type="checkbox" checked={!!f.required} onChange={(e) => { const c = [...screens]; const fl = [...s.fields]; fl[fi] = { ...f, required: e.target.checked }; c[si] = { ...s, fields: fl }; setScreens(c); }} /> req</label>
                  {(f.kind === "dropdown" || f.kind === "checkbox" || f.kind === "radio") && (
                    <input value={(f.options ?? []).join(", ")} onChange={(e) => { const c = [...screens]; const fl = [...s.fields]; fl[fi] = { ...f, options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }; c[si] = { ...s, fields: fl }; setScreens(c); }} placeholder="Option1, Option2" style={{ ...input, flex: 1 }} />
                  )}
                  <button style={btnGhost} onClick={() => { const c = [...screens]; c[si] = { ...s, fields: s.fields.filter((_, i) => i !== fi) }; setScreens(c); }}>✕</button>
                </div>
              ))}
              <button style={{ ...btnGhost, marginTop: 8 }} onClick={() => { const c = [...screens]; c[si] = { ...s, fields: [...s.fields, emptyField()] }; setScreens(c); }}>+ Field</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button style={btnGhost} onClick={() => setScreens([...screens, emptyScreen(screens.length + 1)])} disabled={screens.length >= 10}>+ Screen</button>
            <button style={btn} onClick={() => void save()} disabled={busy}>Save draft</button>
            <button style={btnGhost} onClick={() => setShowBuilder(false)}>Cancel</button>
          </div>
        </div>
      )}

      {sendFor && <SendFlowModal flow={sendFor} onClose={() => setSendFor(null)} />}
    </div>
  );
}

function SendFlowModal({ flow, onClose }: { flow: Flow; onClose: () => void }) {
  const [to, setTo] = useState("");
  const [cta, setCta] = useState("Open form");
  const [bodyText, setBodyText] = useState(`Hi! Please fill this form: ${flow.name}`);
  const [msg, setMsg] = useState("");
  async function send(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    try {
      await api(`/api/v1/flows/${flow.id}/send`, { method: "POST", body: JSON.stringify({ to, cta, bodyText }) });
      setMsg("Sent ✓"); 
    } catch (err) { setMsg(err instanceof Error ? err.message : "Send failed"); }
  }
  return (
    <div style={{ ...card, borderColor: "#111827" }}>
      <h3 style={{ marginTop: 0 }}>Send {flow.name}</h3>
      <form onSubmit={send} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+91..." style={{ ...input, width: 170 }} />
        <input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Button label" style={{ ...input, width: 140 }} />
        <input value={bodyText} onChange={(e) => setBodyText(e.target.value)} placeholder="Message text" style={{ ...input, flex: 1, minWidth: 220 }} />
        <button style={btn} type="submit" disabled={!to || !bodyText}>Send</button>
        <button style={btnGhost} type="button" onClick={onClose}>Close</button>
      </form>
      {msg && <p>{msg}</p>}
    </div>
  );
}
