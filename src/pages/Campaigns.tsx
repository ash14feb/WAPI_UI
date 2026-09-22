import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, asArray, uploadFile } from "../api/client";
import { useAccounts } from "../accounts/AccountContext";
import type { Campaign, Contact, MessageTemplate } from "../api/types";
import { countVars, extractBodyText, extractHeader, renderPreview } from "../inbox/templatePreview";
import { PageLoader, ButtonSpinner } from "../components/Loader";
import {
  Megaphone,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  X,
  UploadCloud,
  ChevronRight,
  Send,
  Zap,
  Check,
} from "lucide-react";

export function CampaignsPage() {
  const navigate = useNavigate();
  const { selectedId } = useAccounts();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    try {
      const [c, t] = await Promise.all([
        api<Campaign[] | { items: Campaign[] }>("/api/v1/campaigns"),
        api<MessageTemplate[]>("/api/v1/whatsapp/templates"),
      ]);
      setCampaigns(asArray(c));
      setTemplates(t.filter((x) => x.status === "APPROVED"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setContacts(
          asArray(
            await api<Contact[] | { items: Contact[] }>(
              `/api/v1/contacts${contactSearch.trim() ? `?search=${encodeURIComponent(contactSearch.trim())}` : ""}`,
            ),
          ),
        );
      } catch {
        // Non-fatal; list stays as-is.
      }
    }, 300);
    return () => clearTimeout(t);
  }, [contactSearch]);

  const chosenTemplate = templates.find((t) => t.id === templateId);
  const header = chosenTemplate ? extractHeader(chosenTemplate.componentsJson) : null;
  const needsHeaderMedia = header !== null && header.format !== "TEXT";
  const bodyText = chosenTemplate ? extractBodyText(chosenTemplate.componentsJson) : null;
  const varCount = bodyText ? countVars(bodyText) : 0;

  function onTemplateChange(id: string) {
    setTemplateId(id);
    const tmpl = templates.find((t) => t.id === id);
    const count = tmpl ? countVars(extractBodyText(tmpl.componentsJson) || "") : 0;
    setParams(Array(count).fill(""));
    setHeaderHandle("");
    setHeaderLink("");
  }

  function toggleContact(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(contacts.map((c) => c.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function onUploadHeader(file: File | undefined) {
    if (!file || uploadingHeader) return;
    setUploadingHeader(true);
    setError(null);
    try {
      const r = await uploadFile("/api/v1/whatsapp/media/upload", file);
      setHeaderHandle(r.handle);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Media upload failed");
    } finally {
      setUploadingHeader(false);
    }
  }

  const formValid =
    name.trim().length > 0 &&
    templateId.length > 0 &&
    selected.size > 0 &&
    params.every((p) => p.trim().length > 0) &&
    (!needsHeaderMedia || Boolean(headerHandle || headerLink.trim()));

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!formValid || creating) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    setServerDetails(null);
    try {
      const created = await api<Campaign>("/api/v1/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          templateId,
          contactIds: [...selected],
          ...(selectedId ? { whatsappAccountId: selectedId } : {}),
          parameters: params.length > 0 ? params : undefined,
          headerMedia:
            needsHeaderMedia && header
              ? {
                  kind: header.format.toLowerCase(),
                  ...(headerHandle ? { id: headerHandle } : { link: headerLink.trim() }),
                }
              : undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      setNotice(`Broadcast campaign created with ${selected.size} recipient(s).`);
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
              Bulk Broadcasting
            </span>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>•</span>
            <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>
              {campaigns.length} Total Campaigns
            </span>
          </div>
          <h1>Broadcast Campaigns</h1>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            Reach targeted audience segments at scale using Meta-approved WhatsApp message templates.
          </p>
        </div>

        <div className="page-actions">
          <button
            className="primary-btn"
            onClick={() => {
              setShowCreate(true);
              setError(null);
            }}
          >
            <Plus size={16} />
            <span>New Broadcast</span>
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {serverDetails && (
        <details className="card" style={{ background: "#fef2f2" }}>
          <summary className="small" style={{ color: "#dc2626", fontWeight: 600 }}>
            Server validation details
          </summary>
          <pre className="small mono" style={{ margin: "0.5rem 0 0", color: "#991b1b" }}>{serverDetails}</pre>
        </details>
      )}
      {notice && <div className="notice">{notice}</div>}

      {/* Broadcasts List Card */}
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2>
            <Megaphone size={18} color="#00a884" />
            <span>All Broadcast Campaigns ({campaigns.length})</span>
          </h2>
        </div>

        {loading ? (
          <PageLoader
            message="Loading broadcast campaigns…"
            description="Fetching campaigns, audience contacts, and approved templates from WhatsApp Business"
            minHeight="260px"
          />
        ) : campaigns.length === 0 ? (
          <div className="center muted" style={{ flexDirection: "column", gap: "0.75rem", padding: "3.5rem 1rem" }}>
            <Megaphone size={36} color="#cbd5e1" />
            <span style={{ fontWeight: 600, color: "#475569" }}>No broadcasts scheduled or sent yet</span>
            <span className="tiny">Click "New Broadcast" to assemble your first WhatsApp campaign blast.</span>
          </div>
        ) : (
          <div className="table-container">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Template</th>
                  <th>Status</th>
                  <th>Delivery Progress</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const pct =
                    c.counts.total > 0
                      ? Math.min(100, Math.round(((c.counts.SENT + c.counts.FAILED) / c.counts.total) * 100))
                      : 0;

                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{c.name}</div>
                        <div className="muted tiny" style={{ fontFamily: "var(--font-mono)" }}>
                          ID: {c.id.slice(0, 8)}…
                        </div>
                      </td>
                      <td>
                        {c.template ? (
                          <div style={{ fontSize: "0.8125rem", color: "#334155" }}>
                            <div style={{ fontWeight: 600 }}>{c.template.name}</div>
                            <div className="muted tiny">{c.template.language}</div>
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {c.status === "COMPLETED" ? (
                          <span className="badge badge-approved">
                            <CheckCircle2 size={12} />
                            <span>Completed</span>
                          </span>
                        ) : c.status === "SENDING" ? (
                          <span className="badge badge-pending">
                            <Zap size={12} />
                            <span>Sending</span>
                          </span>
                        ) : c.status === "SCHEDULED" ? (
                          <span className="badge badge-pending">
                            <Clock size={12} />
                            <span>Scheduled</span>
                          </span>
                        ) : (
                          <span className="badge badge-draft">
                            <span>{c.status}</span>
                          </span>
                        )}
                      </td>
                      <td style={{ minWidth: "180px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                          <span>
                            {c.counts.SENT} / {c.counts.total} sent
                          </span>
                          <span style={{ fontWeight: 600 }}>{pct}%</span>
                        </div>
                        <div className="progress-track" style={{ height: "6px" }}>
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        {c.counts.FAILED > 0 && (
                          <span style={{ fontSize: "0.7rem", color: "#dc2626", marginTop: "0.2rem", display: "inline-block" }}>
                            ⚠ {c.counts.FAILED} failed
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link to={`/campaigns/${c.id}`} className="secondary-btn" style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}>
                          <span>View Detail</span>
                          <ChevronRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* New Broadcast Modal */}
      {showCreate && (
        <div className="modal-overlay campaign-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal campaign-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Megaphone size={20} color="#00a884" />
                <h2>Create Broadcast Campaign</h2>
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

            <form onSubmit={onCreate} className="form-grid campaign-form">
              <label className="span-2">
                Broadcast Campaign Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. VIP Spring Festival Offer"
                  required
                  maxLength={200}
                />
              </label>

              <label className="span-2">
                Select Approved WhatsApp Template
                <select value={templateId} onChange={(e) => onTemplateChange(e.target.value)} required>
                  <option value="">Select a template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.language}) — {t.category ?? "UTILITY"}
                    </option>
                  ))}
                </select>
              </label>

              {/* Template Preview Snippet */}
              {chosenTemplate && bodyText && (
                <div
                  className="span-2"
                  style={{
                    background: "#f8fafc",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    padding: "0.75rem 1rem",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                    Selected Template Text
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#1e293b", whiteSpace: "pre-wrap" }}>
                    {renderPreview(bodyText, params)}
                  </div>
                </div>
              )}

              {needsHeaderMedia && header && (
                <div className="span-2" style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0f172a" }}>
                    Header Media ({header.format})
                  </span>
                  <label
                    style={{
                      border: "2px dashed #cbd5e1",
                      borderRadius: "10px",
                      padding: "0.875rem",
                      textAlign: "center",
                      cursor: "pointer",
                      background: "#f8fafc",
                    }}
                  >
                    <UploadCloud size={20} color="#00a884" style={{ margin: "0 auto" }} />
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0f172a", marginTop: "0.2rem" }}>
                      {uploadingHeader ? "Uploading media…" : headerHandle ? `Uploaded: ${headerHandle}` : `Select ${header.format.toLowerCase()} file`}
                    </div>
                    <input
                      type="file"
                      hidden
                      disabled={uploadingHeader}
                      onChange={(e) => void onUploadHeader(e.target.files?.[0])}
                    />
                  </label>
                  <input
                    value={headerLink}
                    onChange={(e) => setHeaderLink(e.target.value)}
                    placeholder="Or enter public media URL…"
                    style={{ marginTop: "0.25rem" }}
                  />
                </div>
              )}

              {/* Dynamic Variables */}
              {varCount > 0 && (
                <div className="span-2" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#334155" }}>
                    Template Variables ({varCount})
                  </div>
                  {params.map((val, idx) => (
                    <label key={idx} style={{ margin: 0 }}>
                      <span className="muted small">Variable {"{{" + (idx + 1) + "}}"}</span>
                      <input
                        value={val}
                        placeholder={`Value for {{${idx + 1}}}`}
                        onChange={(e) => {
                          const next = [...params];
                          next[idx] = e.target.value;
                          setParams(next);
                        }}
                        required
                      />
                    </label>
                  ))}
                </div>
              )}

              {/* Schedule Optional */}
              <label className="span-2">
                Schedule Broadcast (Optional — leave blank to send immediately)
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </label>

              {/* Audience Selector */}
              <div className="span-2" style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0f172a" }}>
                      Select Recipients
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "0.2rem 0.55rem",
                        borderRadius: "9999px",
                        background: selected.size > 0 ? "#e6f7f3" : "#f1f5f9",
                        color: selected.size > 0 ? "#047857" : "#64748b",
                      }}
                    >
                      {selected.size} of {contacts.length} chosen
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      type="button"
                      className="ghost-btn"
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                      onClick={selectAll}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                      onClick={clearAll}
                      disabled={selected.size === 0}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Filter Audience Contacts Search Bar with Centered Icon */}
                <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center" }}>
                  <Search
                    size={15}
                    style={{
                      position: "absolute",
                      left: "0.85rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94a3b8",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type="search"
                    placeholder="Filter audience contacts by name or phone…"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.875rem 0.55rem 2.4rem",
                      fontSize: "0.8125rem",
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      height: "38px",
                    }}
                  />
                </div>

                {/* Contact Selection Buttons */}
                <div
                  className="campaign-recipients-box"
                  style={{
                    maxHeight: "190px",
                    overflowY: "auto",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    background: "#ffffff",
                    padding: "0.625rem",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.45rem",
                    alignContent: "flex-start",
                  }}
                >
                  {contacts.map((c) => {
                    const isChosen = selected.has(c.id);
                    const displayName = c.name || c.profileName || c.phone;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleContact(c.id)}
                        title={`${displayName} (${c.phone}) — click to ${isChosen ? "deselect" : "select"}`}
                        className={`contact-chip-btn${isChosen ? " selected" : ""}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          padding: "0.35rem 0.7rem",
                          borderRadius: "8px",
                          fontSize: "0.8125rem",
                          fontWeight: isChosen ? 600 : 500,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          background: isChosen ? "#e6f7f3" : "#f8fafc",
                          border: isChosen ? "1.5px solid #00a884" : "1px solid #cbd5e1",
                          color: isChosen ? "#047857" : "#334155",
                          boxShadow: isChosen ? "0 1px 3px rgba(0, 168, 132, 0.18)" : "none",
                        }}
                      >
                        {isChosen ? (
                          <Check size={13} strokeWidth={2.5} color="#00a884" />
                        ) : (
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: "#94a3b8",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
                          {displayName}
                        </span>
                      </button>
                    );
                  })}
                  {contacts.length === 0 && (
                    <div className="muted small" style={{ width: "100%", textAlign: "center", padding: "1.25rem 0.5rem" }}>
                      {contactSearch.trim() ? "No contacts match your filter." : "No contacts available."}
                    </div>
                  )}
                </div>
              </div>

              <div className="span-2 modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={creating || !formValid}>
                  {creating ? <ButtonSpinner size={15} /> : <Send size={15} />}
                  <span>{creating ? "Launching Broadcast…" : "Launch Broadcast"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
