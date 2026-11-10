import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, uploadFile } from "../api/client";
import { explainApiError } from "../api/errors";
import { Modal } from "../components/Modal";
import { toast } from "../components/Toast";
import type { ExplainedError } from "../api/errors";
import { accountLabel, useAccounts } from "../accounts/AccountContext";
import type { MessageTemplate } from "../api/types";
import {
  countVars,
  extractBodyText,
  extractButtons,
  extractExampleValues,
  extractFooter,
  extractHeader,
  extractHeaderExampleValues,
  extractNamedExamples,
  renderPreview,
  renderPreviewFull,
} from "../inbox/templatePreview";
import { PageLoader, ButtonSpinner } from "../components/Loader";
import {
  FileText,
  Plus,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  UploadCloud,
  Sparkles,
  Tag,
  Globe,
} from "lucide-react";

const HEADER_ACCEPT: Record<string, string> = {
  IMAGE: "image/jpeg,image/png,image/webp",
  VIDEO: "video/mp4",
  DOCUMENT: "application/pdf",
};

const LANGUAGES = [
  "en_US",
  "en_GB",
  "hi_IN",
  "pt_BR",
  "es_ES",
  "es_MX",
  "fr_FR",
  "de_DE",
  "it_IT",
  "nl_NL",
  "ar_SA",
  "ur_PK",
  "ta_IN",
  "te_IN",
  "ml_IN",
  "kn_IN",
  "mr_IN",
  "bn_IN",
  "pa_IN",
  "gu_IN",
];

/** WhatsApp-style preview of a stored (synced or created) template. */
function StoredTemplatePreview({ t }: { t: MessageTemplate }) {
  const body = extractBodyText(t.componentsJson);
  const header = extractHeader(t.componentsJson);
  const footer = extractFooter(t.componentsJson);
  const buttons = extractButtons(t.componentsJson);
  const preview = body
    ? renderPreviewFull(body, extractExampleValues(t.componentsJson), extractNamedExamples(t.componentsJson))
    : null;
  const headerPreview = header?.text
    ? renderPreviewFull(header.text, extractHeaderExampleValues(t.componentsJson), {})
    : null;
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="phone-mock">
      <div className="bubble out preview-bubble">
        {header?.format === "TEXT" && headerPreview && (
          <div className="preview-header">{headerPreview}</div>
        )}
        {header && header.format !== "TEXT" && (
          <div
            style={{
              background: "#e0dcd4",
              borderRadius: "8px",
              padding: "1rem",
              textAlign: "center",
              fontSize: "0.8125rem",
              color: "#64748b",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            [{header.format} Header]
          </div>
        )}
        <div className="bubble-text">
          {preview ? preview : <span className="muted">No body text</span>}
        </div>
        {footer && (
          <div className="muted tiny preview-footer" style={{ marginTop: "0.4rem" }}>
            {footer}
          </div>
        )}
        <div className="bubble-meta muted tiny">{time}</div>
      </div>

      {buttons.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.5rem" }}>
          {buttons.map((btn, idx) => (
            <div
              key={idx}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "0.5rem 0.75rem",
                textAlign: "center",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#00a884",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              }}
            >
              {btn.text ?? btn.type}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TemplatesPage() {
  const { selectedId, selected } = useAccounts();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<ExplainedError | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const createErrorRef = useRef<HTMLDivElement>(null);
  const [previewT, setPreviewT] = useState<MessageTemplate | null>(null);

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en_US");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("UTILITY");
  const [headerFormat, setHeaderFormat] = useState<"NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT">("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerHandle, setHeaderHandle] = useState("");
  const [headerFileName, setHeaderFileName] = useState("");
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(null);
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [sampleMap, setSampleMap] = useState<Record<number, string>>({});
  const [codeExpiry, setCodeExpiry] = useState("10");
  const [creating, setCreating] = useState(false);

  interface TemplateButton {
    type: "URL" | "PHONE_NUMBER" | "QUICK_REPLY" | "COPY_CODE" | "FLOW";
    text: string;
    url: string;
    phoneNumber: string;
    example: string;
    flowId: string;
    navigateScreen: string;
  }
  const [buttons, setButtons] = useState<TemplateButton[]>([]);

  function emptyButton(): TemplateButton {
    return { type: "QUICK_REPLY", text: "", url: "", phoneNumber: "", example: "", flowId: "", navigateScreen: "" };
  }

  function handleAddVariable() {
    const nextIdx = countVars(bodyText) + 1;
    setBodyText((prev) => (prev ? `${prev} {{${nextIdx}}}` : `{{${nextIdx}}}`));
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<MessageTemplate[]>("/api/v1/whatsapp/templates");
      setTemplates(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSync() {
    setSyncing(true);
    setError(null);
    try {
      const r = await api<{ synced: number }>("/api/v1/whatsapp/templates/sync", {
        method: "POST",
        body: JSON.stringify({ ...(selectedId ? { whatsappAccountId: selectedId } : {}) }),
      });
      await load();
      toast({
        kind: "success",
        title: `Synced ${r?.synced ?? 0} template${r?.synced === 1 ? "" : "s"} from Meta`,
        message: selected ? accountLabel(selected) : undefined,
      });
    } catch (err) {
      const explained = explainApiError(err, { action: "Template sync failed", fallback: "Meta did not return templates" });
      setError(explained.title);
      toast({ kind: "error", ...explained, duration: 12000 });
    } finally {
      setSyncing(false);
    }
  }

  function resetForm() {
    setName("");
    setLanguage("en_US");
    setCategory("UTILITY");
    setHeaderFormat("NONE");
    setHeaderText("");
    setHeaderHandle("");
    setHeaderFileName("");
    setHeaderPreviewUrl(null);
    setBodyText("");
    setFooterText("");
    setSampleMap({});
    setCodeExpiry("10");
    setButtons([]);
    setCreateError(null);
  }

  function closeCreate() {
    if (creating) return;
    setShowCreate(false);
    setCreateError(null);
  }

  async function onUploadHeaderSample(file: File | undefined) {
    if (!file || uploadingHeader) return;
    setUploadingHeader(true);
    try {
      const r = await uploadFile("/api/v1/whatsapp/media/upload", file, "sample");
      setHeaderHandle(r.handle);
      setHeaderFileName(file.name);
      setHeaderPreviewUrl(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    } catch (err) {
      toast({
        kind: "error",
        ...explainApiError(err, { action: "Sample media upload failed", fallback: "Meta did not accept the file" }),
      });
    } finally {
      setUploadingHeader(false);
    }
  }

  const isAuth = category === "AUTHENTICATION";

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const varCount = countVars(bodyText);
      const exList = Array.from({ length: varCount }, (_, i) => (sampleMap[i + 1] ?? "").trim());
      const btnPayload = buttons.map((b) => ({
        type: b.type,
        text: b.text.trim(),
        ...(b.type === "URL" ? { url: b.url.trim(), ...(b.url.includes("{{1}}") && b.example.trim() ? { example: b.example.trim() } : {}) } : {}),
        ...(b.type === "PHONE_NUMBER" ? { phoneNumber: b.phoneNumber.trim() } : {}),
        ...(b.type === "COPY_CODE" && b.example.trim() ? { example: b.example.trim() } : {}),
        ...(b.type === "FLOW" ? { flowId: b.flowId.trim(), ...(b.navigateScreen.trim() ? { navigateScreen: b.navigateScreen.trim() } : {}) } : {}),
      }));
      await api("/api/v1/whatsapp/templates", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim().toLowerCase(),
          language: language.trim(),
          category,
          ...(selectedId ? { whatsappAccountId: selectedId } : {}),
          headerFormat: isAuth ? "NONE" : headerFormat,
          headerText: isAuth || headerFormat !== "TEXT" ? undefined : headerText.trim() || undefined,
          headerHandle: isAuth || headerFormat === "NONE" || headerFormat === "TEXT" ? undefined : headerHandle || undefined,
          bodyText: isAuth ? undefined : bodyText.trim(),
          footerText: isAuth ? undefined : footerText.trim() || undefined,
          examples: isAuth || varCount === 0 ? undefined : exList,
          buttons: isAuth || btnPayload.length === 0 ? undefined : btnPayload,
          codeExpirationMinutes: isAuth ? Number(codeExpiry) || 10 : undefined,
        }),
      });
      toast({
        kind: "success",
        title: "Template submitted to Meta",
        message: "It is now PENDING review. Click Sync from Meta to refresh its status.",
      });
      resetForm();
      setShowCreate(false);
      await load();
    } catch (err) {
      const explained = explainApiError(err, {
        action: "Template was not created",
        fallback: "Meta rejected the request",
      });
      setCreateError(explained);
      toast({ kind: "error", ...explained, duration: 12000 });
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (createError) createErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [createError]);

  const varCount = countVars(bodyText);
  const sampleList = Array.from({ length: varCount }, (_, i) => (sampleMap[i + 1] ?? "").trim());
  const missingSamples = varCount > 0 && sampleList.some((s) => !s);

  interface FieldErrors {
    name?: string;
    language?: string;
    bodyText?: string;
    headerText?: string;
    headerMedia?: string;
    footerText?: string;
    examples?: string;
    codeExpiry?: string;
    buttons?: string;
  }

  const fieldErrors: FieldErrors = {};
  if (name.trim() && !/^[a-z0-9_]+$/.test(name.trim())) {
    fieldErrors.name = "Lowercase letters, numbers and underscores only.";
  }
  if (name.trim().length > 512) fieldErrors.name = "Max 512 characters.";
  if (language.trim() && !/^[a-z]{2}(_[A-Z]{2})?$/.test(language.trim())) {
    fieldErrors.language = "Format like en_US (e.g. en_US, hi_IN, pt_BR).";
  }
  if (isAuth) {
    const mins = Number(codeExpiry);
    if (!Number.isInteger(mins) || mins < 1 || mins > 60) {
      fieldErrors.codeExpiry = "Expiry must be 1–60 minutes.";
    }
  } else {
    if (!bodyText.trim()) {
      fieldErrors.bodyText = "Body is required.";
    } else if (bodyText.length > 1024) {
      fieldErrors.bodyText = "Max 1024 characters.";
    } else {
      const namedMatches = Array.from(bodyText.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g));
      if (namedMatches.some((m) => isNaN(Number(m[1])))) {
        fieldErrors.bodyText = "Meta requires numbered variables like {{1}}, {{2}} instead of named parameters.";
      }
    }
  }
  if (!isAuth && headerFormat === "TEXT" && !headerText.trim()) {
    fieldErrors.headerText = "Header text is required for TEXT headers.";
  }
  if (headerText.length > 60) fieldErrors.headerText = "Max 60 characters.";
  if (!isAuth) {
    if (headerFormat !== "NONE" && headerFormat !== "TEXT" && !headerHandle) {
      fieldErrors.headerMedia = `Upload a sample ${headerFormat.toLowerCase()} — Meta requires it to review media headers.`;
    }
    if (footerText.length > 60) fieldErrors.footerText = "Max 60 characters.";
    if (missingSamples) {
      fieldErrors.examples = `Provide sample values for all ${varCount} variable(s). Meta requires real examples to approve templates.`;
    }
    if (!isAuth && buttons.length > 0) {
      const ofType = (t: string) => buttons.filter((b) => b.type === t).length;
      if (buttons.length > 10) fieldErrors.buttons = "Max 10 buttons per template.";
      else if (ofType("URL") > 2) fieldErrors.buttons = "Max 2 URL buttons per template.";
      else if (ofType("PHONE_NUMBER") > 1) fieldErrors.buttons = "Max 1 phone-number button per template.";
      else if (ofType("COPY_CODE") > 1) fieldErrors.buttons = "Max 1 copy-code button per template.";
      else if (ofType("FLOW") > 1) fieldErrors.buttons = "Max 1 Flow button per template.";
      else {
        for (let i = 0; i < buttons.length; i++) {
          const b = buttons[i];
          if (!b.text.trim()) { fieldErrors.buttons = `Button ${i + 1}: label text is required (max 25 chars).`; break; }
          if (b.text.trim().length > 25) { fieldErrors.buttons = `Button ${i + 1}: label max 25 characters.`; break; }
          if (b.type === "URL") {
            if (!b.url.trim()) { fieldErrors.buttons = `Button ${i + 1}: URL is required (https://…).`; break; }
            if (!/^https?:\/\/.+/.test(b.url.trim())) { fieldErrors.buttons = `Button ${i + 1}: URL must start with http(s)://.`; break; }
            const vars = (b.url.match(/\{\{\d+\}\}/g) ?? []).length;
            if (vars > 1) { fieldErrors.buttons = `Button ${i + 1}: only one trailing {{1}} variable allowed.`; break; }
            if (vars === 1 && !/\{\{1\}\}$/.test(b.url.trim())) { fieldErrors.buttons = `Button ${i + 1}: {{1}} must be at the end of the URL.`; break; }
            if (vars === 1 && !b.example.trim()) { fieldErrors.buttons = `Button ${i + 1}: sample URL required when using {{1}} (e.g. https://shop.com/order/ABC123).`; break; }
          }
          if (b.type === "PHONE_NUMBER" && !b.phoneNumber.trim()) { fieldErrors.buttons = `Button ${i + 1}: phone number is required (e.g. +919876543210).`; break; }
          if (b.type === "FLOW" && !b.flowId.trim()) { fieldErrors.buttons = `Button ${i + 1}: published Flow ID is required.`; break; }
        }
      }
    }
  }

  const formValid =
    name.trim().length > 0 &&
    language.trim().length > 0 &&
    (isAuth || bodyText.trim().length > 0) &&
    Object.keys(fieldErrors).length === 0;

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
              Meta Approved Engine
            </span>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>•</span>
            <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>
              {templates.length} Active Templates
            </span>
          </div>
          <h1>Message Templates Studio</h1>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            Design, preview, and synchronize pre-approved WhatsApp Business message templates with Meta.
          </p>
        </div>

        <div className="page-actions">
          <button
            className="secondary-btn"
            onClick={() => void onSync()}
            disabled={syncing || loading}
            title="Sync templates from Meta Cloud API"
          >
            {syncing ? <ButtonSpinner size={15} /> : <RefreshCw size={15} />}
            <span>{syncing ? "Syncing from Meta…" : "Sync from Meta"}</span>
          </button>
          <button
            className="primary-btn"
            onClick={() => {
              setShowCreate(true);
              setCreateError(null);
            }}
          >
            <Plus size={16} />
            <span>Create Template</span>
          </button>
        </div>
      </header>

      {syncing && (
        <div className="notice" style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#f0fdf9", borderColor: "#a7f3d0", color: "#065f46" }}>
          <ButtonSpinner size={16} color="#00a884" />
          <span>Synchronizing message templates with Meta Business Cloud API…</span>
        </div>
      )}

      {error && (
        <div className="error" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
          <span>{error}</span>
          <button type="button" className="ghost-btn" onClick={() => setError(null)} title="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2>
            <FileText size={18} color="#00a884" />
            <span>Available Templates ({templates.length})</span>
          </h2>
          <span className="muted small">Real-time status synced with Meta</span>
        </div>

        {loading ? (
          <PageLoader
            message="Loading WhatsApp message templates…"
            description="Fetching template components, customer variable tokens, and approval statuses from Meta"
            minHeight="280px"
          />
        ) : templates.length === 0 ? (
          <div className="center muted" style={{ flexDirection: "column", gap: "0.75rem", padding: "3.5rem 1rem" }}>
            <FileText size={36} color="#cbd5e1" />
            <span style={{ fontWeight: 600, color: "#475569" }}>No templates found</span>
            <span className="tiny">Create your first template or click "Sync from Meta" to pull existing ones.</span>
          </div>
        ) : (
          <div className="table-container">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Template Name</th>
                  <th>Language</th>
                  <th>Category</th>
                  <th>Review Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => {
                  const isPreviewing = previewLoadingId === t.id;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => {
                        setPreviewLoadingId(t.id);
                        setTimeout(() => {
                          setPreviewT(t);
                          setPreviewLoadingId(null);
                        }, 120);
                      }}
                      style={{ cursor: "pointer" }}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                      title="Click to preview template"
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: "#0f172a", fontFamily: "var(--font-mono)" }}>
                          {t.name}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#475569" }}>
                          <Globe size={14} color="#94a3b8" />
                          <span>{t.language}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.5rem",
                            borderRadius: "6px",
                            background: "#f1f5f9",
                            color: "#334155",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                          }}
                        >
                          <Tag size={11} />
                          {t.category ?? "UTILITY"}
                        </span>
                      </td>
                      <td>
                        {t.status === "APPROVED" ? (
                          <span className="badge badge-approved">
                            <CheckCircle2 size={12} />
                            <span>Approved</span>
                          </span>
                        ) : t.status === "PENDING" ? (
                          <span className="badge badge-pending">
                            <Clock size={12} />
                            <span>Pending</span>
                          </span>
                        ) : (
                          <span className="badge badge-rejected">
                            <AlertCircle size={12} />
                            <span>{t.status}</span>
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="secondary-btn"
                          style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                          onClick={() => {
                            setPreviewLoadingId(t.id);
                            setTimeout(() => {
                              setPreviewT(t);
                              setPreviewLoadingId(null);
                            }, 120);
                          }}
                          disabled={isPreviewing}
                        >
                          {isPreviewing ? <ButtonSpinner size={13} /> : <Eye size={13} />}
                          <span>{isPreviewing ? "Loading…" : "Preview"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create Template Modal */}
      {showCreate && (
        <Modal
          icon={<Sparkles size={20} color="#00a884" />}
          title="Create Meta Message Template"
          onClose={closeCreate}
          closeTitle={creating ? "Wait for Meta to respond before closing" : "Close"}
        >
            <p className="muted small" style={{ margin: "0 0 1rem" }}>
              Templates will be reviewed by Meta. Use {"{{1}}, {{2}}"} for dynamic customer variables and provide sample values.
            </p>

            {createError && (
              <div className="modal-form-error" ref={createErrorRef} role="alert">
                <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong>{createError.title}</strong>
                  {createError.message && <div>{createError.message}</div>}
                  {createError.detail && (
                    <div className="mono tiny" style={{ marginTop: "0.25rem", color: "#7f1d1d", wordBreak: "break-word" }}>
                      {createError.detail}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="create-grid">
              <form onSubmit={onCreate} className="form-grid" noValidate>
                <label>
                  Template Identifier (lowercase & underscores)
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. order_confirmed_v1"
                    required
                    maxLength={512}
                  />
                  {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
                </label>

                <label>
                  Language
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.language && <span className="field-error">{fieldErrors.language}</span>}
                </label>

                <label>
                  Category
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as "MARKETING" | "UTILITY" | "AUTHENTICATION")
                    }
                  >
                    <option value="UTILITY">UTILITY (Transactional, reminders)</option>
                    <option value="MARKETING">MARKETING (Promotions, announcements)</option>
                    <option value="AUTHENTICATION">AUTHENTICATION (OTP verification)</option>
                  </select>
                </label>

                {!isAuth && (
                  <label>
                    Header Format (Optional)
                    <select
                      value={headerFormat}
                      onChange={(e) =>
                        setHeaderFormat(
                          e.target.value as "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT",
                        )
                      }
                    >
                      <option value="NONE">None</option>
                      <option value="TEXT">Text Headline</option>
                      <option value="IMAGE">Image Header</option>
                      <option value="VIDEO">Video Header</option>
                      <option value="DOCUMENT">Document (PDF)</option>
                    </select>
                  </label>
                )}

                {!isAuth && headerFormat === "TEXT" && (
                  <label className="span-2">
                    Header Text
                    <input
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      placeholder="e.g. Appointment Confirmation"
                      maxLength={60}
                    />
                    {fieldErrors.headerText && <span className="field-error">{fieldErrors.headerText}</span>}
                  </label>
                )}

                {!isAuth && headerFormat !== "NONE" && headerFormat !== "TEXT" && (
                  <div className="span-2" style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                      Sample {headerFormat} (Meta Requirement)
                    </span>
                    <label
                      style={{
                        border: "2px dashed #cbd5e1",
                        borderRadius: "10px",
                        padding: "1rem",
                        textAlign: "center",
                        cursor: "pointer",
                        background: "#f8fafc",
                      }}
                    >
                      <UploadCloud size={24} color="#00a884" style={{ margin: "0 auto" }} />
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0f172a", marginTop: "0.25rem" }}>
                        {uploadingHeader ? "Uploading sample to Meta…" : headerFileName ? headerFileName : `Select sample ${headerFormat.toLowerCase()}`}
                      </div>
                      <input
                        type="file"
                        hidden
                        accept={HEADER_ACCEPT[headerFormat] ?? "*/*"}
                        disabled={uploadingHeader}
                        onChange={(e) => void onUploadHeaderSample(e.target.files?.[0])}
                      />
                    </label>
                    {fieldErrors.headerMedia && <span className="field-error">{fieldErrors.headerMedia}</span>}
                  </div>
                )}

                {!isAuth ? (
                  <>
                    <div className="span-2" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Body Message Text</span>
                      <button
                        type="button"
                        className="ghost-btn"
                        style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "#00a884" }}
                        onClick={handleAddVariable}
                        title="Insert next variable placeholder"
                      >
                        <Plus size={13} />
                        <span>Add Variable {`{{${varCount + 1}}}`}</span>
                      </button>
                    </div>

                    <textarea
                      className="span-2"
                      rows={4}
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      placeholder="Hi {{1}}, your order #{{2}} is ready for dispatch."
                      required
                      maxLength={1024}
                    />
                    {fieldErrors.bodyText && <span className="field-error span-2">{fieldErrors.bodyText}</span>}

                    {/* Always visible Sample Values section */}
                    <div
                      className="span-2"
                      style={{
                        background: varCount > 0 ? "#f0fdf4" : "#f8fafc",
                        border: `1px solid ${varCount > 0 ? "#bbf7d0" : "var(--border)"}`,
                        borderRadius: "10px",
                        padding: "0.875rem",
                        marginTop: "0.25rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: varCount > 0 ? "0.625rem" : "0" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <Sparkles size={16} color={varCount > 0 ? "#16a34a" : "#64748b"} />
                          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: varCount > 0 ? "#15803d" : "#334155" }}>
                            Sample Values (Meta Requirement)
                          </span>
                          {varCount > 0 && (
                            <span className="badge badge-approved" style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}>
                              {varCount} variable{varCount > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {varCount > 0 && (
                          <button
                            type="button"
                            className="ghost-btn"
                            style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", color: "#00a884" }}
                            onClick={handleAddVariable}
                          >
                            <Plus size={12} /> Add {`{{${varCount + 1}}}`}
                          </button>
                        )}
                      </div>

                      {varCount === 0 ? (
                        <div style={{ fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.5, marginTop: "0.35rem" }}>
                          Meta requires realistic sample values for every dynamic variable in your template (e.g. <code>{"{{1}}"}</code> for customer name, <code>{"{{2}}"}</code> for order ID).
                          <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span>Click to insert a variable:</span>
                            <button
                              type="button"
                              className="ghost-btn"
                              style={{
                                padding: "0.25rem 0.6rem",
                                fontSize: "0.75rem",
                                background: "#ffffff",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                color: "#00a884",
                                fontWeight: 600,
                              }}
                              onClick={handleAddVariable}
                            >
                              <Plus size={13} /> Add Variable {"{{1}}"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="muted tiny" style={{ marginBottom: "0.625rem" }}>
                            Provide representative sample text for each variable. Meta uses these to verify compliance and format approval.
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: varCount > 1 ? "repeat(auto-fit, minmax(180px, 1fr))" : "1fr",
                              gap: "0.625rem",
                            }}
                          >
                            {Array.from({ length: varCount }, (_, i) => i + 1).map((idx) => (
                              <div key={idx} style={{ background: "#ffffff", padding: "0.625rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155", display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                                  <span>Sample for {`{{${idx}}}`}</span>
                                  <span className="muted" style={{ fontWeight: 400 }}>Required</span>
                                </label>
                                <input
                                  type="text"
                                  value={sampleMap[idx] ?? ""}
                                  onChange={(e) => setSampleMap((prev) => ({ ...prev, [idx]: e.target.value }))}
                                  placeholder={idx === 1 ? "e.g. Sarah" : idx === 2 ? "e.g. ORD-9921" : `e.g. Sample ${idx}`}
                                  style={{ width: "100%", fontSize: "0.8125rem", padding: "0.4rem 0.6rem", marginTop: 0 }}
                                />
                              </div>
                            ))}
                          </div>
                          {fieldErrors.examples && (
                            <span className="field-error" style={{ display: "block", marginTop: "0.5rem" }}>
                              {fieldErrors.examples}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <label className="span-2">
                      Footer Text (Optional)
                      <input
                        value={footerText}
                        onChange={(e) => setFooterText(e.target.value)}
                        placeholder="Reply STOP to unsubscribe."
                        maxLength={60}
                      />
                      {fieldErrors.footerText && <span className="field-error">{fieldErrors.footerText}</span>}
                    </label>

                    <div className="span-2" style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: "10px", padding: "0.875rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Call-to-Action Buttons (Optional)</span>
                        <button
                          type="button"
                          className="ghost-btn"
                          style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", color: "#00a884" }}
                          onClick={() => buttons.length < 10 && setButtons((p) => [...p, emptyButton()])}
                          disabled={buttons.length >= 10}
                        >
                          <Plus size={12} /> Add button {buttons.length > 0 && `(${buttons.length}/10)`}
                        </button>
                      </div>
                      <div className="muted tiny" style={{ marginBottom: "0.5rem" }}>
                        Max 10 total · up to 2 URL, 1 phone, 1 copy-code, 1 Flow. URL buttons support one trailing variable, e.g. https://shop.com/track/{"{{1}}"}.
                      </div>
                      {buttons.length === 0 && (
                        <div className="muted tiny">No buttons — template sends as plain text.</div>
                      )}
                      {buttons.map((b, i) => (
                        <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.625rem", marginBottom: "0.5rem" }}>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                            <select value={b.type} onChange={(e) => setButtons((p) => p.map((x, xI) => xI === i ? { ...x, type: e.target.value as TemplateButton["type"] } : x))} style={{ fontSize: "0.8125rem" }}>
                              <option value="QUICK_REPLY">↩ Quick reply</option>
                              <option value="URL">🔗 URL button</option>
                              <option value="PHONE_NUMBER">📞 Call button</option>
                              <option value="COPY_CODE">📋 Copy code</option>
                              <option value="FLOW">📄 Flow button</option>
                            </select>
                            <input
                              value={b.text}
                              onChange={(e) => setButtons((p) => p.map((x, xI) => xI === i ? { ...x, text: e.target.value } : x))}
                              placeholder="Button label (max 25)"
                              maxLength={25}
                              style={{ flex: 1, fontSize: "0.8125rem" }}
                            />
                            <button type="button" className="ghost-btn" onClick={() => setButtons((p) => p.filter((_, xI) => xI !== i))} title="Remove button">
                              <X size={15} />
                            </button>
                          </div>
                          {b.type === "URL" && (
                            <>
                              <input
                                value={b.url}
                                onChange={(e) => setButtons((p) => p.map((x, xI) => xI === i ? { ...x, url: e.target.value } : x))}
                                placeholder="https://shop.com/track/{{1}} ({{1}} optional, must be trailing)"
                                style={{ width: "100%", fontSize: "0.8125rem", marginBottom: "0.35rem" }}
                              />
                              {b.url.includes("{{1}}") && (
                                <input
                                  value={b.example}
                                  onChange={(e) => setButtons((p) => p.map((x, xI) => xI === i ? { ...x, example: e.target.value } : x))}
                                  placeholder="Sample URL, e.g. https://shop.com/track/ORD-9921"
                                  style={{ width: "100%", fontSize: "0.8125rem" }}
                                />
                              )}
                            </>
                          )}
                          {b.type === "PHONE_NUMBER" && (
                            <input
                              value={b.phoneNumber}
                              onChange={(e) => setButtons((p) => p.map((x, xI) => xI === i ? { ...x, phoneNumber: e.target.value } : x))}
                              placeholder="+919876543210"
                              style={{ width: "100%", fontSize: "0.8125rem" }}
                            />
                          )}
                          {b.type === "COPY_CODE" && (
                            <input
                              value={b.example}
                              onChange={(e) => setButtons((p) => p.map((x, xI) => xI === i ? { ...x, example: e.target.value } : x))}
                              placeholder="Sample code, e.g. PROMO10 (optional)"
                              style={{ width: "100%", fontSize: "0.8125rem" }}
                            />
                          )}
                          {b.type === "FLOW" && (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <input
                                value={b.flowId}
                                onChange={(e) => setButtons((p) => p.map((x, xI) => xI === i ? { ...x, flowId: e.target.value } : x))}
                                placeholder="Published Flow ID"
                                style={{ flex: 1, fontSize: "0.8125rem" }}
                              />
                              <input
                                value={b.navigateScreen}
                                onChange={(e) => setButtons((p) => p.map((x, xI) => xI === i ? { ...x, navigateScreen: e.target.value } : x))}
                                placeholder="Screen ID (optional)"
                                style={{ flex: 1, fontSize: "0.8125rem" }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      {fieldErrors.buttons && <span className="field-error" style={{ display: "block", marginTop: "0.25rem" }}>{fieldErrors.buttons}</span>}
                    </div>
                  </>
                ) : (
                  <label className="span-2">
                    Code Expiration (Minutes)
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={codeExpiry}
                      onChange={(e) => setCodeExpiry(e.target.value)}
                    />
                    {fieldErrors.codeExpiry && <span className="field-error">{fieldErrors.codeExpiry}</span>}
                  </label>
                )}

                <div className="span-2 modal-actions">
                  <button type="button" className="secondary-btn" onClick={closeCreate} disabled={creating}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn" disabled={creating || !formValid}>
                    {creating ? (
                      <>
                        <ButtonSpinner size={14} />
                        <span>Submitting to Meta…</span>
                      </>
                    ) : (
                      <span>Submit Template</span>
                    )}
                  </button>
                </div>
              </form>

              {/* Live Preview Side */}
              <div className="preview-pane">
                <div style={{ fontSize: "0.8125rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: "0.5rem" }}>
                  Live WhatsApp Screen Preview
                </div>
                <div className="phone-mock">
                  <div className="bubble out preview-bubble">
                    {isAuth ? (
                      <>
                        <div className="bubble-text">
                          {"<Verification Code> is your verification code. For your security, do not share this code."}
                        </div>
                        <div className="preview-otp-btn">
                          <span>📋 Copy Code</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {headerFormat === "TEXT" && headerText.trim() && (
                          <div className="preview-header">{headerText.trim()}</div>
                        )}
                        {headerFormat !== "NONE" && headerFormat !== "TEXT" && (
                          headerFormat === "IMAGE" && headerPreviewUrl ? (
                            <img src={headerPreviewUrl} alt="Header preview" className="preview-img" />
                          ) : (
                            <div className="preview-media muted">
                              [{headerFormat.charAt(0) + headerFormat.slice(1).toLowerCase()}
                              {headerFileName ? `: ${headerFileName}` : " sample"}]
                            </div>
                          )
                        )}
                        <div className="bubble-text">
                          {bodyText.trim() ? (
                            renderPreview(bodyText, varCount > 0 ? sampleList : [])
                          ) : (
                            <span className="muted">Your message text appears here…</span>
                          )}
                        </div>
                        {footerText.trim() && (
                          <div className="muted tiny preview-footer">{footerText.trim()}</div>
                        )}
                        {buttons.length > 0 && (
                          <div style={{ marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            {buttons.map((b, i) => (
                              <div key={i} className="preview-otp-btn" style={{ justifyContent: "center" }}>
                                <span>{b.type === "URL" ? "🔗" : b.type === "PHONE_NUMBER" ? "📞" : b.type === "COPY_CODE" ? "📋" : b.type === "FLOW" ? "📄" : "↩"} {b.text.trim() || "Button label"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    <div className="bubble-meta muted tiny">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </Modal>
      )}

      {/* Preview Dialog */}
      {previewT && (
        <Modal
          className="modal-narrow"
          title={previewT.name}
          subtitle={`${previewT.language} · ${previewT.category ?? "UTILITY"}`}
          onClose={() => setPreviewT(null)}
        >
          <StoredTemplatePreview t={previewT} />
        </Modal>
      )}
    </div>
  );
}
