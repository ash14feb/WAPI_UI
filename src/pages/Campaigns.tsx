import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, uploadFile } from "../api/client";
import type { Campaign, Contact, MessageTemplate } from "../api/types";
import { countVars, extractBodyText, extractHeader, renderPreview } from "../inbox/templatePreview";

export function CampaignsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverDetails, setServerDetails] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [params, setParams] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [headerHandle, setHeaderHandle] = useState("");
  const [headerLink, setHeaderLink] = useState("");
  const [uploadingHeader, setUploadingHeader] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, t] = await Promise.all([
        api<Campaign[]>("/api/v1/campaigns"),
        api<MessageTemplate[]>("/api/v1/whatsapp/templates"),
      ]);
      setCampaigns(c);
      setTemplates(t.filter((x) => x.status === "APPROVED"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load campaigns");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setContacts(
          await api<Contact[]>(
            `/api/v1/contacts${contactSearch.trim() ? `?search=${encodeURIComponent(contactSearch.trim())}` : ""}`,
          ),
        );
      } catch {
        // Non-fatal; list stays as-is.
      }
    }, 300);
    return () => clearTimeout(t);
  }, [contactSearch]);

  useEffect(() => {
    if (!showCreate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowCreate(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCreate]);

  const template = templates.find((t) => t.id === templateId) ?? null;
  const varCount = template ? countVars(extractBodyText(template.componentsJson) ?? "") : 0;
  const header = template ? extractHeader(template.componentsJson) : null;
  const needsHeaderMedia = !!header && header.format !== "TEXT";

  useEffect(() => {
    setParams((prev) => Array.from({ length: varCount }, (_, i) => prev[i] ?? ""));
  }, [varCount]);

  useEffect(() => {
    // Sends need a numeric media id (fresh upload) or public URL — the
    // template's creation sample handle is not valid for sending.
    setHeaderHandle("");
    setHeaderLink("");
  }, [templateId]);

  function toggleContact(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const formValid =
    name.trim().length > 0 &&
    templateId.length > 0 &&
    selected.size > 0 &&
    params.every((p) => p.trim().length > 0) &&
    (!needsHeaderMedia || headerHandle.length > 0 || headerLink.trim().length > 0);

  async function onHeaderFile(file: File | undefined) {
    if (!file) return;
    setUploadingHeader(true);
    setError(null);
    try {
      const r = await uploadFile("/api/v1/whatsapp/media/upload", file);
      setHeaderHandle(r.handle);
      setHeaderLink("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Media upload failed");
    } finally {
      setUploadingHeader(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!formValid) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    setServerDetails(null);
    try {
      const created = await api<{ id: string }>("/api/v1/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          templateId,
          contactIds: [...selected],
          parameters: params.length > 0 ? params : undefined,
          headerMedia: needsHeaderMedia && header
            ? {
                kind: header.format.toLowerCase(),
                ...(headerHandle ? { id: headerHandle } : { link: headerLink.trim() }),
              }
            : undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      setNotice(`Campaign created with ${selected.size} recipient(s).`);
      setName("");
      setTemplateId("");
      setSelected(new Set());
      setParams([]);
      setScheduledAt("");
      setShowCreate(false);
      await load();
      navigate(`/campaigns/${created.id}`);
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

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Broadcast campaigns</h1>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            Send approved templates to many contacts at once.
          </p>
        </div>
        <div className="page-actions">
          <button className="primary-btn" onClick={() => { setShowCreate(true); setError(null); }}>
            + New Broadcast
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {serverDetails && (
        <details className="card">
          <summary className="muted small">Server validation details</summary>
          <pre className="small">{serverDetails}</pre>
        </details>
      )}
      {notice && <div className="notice">{notice}</div>}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>New broadcast</h2>
              <button className="link-btn" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <section style={{ margin: 0 }}>
              <form onSubmit={onCreate} className="form-grid">
          <label>
            Campaign name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
          </label>
          <label>
            Template (approved only)
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
              <option value="">Select…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.language})
                </option>
              ))}
            </select>
          </label>
          {template && needsHeaderMedia && header && (
            <label className="span-2">
              Header {header.format.toLowerCase()} (required — same for every recipient)
              <input
                type="file"
                accept={
                  header.format === "IMAGE"
                    ? "image/jpeg,image/png,image/webp"
                    : header.format === "VIDEO"
                      ? "video/mp4"
                      : "application/pdf"
                }
                disabled={uploadingHeader}
                onChange={(e) => void onHeaderFile(e.target.files?.[0])}
              />
              <input
                value={headerLink}
                style={{ marginTop: "0.35rem" }}
                maxLength={2048}
                placeholder="…or paste public https:// URL"
                disabled={uploadingHeader}
                onChange={(e) => {
                  setHeaderLink(e.target.value);
                  if (e.target.value.trim()) setHeaderHandle("");
                }}
              />
              {uploadingHeader && <span className="muted small">Uploading to Meta…</span>}
              {headerHandle && <span className="muted small">Attached ✓ (Meta media id)</span>}
            </label>
          )}
          {template && varCount > 0 && (
            <label className="span-2">
              Shared values for {"{{1}}"}…{"{{" + varCount + "}}"} (same for every recipient)
              {params.map((p, i) => (
                <input
                  key={i}
                  value={p}
                  style={{ marginTop: "0.35rem" }}
                  placeholder={`Value for {{${i + 1}}}`}
                  onChange={(e) =>
                    setParams((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                  }
                />
              ))}
              {extractBodyText(template.componentsJson) && (
                <div className="preview-box" style={{ marginTop: "0.4rem" }}>
                  <div className="muted tiny">Preview</div>
                  <div className="bubble-text">
                    {renderPreview(extractBodyText(template.componentsJson) ?? "", params)}
                  </div>
                </div>
              )}
            </label>
          )}
          <label>
            Schedule (optional)
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </label>
          <label>
            Recipients ({selected.size} selected)
            <input
              type="search"
              placeholder="Search contacts…"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
            />
          </label>
          <div className="span-2 contact-pick">
            {contacts.map((c) => (
              <label key={c.id} className="check-row">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggleContact(c.id)}
                />
                <span>{c.name || c.profileName || c.phone}</span>
                <span className="muted small">{c.phone}</span>
              </label>
            ))}
            {contacts.length === 0 && <div className="muted small">No contacts found.</div>}
          </div>
          <div className="span-2 modal-actions">
            <button type="button" className="ghost-btn" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button type="submit" disabled={creating || !formValid}>
              {creating ? "Creating…" : "Create campaign"}
            </button>
          </div>
        </form>
            </section>
          </div>
        </div>
      )}

      <section className="card">
        <h2>All campaigns ({campaigns.length})</h2>
        {campaigns.length === 0 ? (
          <div className="muted">None yet.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Name</th><th>Template</th><th>Status</th><th>Progress</th><th></th></tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="muted small">{c.template ? `${c.template.name} (${c.template.language})` : "—"}</td>
                  <td><span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span></td>
                  <td className="muted small">
                    {c.counts.SENT}/{c.counts.total} sent
                    {c.counts.FAILED > 0 && ` · ${c.counts.FAILED} failed`}
                  </td>
                  <td><Link to={`/campaigns/${c.id}`} className="link-btn">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
