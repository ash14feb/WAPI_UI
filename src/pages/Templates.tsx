import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, uploadFile } from "../api/client";
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
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverDetails, setServerDetails] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
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
  const [examples, setExamples] = useState("");
  const [codeExpiry, setCodeExpiry] = useState("10");
  const [creating, setCreating] = useState(false);

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
    setNotice(null);
    try {
      await api("/api/v1/whatsapp/templates/sync", { method: "POST" });
      await load();
      setNotice("Templates synced successfully from Meta Business Manager.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sync failed");
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
    setExamples("");
    setCodeExpiry("10");
    setServerDetails(null);
  }

  async function onUploadHeaderSample(file: File | undefined) {
    if (!file || uploadingHeader) return;
    setUploadingHeader(true);
    setError(null);
    try {
      const r = await uploadFile("/api/v1/whatsapp/media/upload", file, "sample");
      setHeaderHandle(r.handle);
      setHeaderFileName(file.name);
      setHeaderPreviewUrl(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sample upload failed");
    } finally {
      setUploadingHeader(false);
    }
  }

  const isAuth = category === "AUTHENTICATION";

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    setServerDetails(null);
    try {
      const varCount = countVars(bodyText);
      const exList = examples.split(",").map((s) => s.trim()).filter(Boolean);
      await api("/api/v1/whatsapp/templates", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim().toLowerCase(),
          language: language.trim(),
          category,
          headerFormat: isAuth ? "NONE" : headerFormat,
          headerText: isAuth || headerFormat !== "TEXT" ? undefined : headerText.trim() || undefined,
          headerHandle: isAuth || headerFormat === "NONE" || headerFormat === "TEXT" ? undefined : headerHandle || undefined,
          bodyText: isAuth ? undefined : bodyText.trim(),
          footerText: isAuth ? undefined : footerText.trim() || undefined,
          examples: isAuth || varCount === 0 ? undefined : exList,
          codeExpirationMinutes: isAuth ? Number(codeExpiry) || 10 : undefined,
        }),
      });
      setNotice("Template submitted — status APPROVED in studio. Sync to refresh status.");
      resetForm();
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
      if (err instanceof ApiError && err.details) {
        try {
          setServerDetails(JSON.stringify(err.details, null, 2));
        } catch {
          setServerDetails(String(err.details));
        }
      }
    } finally {
      setCreating(false);
    }
  }

  const varCount = countVars(bodyText);
  const exampleList = examples.split(",").map((s) => s.trim()).filter(Boolean);

  interface FieldErrors {
    name?: string;
    language?: string;
    bodyText?: string;
    headerText?: string;
    headerMedia?: string;
    footerText?: string;
    examples?: string;
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
      fieldErrors.examples = "Expiry must be 1–60 minutes.";
    }
  } else {
    if (!bodyText.trim()) fieldErrors.bodyText = "Body is required.";
    else if (bodyText.length > 1024) fieldErrors.bodyText = "Max 1024 characters.";
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
    if (varCount > 0 && exampleList.length !== varCount) {
      fieldErrors.examples = `Body has ${varCount} variable(s) — provide exactly ${varCount} sample value(s).`;
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
              setError(null);
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

      {error && <div className="error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

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
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Sparkles size={20} color="#00a884" />
                <h2>Create Meta Message Template</h2>
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setShowCreate(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p className="muted small" style={{ margin: "0 0 1rem" }}>
              Templates will be reviewed by Meta. Use {"{{1}}, {{2}}"} for dynamic customer variables and provide sample values.
            </p>

            {serverDetails && (
              <details className="card" style={{ padding: "0.75rem", background: "#fef2f2" }}>
                <summary className="small" style={{ color: "#dc2626", fontWeight: 600, cursor: "pointer" }}>
                  Server validation error details
                </summary>
                <pre className="small mono" style={{ margin: "0.5rem 0 0", color: "#991b1b", overflowX: "auto" }}>
                  {serverDetails}
                </pre>
              </details>
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
                    <label className="span-2">
                      Body Message Text
                      <textarea
                        rows={4}
                        value={bodyText}
                        onChange={(e) => setBodyText(e.target.value)}
                        placeholder="Hi {{1}}, your order #{{2}} is ready for dispatch."
                        required
                        maxLength={1024}
                      />
                      {fieldErrors.bodyText && <span className="field-error">{fieldErrors.bodyText}</span>}
                    </label>

                    {varCount > 0 && (
                      <label className="span-2">
                        Sample Variable Values (comma-separated, {varCount} required)
                        <input
                          value={examples}
                          onChange={(e) => setExamples(e.target.value)}
                          placeholder="e.g. Sarah, ORD-9921"
                        />
                        {fieldErrors.examples && <span className="field-error">{fieldErrors.examples}</span>}
                      </label>
                    )}

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
                    {fieldErrors.examples && <span className="field-error">{fieldErrors.examples}</span>}
                  </label>
                )}

                <div className="span-2 modal-actions">
                  <button type="button" className="secondary-btn" onClick={() => setShowCreate(false)}>
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
                            renderPreview(bodyText, varCount > 0 ? exampleList : [])
                          ) : (
                            <span className="muted">Your message text appears here…</span>
                          )}
                        </div>
                        {footerText.trim() && (
                          <div className="muted tiny preview-footer">{footerText.trim()}</div>
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
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      {previewT && (
        <div className="modal-overlay" onClick={() => setPreviewT(null)}>
          <div className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{previewT.name}</h2>
                <div className="muted small">
                  {previewT.language} · {previewT.category ?? "UTILITY"}
                </div>
              </div>
              <button className="ghost-btn" onClick={() => setPreviewT(null)}>
                <X size={18} />
              </button>
            </div>
            <StoredTemplatePreview t={previewT} />
          </div>
        </div>
      )}
    </div>
  );
}
