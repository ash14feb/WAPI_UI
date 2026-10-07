import { useEffect, useState } from "react";
import { api } from "../api/client";
import { ButtonSpinner, PageLoader } from "../components/Loader";

interface FlowField { kind: string; label: string; name: string; required?: boolean; placeholder?: string; options?: string[]; }
interface FlowScreen { id: string; title: string; fields: FlowField[]; }
interface Flow { id: string; name: string; status: string; metaFlowId: string | null; categories: string | null; flowJson: string; version: number; updatedAt: string; }
interface FlowResponse { id: string; phone: string; responseJson: string; receivedAt: string; }

const card: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 14, padding: 20, marginTop: 16, background: "#fff" };
const btn: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#111827", color: "#fff", cursor: "pointer" };
const btnGhost: React.CSSProperties = { ...btn, background: "#fff", color: "#111827" };
const input: React.CSSProperties = { padding: 8, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 };
const pill = (s: string): React.CSSProperties => {
  const ok = s === "PUBLISHED";
  return { display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: ok ? "#ecfdf5" : "#f3f4f6", color: ok ? "#065f46" : "#374151", border: `1px solid ${ok ? "#6ee7b7" : "#d1d5db"}` };
};

function seqLetters(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
function emptyScreen(n: number): FlowScreen { return { id: `SCREEN_${seqLetters(n - 1)}`, title: `Step ${n}`, fields: [] }; }
function emptyField(kind = "text"): FlowField {
  const labelMap: Record<string, string> = { text: "Your answer", textarea: "Details", number: "Quantity", email: "Email address", dropdown: "Choose an option", checkbox: "Select all that apply", radio: "Pick one", date: "Preferred date" };
  const nameMap: Record<string, string> = { text: "answer", textarea: "details", number: "quantity", email: "email", dropdown: "choice", checkbox: "choices", radio: "choice", date: "date" };
  const needsOptions = kind === "dropdown" || kind === "checkbox" || kind === "radio";
  const suffix = seqLetters(Math.floor(Math.random() * 26)).toLowerCase() + seqLetters(Math.floor(Math.random() * 26)).toLowerCase();
  return { kind, label: labelMap[kind] ?? "Question", name: `${nameMap[kind] ?? "field"}_${suffix}`, required: false, options: needsOptions ? ["Option 1", "Option 2"] : [] };
}
/** Rewrites digits to letters so old drafts (SCREEN_1, answer_123) pass Meta. */
function autoFixIds(screens: FlowScreen[]): FlowScreen[] {
  const usedScreens = new Set<string>();
  return screens.map((s, i) => {
    let id = s.id.replace(/[0-9]/g, (d) => seqLetters(Number(d)));
    if (!/^[A-Za-z]/.test(id)) id = `SCREEN_${id}`;
    if (usedScreens.has(id)) id = `${id}_${seqLetters(i)}`;
    usedScreens.add(id);
    const usedNames = new Set<string>();
    return {
      ...s,
      id,
      fields: s.fields.map((f) => {
        let nm = f.name.replace(/[0-9]/g, (d) => seqLetters(Number(d)).toLowerCase());
        if (!/^[A-Za-z]/.test(nm)) nm = `field_${nm}`;
        if (usedNames.has(nm)) nm = `${nm}_${seqLetters(usedNames.size).toLowerCase()}`;
        usedNames.add(nm);
        return { ...f, name: nm };
      }),
    };
  });
}

const PALETTE: { kind: string; icon: string; label: string; hint: string }[] = [
  { kind: "text", icon: "⌨", label: "Text input", hint: "Short answer" },
  { kind: "textarea", icon: "📝", label: "Long text", hint: "Paragraph" },
  { kind: "number", icon: "🔢", label: "Number", hint: "Numeric" },
  { kind: "email", icon: "✉", label: "Email", hint: "Email address" },
  { kind: "dropdown", icon: "▾", label: "Dropdown", hint: "Pick one" },
  { kind: "checkbox", icon: "☑", label: "Checkboxes", hint: "Pick many" },
  { kind: "radio", icon: "🔘", label: "Radio", hint: "Pick one" },
  { kind: "date", icon: "📅", label: "Date", hint: "Date picker" },
];

function paletteLabel(kind: string): string {
  return PALETTE.find((p) => p.kind === kind)?.label ?? kind;
}

function PhonePreview({ screen, flowName }: { screen: FlowScreen | undefined; flowName: string }) {
  if (!screen) return <div style={{ color: "#9ca3af", fontSize: 13 }}>Select a screen to preview</div>;
  return (
    <div style={{ width: 250, borderRadius: 28, border: "8px solid #111827", background: "#e7ffdb", padding: "14px 10px", boxShadow: "0 8px 24px rgba(0,0,0,.15)" }}>
      <div style={{ fontSize: 11, color: "#667781", textAlign: "center", marginBottom: 6 }}>WHATSAPP · {flowName || "flow"}</div>
      <div style={{ background: "#fff", borderRadius: 10, padding: 10, boxShadow: "0 1px 1px rgba(0,0,0,.1)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{screen.title || "Untitled step"}</div>
        {screen.fields.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af" }}>Drop fields here…</div>}
        {screen.fields.map((f, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{f.label || "Untitled"}{f.required ? " *" : ""}</div>
            {(f.kind === "dropdown" || f.kind === "checkbox" || f.kind === "radio") ? (
              <div style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "#6b7280" }}>
                {(f.options ?? []).slice(0, 3).join(" · ") || "options…"}
              </div>
            ) : f.kind === "date" ? (
              <div style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "#6b7280" }}>📅 dd/mm/yyyy</div>
            ) : (
              <div style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "#9ca3af" }}>{f.placeholder || "Type answer…"}</div>
            )}
          </div>
        ))}
        <div style={{ background: "#00a884", color: "#fff", textAlign: "center", borderRadius: 8, padding: 7, fontSize: 13, fontWeight: 700, marginTop: 4 }}>Continue →</div>
      </div>
    </div>
  );
}

function prettyAnswers(json: string): string {
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    const parts = Object.entries(o)
      .filter(([k]) => k !== "flow_token")
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
    return parts.length > 0 ? parts.join("  |  ") : "(no answers — form data missing)";
  } catch { return json.slice(0, 200); }
}

const ID_RE = /^[A-Za-z][A-Za-z_]{0,63}$/;
const ID_HINT = "must start with a letter, alphabets and underscores only (no numbers — Meta rejects digits)";

/** UI-level validation mirroring Meta + backend rules — blocks save with messages. */
export function validateBuilder(name: string, screens: FlowScreen[]): string[] {
  const errors: string[] = [];
  if (!name.trim()) errors.push("Flow name is required");
  else if (!/^[a-z0-9_]{1,100}$/.test(name)) errors.push('Flow name must be lowercase letters, numbers, underscores only (e.g. cod_confirm_form) — Meta rejects spaces/capitals with "Invalid parameter"');
  if (screens.length === 0 || screens.length > 10) errors.push("Flow needs 1–10 screens");
  const screenIds = new Set<string>();
  screens.forEach((s, i) => {
    const label = `Screen ${i + 1}`;
    if (!ID_RE.test(s.id)) errors.push(`${label}: id "${s.id}" ${ID_HINT}`);
    else if (screenIds.has(s.id)) errors.push(`${label}: duplicate screen id "${s.id}"`);
    else screenIds.add(s.id);
    if (!s.title.trim()) errors.push(`${label} (${s.id}): title is required`);
    if (s.fields.length > 20) errors.push(`${label} (${s.id}): max 20 fields`);
    const names = new Set<string>();
    s.fields.forEach((f, j) => {
      const fl = `${label} → field ${j + 1}`;
      if (!ID_RE.test(f.name)) errors.push(`${fl}: name "${f.name}" ${ID_HINT}`);
      else if (names.has(f.name)) errors.push(`${fl}: duplicate field name "${f.name}"`);
      else names.add(f.name);
      if (!f.label.trim()) errors.push(`${fl} (${f.name || "?"}): label is required`);
      if ((f.kind === "dropdown" || f.kind === "checkbox" || f.kind === "radio") && (!f.options || f.options.length === 0))
        errors.push(`${fl} (${f.name || "?"}): add at least one option`);
    });
  });
  return errors;
}

export function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [msg, setMsg] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editing, setEditing] = useState<Flow | null>(null);
  const [name, setName] = useState("");
  const [screens, setScreens] = useState<FlowScreen[]>([emptyScreen(1)]);
  const [sendFor, setSendFor] = useState<Flow | null>(null);
  const [respFor, setRespFor] = useState<Flow | null>(null);
  const [responses, setResponses] = useState<FlowResponse[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  async function load() {
    try {
      const d = await api<{ flows: Flow[] }>("/api/v1/flows");
      setFlows(d.flows ?? []);
    } catch { setMsg("Could not load flows — log in again"); }
    finally { setInitialLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const busy = busyAction !== null;
  async function runAction(key: string, fn: () => Promise<void>) {
    setBusyAction(key); setMsg("");
    try { await fn(); } catch (err) { setMsg(err instanceof Error ? err.message : "Action failed"); }
    finally { setBusyAction(null); }
  }

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
    const errs = validateBuilder(name, screens);
    setFormErrors(errs);
    if (errs.length > 0) { setMsg(`Fix ${errs.length} validation issue(s) below before saving`); return; }
    await runAction("save", async () => {
      if (editing) {
        await api(`/api/v1/flows/${editing.id}`, { method: "PUT", body: JSON.stringify({ name, screens }) });
      } else {
        await api("/api/v1/flows", { method: "POST", body: JSON.stringify({ name, categories: ["OTHER"], screens }) });
      }
      setShowBuilder(false); setFormErrors([]); await load();
    });
  }

  async function publish(f: Flow) {
    await runAction(`publish:${f.id}`, async () => {
      await api(`/api/v1/flows/${f.id}/publish`, { method: "POST", body: JSON.stringify({}) });
      setMsg(`Published ${f.name} to Meta`); await load();
    });
  }

  async function sync() {
    await runAction("sync", async () => {
      const d = await api<{ synced: number }>("/api/v1/flows/sync", { method: "POST", body: JSON.stringify({}) });
      setMsg(`Synced ${d.synced} flows from Meta`); await load();
    });
  }

  async function remove(f: Flow) {
    if (!confirm(`Delete draft ${f.name}?`)) return;
    await runAction(`delete:${f.id}`, async () => {
      await api(`/api/v1/flows/${f.id}`, { method: "DELETE" }); await load();
    });
  }

  async function loadResponses(f: Flow) {
    setRespFor(f);
    setResponses([]);
    await runAction(`responses:${f.id}`, async () => {
      const d = await api<{ responses: FlowResponse[] }>(`/api/v1/flows/${f.id}/responses`);
      setResponses(d.responses ?? []);
    });
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", height: "100%", overflowY: "auto", paddingBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h1 style={{ margin: 0 }}>Flows</h1>
        <button style={btnGhost} onClick={() => void sync()} disabled={busy}>{busyAction === "sync" && <ButtonSpinner />}Sync from Meta</button>
        <button style={btn} onClick={openNew}>+ New flow</button>
      </div>
      <p style={{ color: "#6b7280" }}>Static form flows — build screens, publish to Meta, send as interactive messages. Like Templates, Meta is the store of record.</p>
      {msg && <p>{msg}</p>}
      {initialLoading ? (
        <PageLoader message="Loading flows…" description="Fetching your drafts and published flows." />
      ) : flows.length === 0 ? (
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
                {f.status === "DRAFT" && <><button style={btnGhost} onClick={() => openEdit(f)} disabled={busy}>Edit</button><button style={btn} onClick={() => void publish(f)} disabled={busy}>{busyAction === `publish:${f.id}` && <ButtonSpinner />}Publish to Meta</button><button style={btnGhost} onClick={() => void remove(f)} disabled={busy}>{busyAction === `delete:${f.id}` && <ButtonSpinner />}Delete</button></>}
                {f.status === "PUBLISHED" && <><button style={btn} onClick={() => setSendFor(f)}>Send</button><button style={btnGhost} onClick={() => void loadResponses(f)} disabled={busy}>{busyAction === `responses:${f.id}` && <ButtonSpinner />}Responses</button></>}
              </div>
              {respFor?.id === f.id && (
                <div style={{ marginTop: 10 }}>
                  <h4 style={{ margin: "4px 0" }}>Responses ({responses.length})</h4>
                  {busyAction === `responses:${f.id}` ? <p style={{ color: "#6b7280", fontSize: 13 }}><ButtonSpinner />Loading responses…</p> :
                  responses.length === 0 ? <p style={{ color: "#6b7280", fontSize: 13 }}>No answers yet.</p> : (
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

      {showBuilder && <FlowBuilder name={name} setName={setName} screens={screens} setScreens={setScreens} editingName={editing?.name} busy={busy} saving={busyAction === "save"} formErrors={formErrors} onSave={() => void save()} onCancel={() => { setShowBuilder(false); setFormErrors([]); }} />}

      {sendFor && <SendFlowModal flow={sendFor} onClose={() => setSendFor(null)} />}
    </div>
  );
}

function FlowBuilder({ name, setName, screens, setScreens, editingName, busy, saving, formErrors, onSave, onCancel }: {
  name: string; setName: (v: string) => void; screens: FlowScreen[]; setScreens: (v: FlowScreen[]) => void;
  editingName?: string; busy: boolean; saving: boolean; formErrors: string[]; onSave: () => void; onCancel: () => void;
}) {
  const [activeScreen, setActiveScreen] = useState(0);
  const [dragKind, setDragKind] = useState<string | null>(null);
  const [dragField, setDragField] = useState<{ si: number; fi: number } | null>(null);
  const [overScreen, setOverScreen] = useState<number | null>(null);

  const si = Math.min(activeScreen, screens.length - 1);
  const screen = screens[si];

  function patchField(fi: number, patch: Partial<FlowField>) {
    const c = [...screens];
    const fl = [...c[si].fields];
    fl[fi] = { ...fl[fi], ...patch };
    c[si] = { ...c[si], fields: fl };
    setScreens(c);
  }

  function dropFieldOnto(targetSi: number, targetFi?: number) {
    const c = screens.map((s) => ({ ...s, fields: [...s.fields] }));
    if (dragKind) {
      const f = emptyField(dragKind);
      c[targetSi].fields.splice(targetFi ?? c[targetSi].fields.length, 0, f);
      setScreens(c);
    } else if (dragField) {
      const { si: fromSi, fi: fromFi } = dragField;
      const [moved] = c[fromSi].fields.splice(fromFi, 1);
      let idx = targetFi ?? c[targetSi].fields.length;
      if (fromSi === targetSi && fromFi < idx) idx -= 1;
      c[targetSi].fields.splice(idx, 0, moved);
      setScreens(c);
    }
    setDragKind(null); setDragField(null); setOverScreen(null);
  }

  function moveScreen(from: number, to: number) {
    if (to < 0 || to >= screens.length) return;
    const c = [...screens];
    const [m] = c.splice(from, 1);
    c.splice(to, 0, m);
    setScreens(c);
    setActiveScreen(to);
  }

  return (
    <div style={{ ...card, borderColor: "#111827" }}>
      <h3 style={{ marginTop: 0 }}>{editingName ? `Edit draft: ${editingName}` : "New flow"} — drag & drop builder</h3>
      {formErrors.length > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
          <strong style={{ color: "#991b1b" }}>Fix before saving:</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#991b1b", fontSize: 13 }}>
            {formErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
      <label style={{ fontSize: 13 }}>Flow name<br /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="cod_confirm_form" style={{ ...input, width: 320, fontFamily: "monospace" }} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "170px 1fr 270px", gap: 12, marginTop: 12 }}>
        {/* Palette */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>ELEMENTS — drag onto canvas</div>
          {PALETTE.map((p) => (
            <div key={p.kind} draggable onDragStart={(e) => { setDragKind(p.kind); e.dataTransfer.effectAllowed = "copy"; }}
              style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 10px", marginBottom: 6, cursor: "grab", background: dragKind === p.kind ? "#eef2ff" : "#f9fafb" }}>
              <div style={{ fontSize: 14 }}>{p.icon} <strong>{p.label}</strong></div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>{p.hint}</div>
            </div>
          ))}
        </div>
        {/* Canvas */}
        <div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {screens.map((s, i) => (
              <div key={i} onClick={() => setActiveScreen(i)}
                style={{ display: "flex", alignItems: "center", gap: 4, border: i === si ? "2px solid #111827" : "1px solid #e5e7eb", borderRadius: 999, padding: "4px 6px 4px 10px", fontSize: 12, cursor: "pointer", background: i === si ? "#fff" : "#f9fafb" }}>
                <span>📄 {s.title || `Step ${i + 1}`}</span>
                <button title="Move left" onClick={(e) => { e.stopPropagation(); moveScreen(i, i - 1); }} style={{ border: "none", background: "none", cursor: "pointer" }}>‹</button>
                <button title="Move right" onClick={(e) => { e.stopPropagation(); moveScreen(i, i + 1); }} style={{ border: "none", background: "none", cursor: "pointer" }}>›</button>
                {screens.length > 1 && <button title="Delete screen" onClick={(e) => { e.stopPropagation(); setScreens(screens.filter((_, x) => x !== i)); setActiveScreen(0); }} style={{ border: "none", background: "none", cursor: "pointer", color: "#991b1b" }}>✕</button>}
              </div>
            ))}
            <button style={btnGhost} onClick={() => { setScreens([...screens, emptyScreen(screens.length + 1)]); setActiveScreen(screens.length); }} disabled={screens.length >= 10}>+ Screen</button>
          </div>
          {screen && (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={screen.id} onChange={(e) => { const c = [...screens]; c[si] = { ...screen, id: e.target.value }; setScreens(c); }} style={{ ...input, width: 150, fontFamily: "monospace" }} title="Screen ID" />
                <input value={screen.title} onChange={(e) => { const c = [...screens]; c[si] = { ...screen, title: e.target.value }; setScreens(c); }} placeholder="Step title" style={{ ...input, flex: 1 }} />
              </div>
              <div onDragOver={(e) => { e.preventDefault(); setOverScreen(si); }} onDragLeave={() => setOverScreen(null)} onDrop={(e) => { e.preventDefault(); dropFieldOnto(si); }}
                style={{ minHeight: 140, border: `2px dashed ${overScreen === si ? "#111827" : "#d1d5db"}`, borderRadius: 10, padding: 8, background: overScreen === si ? "#f3f4f6" : "#fff" }}>
                {screen.fields.length === 0 && <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 20 }}>Drag elements here ✨</div>}
                {screen.fields.map((f, fi) => (
                  <div key={fi} draggable
                    onDragStart={() => setDragField({ si, fi })}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropFieldOnto(si, fi); }}
                    style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, marginBottom: 6, background: "#f9fafb", cursor: "move" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#6b7280" }}>
                      <span title="Drag to reorder">⠿</span><strong>{PALETTE.find((p) => p.kind === f.kind)?.icon} {paletteLabel(f.kind)}</strong>
                      <span style={{ marginLeft: "auto" }} />
                      <button onClick={() => { const c = [...screens]; c[si] = { ...screen, fields: screen.fields.filter((_, x) => x !== fi) }; setScreens(c); }} style={{ border: "none", background: "none", cursor: "pointer", color: "#991b1b" }}>✕</button>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <input value={f.label} onChange={(e) => patchField(fi, { label: e.target.value })} placeholder="Label" style={{ ...input, flex: 1, minWidth: 120 }} />
                      <input value={f.name} onChange={(e) => patchField(fi, { name: e.target.value })} placeholder="field_name" style={{ ...input, width: 130, fontFamily: "monospace", fontSize: 12 }} />
                      <select value={f.kind} onChange={(e) => patchField(fi, { kind: e.target.value })} style={{ ...input, fontSize: 12 }}>
                        {PALETTE.map((p) => <option key={p.kind} value={p.kind}>{p.label}</option>)}
                      </select>
                      <label style={{ fontSize: 12 }}><input type="checkbox" checked={!!f.required} onChange={(e) => patchField(fi, { required: e.target.checked })} /> required</label>
                    </div>
                    {(f.kind === "dropdown" || f.kind === "checkbox" || f.kind === "radio") && (
                      <input value={(f.options ?? []).join(", ")} onChange={(e) => patchField(fi, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Option 1, Option 2, Option 3" style={{ ...input, width: "100%", marginTop: 6, fontSize: 12 }} />
                    )}
                    {f.kind === "text" && (
                      <input value={f.placeholder ?? ""} onChange={(e) => patchField(fi, { placeholder: e.target.value })} placeholder="Placeholder / helper text (optional)" style={{ ...input, width: "100%", marginTop: 6, fontSize: 12 }} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>Tip: drag fields to reorder, or drop them on another screen via the screen tabs. Screens run in tab order.</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button style={btnGhost} onClick={() => setScreens(autoFixIds(screens))} title="Rewrite digits in screen/field ids to letters (Meta forbids numbers)">Auto-fix IDs</button>
            <button style={btn} onClick={onSave} disabled={busy}>{saving && <ButtonSpinner />}{saving ? "Saving…" : "Save draft"}</button>
            <button style={btnGhost} onClick={onCancel} disabled={busy}>Cancel</button>
          </div>
        </div>
        {/* Preview */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>WHATSAPP PREVIEW</div>
          <PhonePreview screen={screen} flowName={name} />
        </div>
      </div>
    </div>
  );
}

function SendFlowModal({ flow, onClose }: { flow: Flow; onClose: () => void }) {
  const [to, setTo] = useState("");
  const [cta, setCta] = useState("Open form");
  const [bodyText, setBodyText] = useState(`Hi! Please fill this form: ${flow.name}`);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); setSending(true);
    try {
      await api(`/api/v1/flows/${flow.id}/send`, { method: "POST", body: JSON.stringify({ to, cta, bodyText }) });
      setMsg("Sent ✓"); 
    } catch (err) { setMsg(err instanceof Error ? err.message : "Send failed"); }
    finally { setSending(false); }
  }
  return (
    <div style={{ ...card, borderColor: "#111827" }}>
      <h3 style={{ marginTop: 0 }}>Send {flow.name}</h3>
      <form onSubmit={send} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+91..." style={{ ...input, width: 170 }} />
        <input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Button label" style={{ ...input, width: 140 }} />
        <input value={bodyText} onChange={(e) => setBodyText(e.target.value)} placeholder="Message text" style={{ ...input, flex: 1, minWidth: 220 }} />
        <button style={btn} type="submit" disabled={!to || !bodyText || sending}>{sending && <ButtonSpinner />}{sending ? "Sending…" : "Send"}</button>
        <button style={btnGhost} type="button" onClick={onClose}>Close</button>
      </form>
      {msg && <p>{msg}</p>}
    </div>
  );
}
