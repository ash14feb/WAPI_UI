import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, asArray } from "../api/client";
import { accountLabel, useAccounts } from "../accounts/AccountContext";
import { PageLoader, ButtonSpinner } from "../components/Loader";
import { Bot, Plus, Pencil, Trash2, X, Zap } from "lucide-react";

interface BotRule {
  id: string;
  name: string;
  whatsappAccountId: string | null;
  matchType: "EXACT" | "CONTAINS" | "STARTS_WITH" | "DEFAULT";
  trigger: string;
  replyText: string;
  handoff: boolean;
  active: boolean;
  sortOrder: number;
  whatsappAccount?: { id: string; businessName: string | null; displayPhoneNumber: string | null } | null;
}

const EMPTY = { name: "", whatsappAccountId: "", matchType: "CONTAINS", trigger: "", replyText: "", handoff: false, active: true };

export function BotsPage() {
  const { accounts, selectedId } = useAccounts();
  const [rules, setRules] = useState<BotRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BotRule | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRules(asArray(await api<BotRule[] | { items: BotRule[] }>("/api/v1/bots/rules")));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load bot rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setDraft({ ...EMPTY, whatsappAccountId: selectedId ?? "" });
    setShowForm(true);
  }

  function openEdit(r: BotRule) {
    setEditing(r);
    setDraft({
      name: r.name,
      whatsappAccountId: r.whatsappAccountId ?? "",
      matchType: r.matchType,
      trigger: r.trigger,
      replyText: r.replyText,
      handoff: r.handoff,
      active: r.active,
    });
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: draft.name.trim(),
        whatsappAccountId: draft.whatsappAccountId || null,
        matchType: draft.matchType,
        trigger: draft.matchType === "DEFAULT" ? "" : draft.trigger.trim().toLowerCase(),
        replyText: draft.replyText.trim(),
        handoff: draft.handoff,
        active: draft.active,
      };
      if (editing) {
        await api(`/api/v1/bots/rules/${editing.id}`, { method: "PUT", body: JSON.stringify(body) });
        setNotice("Bot rule updated.");
      } else {
        await api("/api/v1/bots/rules", { method: "POST", body: JSON.stringify(body) });
        setNotice("Bot rule created — it replies to new inbound messages automatically.");
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(r: BotRule) {
    if (!window.confirm(`Delete rule "${r.name}"?`)) return;
    try {
      await api(`/api/v1/bots/rules/${r.id}`, { method: "DELETE" });
      setNotice("Bot rule deleted.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  async function toggleActive(r: BotRule) {
    try {
      await api(`/api/v1/bots/rules/${r.id}`, { method: "PUT", body: JSON.stringify({ active: !r.active }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    }
  }

  if (loading) return <PageLoader message="Loading chatbot rules…" />;

  return (
    <div className="page page-wide">
      <header className="page-header">
        <div>
          <h1><Bot size={22} style={{ verticalAlign: "-4px", marginRight: "0.4rem" }} />Chatbot</h1>
          <p className="muted small">Keyword auto-replies on inbound messages. Precedence: exact → starts-with → contains → default fallback. Built-in STOP opt-out always applies.</p>
        </div>
        <button className="primary-btn" onClick={openCreate}><Plus size={15} /> New rule</button>
      </header>

      {error && <div className="error">{error}</div>}
      {notice && <div style={{ background: "#e6f7f3", color: "#047857", padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.875rem", fontWeight: 600 }}>{notice}</div>}

      {rules.length === 0 ? (
        <div className="card muted">No rules yet. Create one — e.g. trigger <code>hi</code> → reply <code>Hello! How can we help?</code>, plus a DEFAULT fallback rule.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr className="muted tiny" style={{ textAlign: "left", textTransform: "uppercase" }}>
                <th style={{ padding: "0.75rem 1rem" }}>Rule</th>
                <th style={{ padding: "0.75rem 1rem" }}>Matches</th>
                <th style={{ padding: "0.75rem 1rem" }}>Number</th>
                <th style={{ padding: "0.75rem 1rem" }}>Reply / action</th>
                <th style={{ padding: "0.75rem 1rem" }}>Status</th>
                <th style={{ padding: "0.75rem 1rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>{r.name}</td>
                  <td style={{ padding: "0.75rem 1rem" }} className="mono">
                    {r.matchType === "DEFAULT" ? "fallback (all)" : `${r.matchType.toLowerCase()}: "${r.trigger}"`}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    {r.whatsappAccount ? accountLabel(r.whatsappAccount as never) : "All numbers"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", maxWidth: "22rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.handoff && <span className="badge badge-approved" style={{ marginRight: "0.4rem" }}><Zap size={11} /> handoff</span>}
                    {r.replyText.slice(0, 80)}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <button className="secondary-btn" style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }} onClick={() => void toggleActive(r)}>
                      {r.active ? "● Active" : "○ Paused"}
                    </button>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                    <button className="ghost-btn" onClick={() => openEdit(r)} title="Edit"><Pencil size={15} /></button>
                    <button className="ghost-btn" onClick={() => void onDelete(r)} title="Delete"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{editing ? "Edit rule" : "New bot rule"}</h2>
              <button className="ghost-btn" onClick={() => setShowForm(false)}><X size={16} /></button>
            </div>
            <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
              <label className="span-2">Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={200} /></label>
              <label className="span-2">Number
                <select value={draft.whatsappAccountId} onChange={(e) => setDraft({ ...draft, whatsappAccountId: e.target.value })}>
                  <option value="">All numbers</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                </select>
              </label>
              <label>Match
                <select value={draft.matchType} onChange={(e) => setDraft({ ...draft, matchType: e.target.value })}>
                  <option value="CONTAINS">contains</option>
                  <option value="EXACT">exact</option>
                  <option value="STARTS_WITH">starts with</option>
                  <option value="DEFAULT">fallback (all unmatched)</option>
                </select>
              </label>
              {draft.matchType !== "DEFAULT" && (
                <label>Keyword<input value={draft.trigger} onChange={(e) => setDraft({ ...draft, trigger: e.target.value })} required placeholder="e.g. pricing" maxLength={500} /></label>
              )}
              <label className="span-2">Auto-reply<textarea value={draft.replyText} onChange={(e) => setDraft({ ...draft, replyText: e.target.value })} required rows={3} maxLength={4096} placeholder="Thanks for reaching out! …" /></label>
              <label className="span-2" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" checked={draft.handoff} onChange={(e) => setDraft({ ...draft, handoff: e.target.checked })} />
                Hand off to human too (marks chat PENDING_HUMAN)
              </label>
              <label className="span-2" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                Active
              </label>
              <div className="span-2 modal-actions">
                <button className="primary-btn" disabled={busy}>{busy ? <ButtonSpinner /> : editing ? "Save rule" : "Create rule"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
