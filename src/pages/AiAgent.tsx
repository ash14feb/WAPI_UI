import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageLoader, ButtonSpinner } from "../components/Loader";
import { Modal } from "../components/Modal";
import {
  BookOpen,
  Brain,
  KeyRound,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Settings2,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";

interface SalesPlaybook {
  valueProposition: string;
  keyBenefits: string[];
  differentiators: string[];
  objections: { objection: string; response: string }[];
  closingGuidance: string;
}

interface DiscountPolicy {
  maxDiscountPercent: number;
  allowGenericDiscounts: boolean;
  requireHumanApprovalAbove: number;
  currency: string;
  notes: string;
}

interface AiSettings {
  id: string | null;
  enabled: boolean;
  providerBaseUrl: string;
  hasApiKey: boolean;
  apiKeyLast4: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  requestTimeoutMs: number;
  maxRetries: number;
  historyWindow: number;
  systemPrompt: string;
  businessInfo: string | null;
  language: string;
  tone: string;
  humanLike: boolean;
  replyDelayMs: number;
  salesPlaybook: SalesPlaybook | null;
  discountPolicy: DiscountPolicy | null;
  handoffEnabled: boolean;
  handoffInstructions: string | null;
  fallbackMessage: string | null;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  updatedAt: string | null;
}

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string | null;
  active: boolean;
  sortOrder: number;
}

interface AiOffer {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  minOrderValue: number | null;
  maxDiscountValue: number | null;
  validFrom: string | null;
  validTo: string | null;
  active: boolean;
}

interface AiLog {
  id: string;
  conversationId: string;
  inboundMessageId: string | null;
  status: string;
  model: string | null;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  requestExcerpt: string | null;
  responseExcerpt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface AiStats {
  repliesToday: number;
  handoffsToday: number;
  errorsToday: number;
  policyViolationsToday: number;
  knowledgeCount: number;
  offersCount: number;
}

const EMPTY_PLAYBOOK: SalesPlaybook = {
  valueProposition: "",
  keyBenefits: [],
  differentiators: [],
  objections: [],
  closingGuidance: "",
};

const EMPTY_POLICY: DiscountPolicy = {
  maxDiscountPercent: 0,
  allowGenericDiscounts: false,
  requireHumanApprovalAbove: 0,
  currency: "USD",
  notes: "",
};

interface Draft {
  enabled: boolean;
  providerBaseUrl: string;
  model: string;
  apiKey: string;
  clearApiKey: boolean;
  temperature: number;
  maxTokens: number;
  requestTimeoutMs: number;
  maxRetries: number;
  historyWindow: number;
  systemPrompt: string;
  businessInfo: string;
  language: string;
  tone: string;
  humanLike: boolean;
  replyDelayMs: number;
  handoffEnabled: boolean;
  handoffInstructions: string;
  fallbackMessage: string;
  playbook: SalesPlaybook;
  policy: DiscountPolicy;
}

function toDraft(s: AiSettings): Draft {
  return {
    enabled: s.enabled,
    providerBaseUrl: s.providerBaseUrl,
    model: s.model,
    apiKey: "",
    clearApiKey: false,
    temperature: s.temperature,
    maxTokens: s.maxTokens,
    requestTimeoutMs: s.requestTimeoutMs,
    maxRetries: s.maxRetries,
    historyWindow: s.historyWindow,
    systemPrompt: s.systemPrompt,
    businessInfo: s.businessInfo ?? "",
    language: s.language,
    tone: s.tone,
    humanLike: s.humanLike,
    replyDelayMs: s.replyDelayMs,
    handoffEnabled: s.handoffEnabled,
    handoffInstructions: s.handoffInstructions ?? "",
    fallbackMessage: s.fallbackMessage ?? "",
    playbook: s.salesPlaybook ?? EMPTY_PLAYBOOK,
    policy: s.discountPolicy ?? EMPTY_POLICY,
  };
}

function linesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
}

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function statusStyle(status: string): { background: string; color: string } {
  if (status === "SUCCESS") return { background: "var(--success-bg)", color: "var(--success)" };
  if (status === "POLICY_VIOLATION") return { background: "var(--warning-bg)", color: "#a8641c" };
  return { background: "var(--danger-bg)", color: "var(--danger)" };
}

const TABS = [
  { key: "setup", label: "Setup", icon: Settings2 },
  { key: "knowledge", label: "Knowledge", icon: BookOpen },
  { key: "offers", label: "Offers", icon: Tag },
  { key: "logs", label: "Logs", icon: ScrollText },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function AiAgentPage() {
  const { user } = useAuth();
  const canEdit = ["OWNER", "ADMIN"].includes((user?.role ?? "").toUpperCase());

  const [tab, setTab] = useState<TabKey>("setup");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const [stats, setStats] = useState<AiStats | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [offers, setOffers] = useState<AiOffer[]>([]);
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [logStatus, setLogStatus] = useState("");

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, st, k, o] = await Promise.all([
        api<AiSettings>("/api/v1/ai/settings"),
        api<AiStats>("/api/v1/ai/stats"),
        api<KnowledgeEntry[]>("/api/v1/ai/knowledge"),
        api<AiOffer[]>("/api/v1/ai/offers"),
      ]);
      setSettings(s);
      setDraft(toDraft(s));
      setStats(st);
      setKnowledge(k);
      setOffers(o);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load AI settings");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async (status: string) => {
    try {
      const data = await api<{ items: AiLog[] }>(
        `/api/v1/ai/logs?${status ? `status=${encodeURIComponent(status)}&` : ""}limit=50`,
      );
      setLogs(data.items ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load AI logs");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === "logs") void loadLogs(logStatus);
  }, [tab, logStatus, loadLogs]);

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body: Record<string, unknown> = {
        enabled: draft.enabled,
        providerBaseUrl: draft.providerBaseUrl.trim(),
        model: draft.model.trim(),
        temperature: draft.temperature,
        maxTokens: draft.maxTokens,
        requestTimeoutMs: draft.requestTimeoutMs,
        maxRetries: draft.maxRetries,
        historyWindow: draft.historyWindow,
        systemPrompt: draft.systemPrompt,
        businessInfo: draft.businessInfo.trim() || null,
        language: draft.language.trim(),
        tone: draft.tone.trim(),
        humanLike: draft.humanLike,
        replyDelayMs: draft.replyDelayMs,
        handoffEnabled: draft.handoffEnabled,
        handoffInstructions: draft.handoffInstructions.trim() || null,
        fallbackMessage: draft.fallbackMessage.trim() || null,
        salesPlaybook: draft.playbook,
        discountPolicy: draft.policy,
      };
      if (draft.apiKey.trim()) body.apiKey = draft.apiKey.trim();
      if (draft.clearApiKey) body.clearApiKey = true;

      const saved = await api<AiSettings>("/api/v1/ai/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setSettings(saved);
      setDraft(toDraft(saved));
      setNotice("AI agent settings saved.");
      void loadLogs(logStatus);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    if (!draft || testing) return;
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const result = await api<{ ok: boolean; model: string; latencyMs: number; sample: string }>(
        "/api/v1/ai/test",
        {
          method: "POST",
          body: JSON.stringify({
            providerBaseUrl: draft.providerBaseUrl.trim(),
            model: draft.model.trim(),
            ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
          }),
        },
      );
      setTestResult(`Connected to ${result.model} in ${result.latencyMs} ms — reply: "${result.sample}"`);
    } catch (err) {
      setTestResult(err instanceof ApiError ? `${err.code}: ${err.message}` : "Connection test failed");
    } finally {
      setTesting(false);
    }
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (loading || !draft) return <PageLoader message="Loading AI agent…" />;

  return (
    <div className="page page-wide">
      <header className="page-header">
        <div>
          <h1><Sparkles size={22} style={{ verticalAlign: "-4px", marginRight: "0.4rem" }} />AI Sales Agent</h1>
          <p className="muted small">
            Replies automatically to messages no keyword rule matches. Keyword rules and STOP opt-out always take precedence.
          </p>
        </div>
        <span
          className="badge"
          style={draft.enabled ? { background: "var(--success-bg)", color: "var(--success)" } : { background: "var(--bg-subtle)", color: "var(--text-muted)" }}
        >
          {draft.enabled ? "AI enabled" : "AI disabled"}
        </span>
      </header>

      {error && <div className="error">{error}</div>}
      {notice && (
        <div style={{ background: "var(--accent-light)", color: "var(--success)", padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.875rem", fontWeight: 600 }}>
          {notice}
        </div>
      )}

      {stats && (
        <div className="stat-grid" style={{ marginBottom: "1rem" }}>
          <div className="stat-card stat-green">
            <div className="stat-label">AI replies today</div>
            <div className="stat-value">{stats.repliesToday}</div>
          </div>
          <div className="stat-card stat-amber">
            <div className="stat-label">Handoffs today</div>
            <div className="stat-value">{stats.handoffsToday}</div>
          </div>
          <div className="stat-card stat-blue">
            <div className="stat-label">Active knowledge</div>
            <div className="stat-value">{stats.knowledgeCount}</div>
          </div>
          <div className="stat-card stat-purple">
            <div className="stat-label">Active offers</div>
            <div className="stat-value">{stats.offersCount}</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              className={active ? "primary-btn" : "secondary-btn"}
              onClick={() => setTab(t.key)}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "setup" && (
        <form className="form-grid" onSubmit={(e) => void saveSettings(e)}>
          <div className="card span-2">
            <h2><KeyRound size={18} /> Provider</h2>
            <div className="form-grid" style={{ marginTop: "0.75rem" }}>
              <label className="span-2" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  disabled={!canEdit}
                  onChange={(e) => update("enabled", e.target.checked)}
                />
                Enable the AI sales agent for this workspace
              </label>
              <label className="span-2">
                API base URL
                <input
                  value={draft.providerBaseUrl}
                  onChange={(e) => update("providerBaseUrl", e.target.value)}
                  disabled={!canEdit}
                  placeholder="https://api.openai.com/v1"
                />
              </label>
              <label>
                Model
                <input
                  value={draft.model}
                  onChange={(e) => update("model", e.target.value)}
                  disabled={!canEdit}
                  placeholder="gpt-4o-mini"
                />
              </label>
              <label>
                API key
                <input
                  type="password"
                  value={draft.apiKey}
                  onChange={(e) => update("apiKey", e.target.value)}
                  disabled={!canEdit}
                  placeholder={settings?.hasApiKey ? `Stored ••••${settings.apiKeyLast4 ?? ""} — leave blank to keep` : "sk-…"}
                  autoComplete="new-password"
                />
              </label>
              {settings?.hasApiKey && (
                <label className="span-2" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="checkbox"
                    checked={draft.clearApiKey}
                    disabled={!canEdit}
                    onChange={(e) => update("clearApiKey", e.target.checked)}
                  />
                  Remove the stored API key
                </label>
              )}
              <div className="span-2" style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <button type="button" className="secondary-btn" onClick={() => void testConnection()} disabled={testing || !canEdit}>
                  {testing ? <ButtonSpinner /> : <Play size={14} />} Test connection
                </button>
                {testResult && <span className="small muted">{testResult}</span>}
                {settings?.lastTestStatus && !testResult && (
                  <span className="tiny muted">Last test: {settings.lastTestStatus}</span>
                )}
              </div>
            </div>
          </div>

          <div className="card span-2">
            <h2><Brain size={18} /> Response style</h2>
            <div className="form-grid" style={{ marginTop: "0.75rem" }}>
              <label>
                Temperature ({draft.temperature.toFixed(1)})
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={draft.temperature}
                  disabled={!canEdit}
                  onChange={(e) => update("temperature", Number(e.target.value))}
                />
              </label>
              <label>
                Max reply tokens
                <input
                  type="number"
                  min={1}
                  max={4096}
                  value={draft.maxTokens}
                  disabled={!canEdit}
                  onChange={(e) => update("maxTokens", Number(e.target.value))}
                />
              </label>
              <label>
                History window (messages)
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={draft.historyWindow}
                  disabled={!canEdit}
                  onChange={(e) => update("historyWindow", Number(e.target.value))}
                />
              </label>
              <label>
                Language
                <input
                  value={draft.language}
                  disabled={!canEdit}
                  onChange={(e) => update("language", e.target.value)}
                  placeholder="auto, English, Arabic…"
                />
              </label>
              <label>
                Tone
                <select value={draft.tone} disabled={!canEdit} onChange={(e) => update("tone", e.target.value)}>
                  <option value="friendly">friendly</option>
                  <option value="professional">professional</option>
                  <option value="casual">casual</option>
                  <option value="enthusiastic">enthusiastic</option>
                  <option value="concise">concise</option>
                </select>
              </label>
              <label>
                Reply delay (ms)
                <input
                  type="number"
                  min={0}
                  max={5000}
                  step={250}
                  value={draft.replyDelayMs}
                  disabled={!canEdit}
                  onChange={(e) => update("replyDelayMs", Number(e.target.value))}
                />
              </label>
              <label className="span-2" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={draft.humanLike}
                  disabled={!canEdit}
                  onChange={(e) => update("humanLike", e.target.checked)}
                />
                Human-like phrasing (short, natural WhatsApp replies)
              </label>
              <label className="span-2">
                Fallback message (used when the AI fails or a policy block occurs)
                <textarea
                  rows={2}
                  value={draft.fallbackMessage}
                  disabled={!canEdit}
                  onChange={(e) => update("fallbackMessage", e.target.value)}
                  maxLength={4096}
                />
              </label>
            </div>
          </div>

          <div className="card span-2">
            <h2><BookOpen size={18} /> Instructions &amp; business information</h2>
            <div className="form-grid" style={{ marginTop: "0.75rem" }}>
              <label className="span-2">
                System prompt (behaviour, boundaries, must-say rules)
                <textarea
                  rows={6}
                  value={draft.systemPrompt}
                  disabled={!canEdit}
                  onChange={(e) => update("systemPrompt", e.target.value)}
                  placeholder="You are a sales assistant for … Always be polite. Never invent prices. …"
                  maxLength={20000}
                />
              </label>
              <label className="span-2">
                Business information (hours, location, delivery, policies…)
                <textarea
                  rows={5}
                  value={draft.businessInfo}
                  disabled={!canEdit}
                  onChange={(e) => update("businessInfo", e.target.value)}
                  maxLength={20000}
                />
              </label>
              <label className="span-2">
                Handoff instructions (when a human should take over)
                <textarea
                  rows={2}
                  value={draft.handoffInstructions}
                  disabled={!canEdit}
                  onChange={(e) => update("handoffInstructions", e.target.value)}
                  maxLength={4000}
                />
              </label>
              <label className="span-2" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={draft.handoffEnabled}
                  disabled={!canEdit}
                  onChange={(e) => update("handoffEnabled", e.target.checked)}
                />
                Allow the AI to hand the conversation to a human
              </label>
            </div>
          </div>

          <div className="card span-2">
            <h2><Sparkles size={18} /> Sales playbook</h2>
            <div className="form-grid" style={{ marginTop: "0.75rem" }}>
              <label className="span-2">
                Value proposition
                <textarea
                  rows={2}
                  value={draft.playbook.valueProposition}
                  disabled={!canEdit}
                  onChange={(e) =>
                    update("playbook", { ...draft.playbook, valueProposition: e.target.value })
                  }
                  maxLength={4000}
                />
              </label>
              <label>
                Key benefits (one per line)
                <textarea
                  rows={4}
                  value={draft.playbook.keyBenefits.join("\n")}
                  disabled={!canEdit}
                  onChange={(e) =>
                    update("playbook", { ...draft.playbook, keyBenefits: linesToArray(e.target.value) })
                  }
                />
              </label>
              <label>
                Differentiators (one per line)
                <textarea
                  rows={4}
                  value={draft.playbook.differentiators.join("\n")}
                  disabled={!canEdit}
                  onChange={(e) =>
                    update("playbook", { ...draft.playbook, differentiators: linesToArray(e.target.value) })
                  }
                />
              </label>
              <label className="span-2">
                Closing guidance
                <textarea
                  rows={2}
                  value={draft.playbook.closingGuidance}
                  disabled={!canEdit}
                  onChange={(e) =>
                    update("playbook", { ...draft.playbook, closingGuidance: e.target.value })
                  }
                  maxLength={4000}
                />
              </label>
              <div className="span-2">
                <div className="small" style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Objection handling</div>
                {draft.playbook.objections.map((item, index) => (
                  <div key={index} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input
                      value={item.objection}
                      disabled={!canEdit}
                      placeholder="Customer objection"
                      onChange={(e) => {
                        const objections = [...draft.playbook.objections];
                        objections[index] = { ...objections[index], objection: e.target.value };
                        update("playbook", { ...draft.playbook, objections });
                      }}
                    />
                    <input
                      value={item.response}
                      disabled={!canEdit}
                      placeholder="Recommended response"
                      onChange={(e) => {
                        const objections = [...draft.playbook.objections];
                        objections[index] = { ...objections[index], response: e.target.value };
                        update("playbook", { ...draft.playbook, objections });
                      }}
                    />
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={!canEdit}
                      onClick={() =>
                        update("playbook", {
                          ...draft.playbook,
                          objections: draft.playbook.objections.filter((_, i) => i !== index),
                        })
                      }
                      title="Remove objection"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={!canEdit}
                  onClick={() =>
                    update("playbook", {
                      ...draft.playbook,
                      objections: [...draft.playbook.objections, { objection: "", response: "" }],
                    })
                  }
                >
                  <Plus size={14} /> Add objection
                </button>
              </div>
            </div>
          </div>

          <div className="card span-2">
            <h2><Tag size={18} /> Discount guardrails</h2>
            <div className="form-grid" style={{ marginTop: "0.75rem" }}>
              <label>
                Max discount %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.policy.maxDiscountPercent}
                  disabled={!canEdit}
                  onChange={(e) =>
                    update("policy", { ...draft.policy, maxDiscountPercent: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Require human approval above %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.policy.requireHumanApprovalAbove}
                  disabled={!canEdit}
                  onChange={(e) =>
                    update("policy", { ...draft.policy, requireHumanApprovalAbove: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Currency
                <input
                  value={draft.policy.currency}
                  disabled={!canEdit}
                  onChange={(e) => update("policy", { ...draft.policy, currency: e.target.value })}
                  maxLength={10}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.5rem" }}>
                <input
                  type="checkbox"
                  checked={draft.policy.allowGenericDiscounts}
                  disabled={!canEdit}
                  onChange={(e) =>
                    update("policy", { ...draft.policy, allowGenericDiscounts: e.target.checked })
                  }
                />
                Allow generic discounts not tied to a listed offer
              </label>
              <label className="span-2">
                Policy notes for the AI
                <textarea
                  rows={2}
                  value={draft.policy.notes}
                  disabled={!canEdit}
                  onChange={(e) => update("policy", { ...draft.policy, notes: e.target.value })}
                  maxLength={2000}
                />
              </label>
            </div>
          </div>

          <div className="span-2 modal-actions" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button className="primary-btn" disabled={!canEdit || busy}>
              {busy ? <ButtonSpinner /> : <Save size={15} />} Save settings
            </button>
            {!canEdit && <span className="small muted">Only workspace owners and admins can change these settings.</span>}
          </div>
        </form>
      )}

      {tab === "knowledge" && (
        <KnowledgeTab
          entries={knowledge}
          canEdit={canEdit}
          onReload={load}
          setError={setError}
          setNotice={setNotice}
        />
      )}

      {tab === "offers" && (
        <OffersTab
          offers={offers}
          canEdit={canEdit}
          onReload={load}
          setError={setError}
          setNotice={setNotice}
        />
      )}

      {tab === "logs" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1rem", borderBottom: "1px solid var(--border)" }}>
            <select value={logStatus} onChange={(e) => setLogStatus(e.target.value)} style={{ maxWidth: "14rem" }}>
              <option value="">All statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="POLICY_VIOLATION">Policy violation</option>
              <option value="FAILED">Failed</option>
            </select>
            <button type="button" className="ghost-btn" onClick={() => void loadLogs(logStatus)}>
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
          {logs.length === 0 ? (
            <div className="card muted" style={{ border: "none" }}>No AI responses logged yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr className="muted tiny" style={{ textAlign: "left", textTransform: "uppercase" }}>
                  <th style={{ padding: "0.75rem 1rem" }}>Time</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Status</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Model / latency</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Inbound</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Reply / error</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.65rem 1rem", whiteSpace: "nowrap" }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.65rem 1rem" }}>
                      <span className="badge" style={statusStyle(log.status)}>{log.status.replace(/_/g, " ")}</span>
                    </td>
                    <td style={{ padding: "0.65rem 1rem" }}>
                      {log.model ?? "—"}
                      {log.latencyMs != null ? ` · ${log.latencyMs} ms` : ""}
                      {log.promptTokens != null ? ` · ${log.promptTokens}/${log.completionTokens ?? 0} tok` : ""}
                    </td>
                    <td style={{ padding: "0.65rem 1rem", maxWidth: "18rem" }} className="ellipsis">
                      {log.requestExcerpt ?? "—"}
                    </td>
                    <td style={{ padding: "0.65rem 1rem", maxWidth: "22rem" }} className="ellipsis">
                      {log.errorMessage ? (
                        <span style={{ color: "var(--danger)" }}>
                          {log.errorCode ? `${log.errorCode}: ` : ""}{log.errorMessage}
                        </span>
                      ) : (
                        log.responseExcerpt ?? "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function KnowledgeTab(props: {
  entries: KnowledgeEntry[];
  canEdit: boolean;
  onReload: () => Promise<void>;
  setError: (v: string | null) => void;
  setNotice: (v: string | null) => void;
}) {
  const { entries, canEdit, onReload, setError, setNotice } = props;
  const empty = { title: "", content: "", category: "", active: true, sortOrder: 0 };
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function openCreate() {
    setEditing(null);
    setDraft(empty);
    setShowForm(true);
  }

  function openEdit(entry: KnowledgeEntry) {
    setEditing(entry.id);
    setDraft({
      title: entry.title,
      content: entry.content,
      category: entry.category ?? "",
      active: entry.active,
      sortOrder: entry.sortOrder,
    });
    setShowForm(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: draft.title.trim(),
        content: draft.content.trim(),
        category: draft.category.trim() || null,
        active: draft.active,
        sortOrder: draft.sortOrder,
      };
      if (editing) {
        await api(`/api/v1/ai/knowledge/${editing}`, { method: "PUT", body: JSON.stringify(body) });
        setNotice("Knowledge entry updated.");
      } else {
        await api("/api/v1/ai/knowledge", { method: "POST", body: JSON.stringify(body) });
        setNotice("Knowledge entry added.");
      }
      setShowForm(false);
      await onReload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(entry: KnowledgeEntry) {
    try {
      await api(`/api/v1/ai/knowledge/${entry.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !entry.active }),
      });
      await onReload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    }
  }

  async function remove(entry: KnowledgeEntry) {
    if (!window.confirm(`Delete knowledge entry "${entry.title}"?`)) return;
    try {
      await api(`/api/v1/ai/knowledge/${entry.id}`, { method: "DELETE" });
      setNotice("Knowledge entry deleted.");
      await onReload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
        <button type="button" className="primary-btn" disabled={!canEdit} onClick={openCreate}>
          <Plus size={15} /> New entry
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="card muted">
          No knowledge yet. Add products, pricing, delivery rules and FAQs so the AI answers from facts instead of guessing.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr className="muted tiny" style={{ textAlign: "left", textTransform: "uppercase" }}>
                <th style={{ padding: "0.75rem 1rem" }}>Title</th>
                <th style={{ padding: "0.75rem 1rem" }}>Category</th>
                <th style={{ padding: "0.75rem 1rem" }}>Content</th>
                <th style={{ padding: "0.75rem 1rem" }}>Status</th>
                <th style={{ padding: "0.75rem 1rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>{entry.title}</td>
                  <td style={{ padding: "0.75rem 1rem" }} className="muted">{entry.category ?? "—"}</td>
                  <td style={{ padding: "0.75rem 1rem", maxWidth: "30rem" }} className="ellipsis">
                    {entry.content}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <button
                      type="button"
                      className="secondary-btn"
                      style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                      disabled={!canEdit}
                      onClick={() => void toggle(entry)}
                    >
                      {entry.active ? "● Active" : "○ Paused"}
                    </button>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                    <button className="ghost-btn" disabled={!canEdit} onClick={() => openEdit(entry)} title="Edit">
                      <Pencil size={15} />
                    </button>
                    <button className="ghost-btn" disabled={!canEdit} onClick={() => void remove(entry)} title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal
          className="modal-narrow"
          title={editing ? "Edit knowledge" : "New knowledge entry"}
          onClose={() => !busy && setShowForm(false)}
        >
            <form className="form-grid" onSubmit={(e) => void submit(e)}>
              <label className="span-2">
                Title
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required maxLength={200} />
              </label>
              <label>
                Category
                <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} maxLength={100} />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  min={0}
                  value={draft.sortOrder}
                  onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
                />
              </label>
              <label className="span-2">
                Content
                <textarea
                  rows={7}
                  value={draft.content}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  required
                  maxLength={20000}
                />
              </label>
              <label className="span-2" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                Active
              </label>
              <div className="span-2 modal-actions">
                <button type="button" className="secondary-btn" disabled={busy} onClick={() => setShowForm(false)}>Cancel</button>
                <button className="primary-btn" disabled={busy}>
                  {busy ? <ButtonSpinner /> : editing ? "Save entry" : "Add entry"}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
}

function OffersTab(props: {
  offers: AiOffer[];
  canEdit: boolean;
  onReload: () => Promise<void>;
  setError: (v: string | null) => void;
  setNotice: (v: string | null) => void;
}) {
  const { offers, canEdit, onReload, setError, setNotice } = props;
  const empty = {
    name: "",
    code: "",
    description: "",
    discountType: "PERCENT" as "PERCENT" | "FIXED",
    discountValue: 0,
    minOrderValue: "",
    maxDiscountValue: "",
    validFrom: "",
    validTo: "",
    active: true,
  };
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function openCreate() {
    setEditing(null);
    setDraft(empty);
    setShowForm(true);
  }

  function openEdit(offer: AiOffer) {
    setEditing(offer.id);
    setDraft({
      name: offer.name,
      code: offer.code ?? "",
      description: offer.description ?? "",
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      minOrderValue: offer.minOrderValue != null ? String(offer.minOrderValue) : "",
      maxDiscountValue: offer.maxDiscountValue != null ? String(offer.maxDiscountValue) : "",
      validFrom: toLocalInput(offer.validFrom),
      validTo: toLocalInput(offer.validTo),
      active: offer.active,
    });
    setShowForm(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: draft.name.trim(),
        code: draft.code.trim() || null,
        description: draft.description.trim() || null,
        discountType: draft.discountType,
        discountValue: draft.discountValue,
        minOrderValue: draft.minOrderValue ? Number(draft.minOrderValue) : null,
        maxDiscountValue: draft.maxDiscountValue ? Number(draft.maxDiscountValue) : null,
        validFrom: toIsoOrNull(draft.validFrom),
        validTo: toIsoOrNull(draft.validTo),
        active: draft.active,
      };
      if (editing) {
        await api(`/api/v1/ai/offers/${editing}`, { method: "PUT", body: JSON.stringify(body) });
        setNotice("Offer updated.");
      } else {
        await api("/api/v1/ai/offers", { method: "POST", body: JSON.stringify(body) });
        setNotice("Offer created.");
      }
      setShowForm(false);
      await onReload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(offer: AiOffer) {
    try {
      await api(`/api/v1/ai/offers/${offer.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !offer.active }),
      });
      await onReload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    }
  }

  async function remove(offer: AiOffer) {
    if (!window.confirm(`Delete offer "${offer.name}"?`)) return;
    try {
      await api(`/api/v1/ai/offers/${offer.id}`, { method: "DELETE" });
      setNotice("Offer deleted.");
      await onReload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
        <button type="button" className="primary-btn" disabled={!canEdit} onClick={openCreate}>
          <Plus size={15} /> New offer
        </button>
      </div>

      {offers.length === 0 ? (
        <div className="card muted">
          No offers yet. The AI can only quote offers listed here, and generic discounts are blocked unless allowed in Setup.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr className="muted tiny" style={{ textAlign: "left", textTransform: "uppercase" }}>
                <th style={{ padding: "0.75rem 1rem" }}>Offer</th>
                <th style={{ padding: "0.75rem 1rem" }}>Code</th>
                <th style={{ padding: "0.75rem 1rem" }}>Discount</th>
                <th style={{ padding: "0.75rem 1rem" }}>Validity</th>
                <th style={{ padding: "0.75rem 1rem" }}>Status</th>
                <th style={{ padding: "0.75rem 1rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>
                    {offer.name}
                    {offer.description && <div className="tiny muted">{offer.description}</div>}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }} className="mono">{offer.code ?? "—"}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    {offer.discountType === "PERCENT" ? `${offer.discountValue}%` : `${offer.discountValue} fixed`}
                    {offer.maxDiscountValue != null ? ` (max ${offer.maxDiscountValue})` : ""}
                    {offer.minOrderValue != null ? ` · min order ${offer.minOrderValue}` : ""}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }} className="tiny muted">
                    {offer.validFrom ? new Date(offer.validFrom).toLocaleDateString() : "—"}
                    {" → "}
                    {offer.validTo ? new Date(offer.validTo).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <button
                      type="button"
                      className="secondary-btn"
                      style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                      disabled={!canEdit}
                      onClick={() => void toggle(offer)}
                    >
                      {offer.active ? "● Active" : "○ Paused"}
                    </button>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                    <button className="ghost-btn" disabled={!canEdit} onClick={() => openEdit(offer)} title="Edit">
                      <Pencil size={15} />
                    </button>
                    <button className="ghost-btn" disabled={!canEdit} onClick={() => void remove(offer)} title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal
          className="modal-narrow"
          title={editing ? "Edit offer" : "New offer"}
          onClose={() => !busy && setShowForm(false)}
        >
            <form className="form-grid" onSubmit={(e) => void submit(e)}>
              <label className="span-2">
                Name
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={200} />
              </label>
              <label>
                Code
                <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} maxLength={60} />
              </label>
              <label>
                Type
                <select
                  value={draft.discountType}
                  onChange={(e) => setDraft({ ...draft, discountType: e.target.value as "PERCENT" | "FIXED" })}
                >
                  <option value="PERCENT">percent</option>
                  <option value="FIXED">fixed amount</option>
                </select>
              </label>
              <label>
                Discount value
                <input
                  type="number"
                  min={0}
                  max={draft.discountType === "PERCENT" ? 100 : 100000000}
                  value={draft.discountValue}
                  onChange={(e) => setDraft({ ...draft, discountValue: Number(e.target.value) })}
                />
              </label>
              <label>
                Min order value
                <input
                  type="number"
                  min={0}
                  value={draft.minOrderValue}
                  onChange={(e) => setDraft({ ...draft, minOrderValue: e.target.value })}
                />
              </label>
              <label>
                Max discount value
                <input
                  type="number"
                  min={0}
                  value={draft.maxDiscountValue}
                  onChange={(e) => setDraft({ ...draft, maxDiscountValue: e.target.value })}
                />
              </label>
              <label>
                Valid from
                <input type="datetime-local" value={draft.validFrom} onChange={(e) => setDraft({ ...draft, validFrom: e.target.value })} />
              </label>
              <label>
                Valid to
                <input type="datetime-local" value={draft.validTo} onChange={(e) => setDraft({ ...draft, validTo: e.target.value })} />
              </label>
              <label className="span-2">
                Description
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  maxLength={4000}
                />
              </label>
              <label className="span-2" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                Active
              </label>
              <div className="span-2 modal-actions">
                <button type="button" className="secondary-btn" disabled={busy} onClick={() => setShowForm(false)}>Cancel</button>
                <button className="primary-btn" disabled={busy}>
                  {busy ? <ButtonSpinner /> : editing ? "Save offer" : "Create offer"}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
}
