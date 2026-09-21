import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, uploadFile } from "../api/client";
import type { MessageTemplate } from "../api/types";
import {
  countVars,
  extractBodyText,
  extractExampleValues,
  extractHeader,
  extractHeaderExampleValues,
  extractNamedExamples,
  renderPreview,
  renderPreviewFull,
} from "../inbox/templatePreview";

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
          <div className="preview-media muted">
            [{header.format.charAt(0) + header.format.slice(1).toLowerCase()} header]
          </div>
        )}
        {preview ? (
          <div className="bubble-text">{preview}</div>
        ) : (
          <div className="bubble-text muted">No body text stored for this template.</div>
        )}
        <div className="bubble-meta muted tiny">{time}</div>
      </div>
      <div className="preview-meta muted small">
        <span className={`badge badge-${t.status.toLowerCase()}`}>{t.status}</span>{" "}
        {t.category ?? ""} · {t.language}
      </div>
    </div>
  );
}

export function TemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [serverDetails, setServerDetails] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [previewT, setPreviewT] = useState<MessageTemplate | null>(null);

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en_US");
  const [category, setCategory] = useState("UTILITY");
  const [headerFormat, setHeaderFormat] = useState<"NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT">("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerHandle, setHeaderHandle] = useState("");
  const [headerFileName, setHeaderFileName] = useState("");
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState("");
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [examples, setExamples] = useState("");
  const [codeExpiry, setCodeExpiry] = useState("10");

  const isAuth = category === "AUTHENTICATION";

  const load = useCallback(async () => {
    try {
      setTemplates(await api<MessageTemplate[]>("/api/v1/whatsapp/templates"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load templates");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!showCreate && !previewT) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowCreate(false);
        setPreviewT(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCreate, previewT]);

  async function onSync() {
    setSyncing(true);
    setError(null);
    try {
      const r = await api<{ synced: number }>("/api/v1/whatsapp/templates/sync", {
        method: "POST",
        body: "{}",
      });
      setNotice(`Synced ${r.synced} template(s) from Meta.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function onHeaderFile(file: File | undefined) {
    if (!file) return;
    setHeaderPreviewUrl(URL.createObjectURL(file));
    setUploadingHeader(true);
    setError(null);
    try {
      // "sample": resumable handle for template creation (not usable for sends).
      const r = await uploadFile("/api/v1/whatsapp/media/upload", file, "sample");
      setHeaderHandle(r.handle);
      setHeaderFileName(file.name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Media upload failed");
    } finally {
      setUploadingHeader(false);
    }
  }

  function resetForm() {
    setName("");
    setHeaderFormat("NONE");
    setHeaderText("");
    setHeaderHandle("");
    setHeaderFileName("");
    setHeaderPreviewUrl("");
    setBodyText("");
    setFooterText("");
    setExamples("");
    setServerDetails(null);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!formValid) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    setServerDetails(null);
    try {
      await api("/api/v1/whatsapp/templates", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim().toLowerCase(),
          language: language.trim(),
          category,
          headerFormat: headerFormat === "NONE" ? undefined : headerFormat,
          headerText: headerFormat === "TEXT" && headerText.trim() ? headerText.trim() : undefined,
          headerHandle: headerFormat !== "NONE" && headerFormat !== "TEXT" ? headerHandle || undefined : undefined,
          bodyText: isAuth ? undefined : bodyText,
          footerText: !isAuth && footerText.trim() ? footerText.trim() : undefined,
          examples: !isAuth && varCount > 0 ? exampleList : undefined,
          codeExpirationMinutes: isAuth ? Number(codeExpiry) || 10 : undefined,
        }),
      });
      setNotice("Template submitted — status PENDING until Meta approves. Sync to refresh status.");
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
    fieldErrors.language = 'Format like en_US (e.g. en_US, hi_IN, pt_BR).';
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
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Message templates</h1>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            {templates.length} template(s). Click Preview to see how each looks.
          </p>
        </div>
        <div className="page-actions">
          <button className="primary-btn" onClick={() => { setShowCreate(true); setError(null); }}>
            + Create Template
          </button>
          <button className="sync-btn" onClick={() => void onSync()} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync from Meta"}
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <section className="card">
        <h2>Available templates</h2>
        {templates.length === 0 ? (
          <div className="muted">None yet — create one or sync from Meta.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Name</th><th>Language</th><th>Category</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.language}</td>
                  <td>{t.category ?? "—"}</td>
                  <td><span className={`badge badge-${t.status.toLowerCase()}`}>{t.status}</span></td>
                  <td><button className="link-btn" onClick={() => setPreviewT(t)}>Preview</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Create template</h2>
              <button className="link-btn" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <p className="muted small">
              Submitted to Meta for review. Use {"{{1}}, {{2}}"} for variables and give one sample
              value per variable (comma-separated).
            </p>
            {serverDetails && (
              <details className="card">
                <summary className="muted small">Server validation details</summary>
                <pre className="small">{serverDetails}</pre>
              </details>
            )}
            <div className="create-grid">
              <form onSubmit={onCreate} className="form-grid" noValidate>
                <label>
                  Name (lowercase, underscores)
                  <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={512} />
                  {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
                </label>
                <label>
                  Language
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  {fieldErrors.language && <span className="field-error">{fieldErrors.language}</span>}
                </label>
                <label>
                  Category
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="UTILITY">UTILITY</option>
                    <option value="MARKETING">MARKETING</option>
                    <option value="AUTHENTICATION">AUTHENTICATION</option>
                  </select>
                </label>
                {isAuth ? (
                  <>
                    <label className="span-2">
                      <span className="notice" style={{ margin: 0 }}>
                        AUTHENTICATION templates use Meta's fixed preset text
                        (“&lt;code&gt; is your verification code”) with a Copy Code button.
                        Custom body, headers and media are not allowed — just name, language and expiry.
                      </span>
                    </label>
                    <label>
                      Code expires in (minutes, 1–60)
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={codeExpiry}
                        onChange={(e) => setCodeExpiry(e.target.value)}
                      />
                      {fieldErrors.examples && <span className="field-error">{fieldErrors.examples}</span>}
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Header
                      <select value={headerFormat} onChange={(e) => {
                        const v = e.target.value as typeof headerFormat;
                        setHeaderFormat(v);
                        setHeaderHandle("");
                        setHeaderFileName("");
                        setHeaderPreviewUrl("");
                      }}>
                        <option value="NONE">No header</option>
                        <option value="TEXT">Text</option>
                        <option value="IMAGE">Image</option>
                        <option value="VIDEO">Video</option>
                        <option value="DOCUMENT">Document (PDF)</option>
                      </select>
                    </label>
                    {headerFormat === "TEXT" && (
                      <label>
                        Header text (max 60)
                        <input value={headerText} onChange={(e) => setHeaderText(e.target.value)} maxLength={60} />
                        {fieldErrors.headerText && <span className="field-error">{fieldErrors.headerText}</span>}
                      </label>
                    )}
                    {headerFormat !== "NONE" && headerFormat !== "TEXT" && (
                      <label>
                        Sample {headerFormat.toLowerCase()} (max 5 MB)
                        <input
                          type="file"
                          accept={HEADER_ACCEPT[headerFormat]}
                          disabled={uploadingHeader}
                          onChange={(e) => void onHeaderFile(e.target.files?.[0])}
                        />
                        {uploadingHeader && <span className="muted small">Uploading to Meta…</span>}
                        {headerHandle && (
                          <span className="muted small">Attached: {headerFileName} ✓ (sample for review)</span>
                        )}
                        {fieldErrors.headerMedia && <span className="field-error">{fieldErrors.headerMedia}</span>}
                      </label>
                    )}
                    <label className="span-2">
                      Body (use {"{{1}}"}, {"{{2}}"}… for variables)
                      <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} required rows={3} maxLength={1024} />
                      {fieldErrors.bodyText && <span className="field-error">{fieldErrors.bodyText}</span>}
                      {!isAuth && /otp|verification code|password/i.test(bodyText) && (
                        <span className="field-hint">
                          Looks like a one-time code — Meta requires OTP content in an AUTHENTICATION template. Switch category to AUTHENTICATION.
                        </span>
                      )}
                    </label>
                    <label>
                      Footer (optional, max 60)
                      <input value={footerText} onChange={(e) => setFooterText(e.target.value)} maxLength={60} />
                      {fieldErrors.footerText && <span className="field-error">{fieldErrors.footerText}</span>}
                    </label>
                    <label className="span-2">
                      Sample values ({varCount} needed, comma-separated)
                      <input value={examples} onChange={(e) => setExamples(e.target.value)} placeholder="Asha, 4821" />
                      {fieldErrors.examples && <span className="field-error">{fieldErrors.examples}</span>}
                    </label>
                  </>
                )}
                <div className="span-2 modal-actions">
                  <button type="button" className="ghost-btn" onClick={() => setShowCreate(false)}>
                    Cancel
                  </button>
                  <button type="submit" disabled={creating || !formValid}>
                    {creating ? "Submitting…" : "Submit for review"}
                  </button>
                </div>
                {!formValid && <span className="muted small span-2">Fix the highlighted fields to enable submit.</span>}
              </form>

              <div className="preview-pane">
                <div className="muted small preview-caption">How it will look on WhatsApp</div>
                <div className="phone-mock">
                  <div className="bubble out preview-bubble">
                    {isAuth ? (
                      <>
                        <div className="bubble-text">123456 is your verification code.</div>
                        <div className="muted tiny preview-footer">
                          For your security, do not share this code.
                          {codeExpiry && ` This code expires in ${codeExpiry} minutes.`}
                        </div>
                        <div className="preview-otp-btn">⧉ Copy Code</div>
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
                              {headerFileName ? `: ${headerFileName}` : " preview"}]
                            </div>
                          )
                        )}
                        <div className="bubble-text">
                          {bodyText.trim()
                            ? renderPreview(bodyText, varCount > 0 ? exampleList : [])
                            : <span className="muted">Your body text appears here…</span>}
                        </div>
                        {footerText.trim() && <div className="muted tiny preview-footer">{footerText.trim()}</div>}
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

      {previewT && (
        <div className="modal-overlay" onClick={() => setPreviewT(null)}>
          <div className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{previewT.name}</h2>
                <div className="muted small">{previewT.language} · {previewT.category ?? "—"}</div>
              </div>
              <button className="link-btn" onClick={() => setPreviewT(null)}>✕</button>
            </div>
            <StoredTemplatePreview t={previewT} />
          </div>
        </div>
      )}
    </div>
  );
}
