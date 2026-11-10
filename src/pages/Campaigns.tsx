import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, asArray, uploadFile } from "../api/client";
import { explainApiError } from "../api/errors";
import { useAccounts } from "../accounts/AccountContext";
import type { Campaign, Contact, MessageTemplate } from "../api/types";
import { countVars, extractBodyText, extractButtons, extractHeader, renderPreview } from "../inbox/templatePreview";
import { PageLoader, ButtonSpinner } from "../components/Loader";
import { Modal } from "../components/Modal";
import { toast } from "../components/Toast";
import {
  Megaphone,
  Plus,
  Search,
  CheckCircle2,
  Clock,
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
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [params, setParams] = useState<string[]>([]);
  const [buttonVals, setButtonVals] = useState<Record<number, string>>({});
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
  // Buttons needing per-send values: variable URL suffix ({{1}}) + copy codes.
  const buttonsNeedingValues = chosenTemplate
    ? extractButtons(chosenTemplate.componentsJson)
        .map((b, i) => ({ ...b, index: i }))
        .filter((b) => (b.type === "URL" && /\{\{1\}\}$/.test(b.url ?? "")) || b.type === "COPY_CODE")
    : [];

  function onTemplateChange(id: string) {
    setTemplateId(id);
    const tmpl = templates.find((t) => t.id === id);
    const count = tmpl ? countVars(extractBodyText(tmpl.componentsJson) || "") : 0;
    setParams(Array(count).fill(""));
    setButtonVals({});
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
      toast({
        kind: "error",
        ...explainApiError(err, { action: "Header media upload failed", fallback: "Meta did not accept the file" }),
      });
    } finally {
      setUploadingHeader(false);
    }
  }

  const formValid =
    name.trim().length > 0 &&
    templateId.length > 0 &&
    selected.size > 0 &&
    params.every((p) => p.trim().length > 0) &&
    buttonsNeedingValues.every((b) => (buttonVals[b.index] ?? "").trim().length > 0) &&
    (!needsHeaderMedia || Boolean(headerHandle || headerLink.trim()));

  function closeCreate() {
    if (creating) return;
    setShowCreate(false);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!formValid || creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api<Campaign>("/api/v1/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          templateId,
          contactIds: [...selected],
          ...(selectedId ? { whatsappAccountId: selectedId } : {}),
          parameters: params.length > 0 ? params : undefined,
          buttons: buttonsNeedingValues.length > 0
            ? buttonsNeedingValues.map((b) => ({ index: b.index, value: (buttonVals[b.index] ?? "").trim() }))
            : undefined,
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
      toast({
        kind: "success",
        title: `Broadcast created for ${selected.size} recipient${selected.size === 1 ? "" : "s"}`,
        message: scheduledAt ? "It will start at the scheduled time." : "Sending has started.",
      });
      setName("");
      setTemplateId("");
      setSelected(new Set());
      setParams([]);
      setButtonVals({});
      setScheduledAt("");
      setShowCreate(false);
      await load();
      navigate(`/campaigns/${created.id}`);
    } catch (err) {
      const explained = explainApiError(err, { action: "Broadcast was not created", fallback: "The request was rejected" });
      setError(explained.title);
      toast({ kind: "error", ...explained, duration: 12000 });
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
                color: "var(--brand-teal)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background: "var(--accent-light)",
                padding: "0.2rem 0.5rem",
                borderRadius: "6px",
              }}
            >
              Bulk Broadcasting
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }}>•</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
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

      {/* Broadcasts List Card */}
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2>
            <Megaphone size={18} color="var(--brand-teal)" />
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
            <Megaphone size={36} color="var(--border)" />
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>No broadcasts scheduled or sent yet</span>
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
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{c.name}</div>
                        <div className="muted tiny" style={{ fontFamily: "var(--font-mono)" }}>
                          ID: {c.id.slice(0, 8)}…
                        </div>
                      </td>
                      <td>
                        {c.template ? (
                          <div style={{ fontSize: "0.8125rem", color: "var(--text)" }}>
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
                          <span style={{ fontSize: "0.7rem", color: "var(--danger)", marginTop: "0.2rem", display: "inline-block" }}>
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
        <Modal
          className="campaign-modal"
          icon={<Megaphone size={20} color="var(--brand-teal)" />}
          title="Create Broadcast Campaign"
          onClose={closeCreate}
        >
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
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    padding: "0.75rem 1rem",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                    Selected Template Text
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "var(--text)", whiteSpace: "pre-wrap" }}>
                    {renderPreview(bodyText, params)}
                  </div>
                </div>
              )}

              {needsHeaderMedia && header && (
                <div className="span-2" style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text)" }}>
                    Header Media ({header.format})
                  </span>
                  <label
                    style={{
                      border: "2px dashed #CDDAD7",
                      borderRadius: "10px",
                      padding: "0.875rem",
                      textAlign: "center",
                      cursor: "pointer",
                      background: "var(--bg)",
                    }}
                  >
                    <UploadCloud size={20} color="var(--brand-teal)" style={{ margin: "0 auto" }} />
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text)", marginTop: "0.2rem" }}>
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
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text)" }}>
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

              {/* Button Values (variable URL suffixes + copy codes) */}
              {buttonsNeedingValues.length > 0 && (
                <div className="span-2" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text)" }}>
                    Button Values ({buttonsNeedingValues.length})
                  </div>
                  {buttonsNeedingValues.map((b) => (
                    <label key={b.index} style={{ margin: 0 }}>
                      <span className="muted small">
                        {b.type === "COPY_CODE" ? `Copy-code for "${b.text ?? "button"}"` : `URL suffix {{1}} for "${b.text ?? "button"}"`}
                      </span>
                      <input
                        value={buttonVals[b.index] ?? ""}
                        placeholder={b.type === "COPY_CODE" ? "e.g. PROMO10" : "e.g. ORD-9921 (appended to button URL)"}
                        onChange={(e) => setButtonVals((p) => ({ ...p, [b.index]: e.target.value }))}
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
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                      Select Recipients
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "0.2rem 0.55rem",
                        borderRadius: "9999px",
                        background: selected.size > 0 ? "var(--accent-light)" : "var(--bg-subtle)",
                        color: selected.size > 0 ? "var(--success)" : "var(--text-muted)",
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
                      color: "var(--text-subtle)",
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
                      background: "var(--bg)",
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
                    background: "var(--panel)",
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
                          background: isChosen ? "var(--accent-light)" : "var(--bg)",
                          border: isChosen ? "1.5px solid var(--brand-teal)" : "1px solid var(--border)",
                          color: isChosen ? "var(--success)" : "var(--text)",
                          boxShadow: isChosen ? "0 1px 3px rgba(0, 168, 132, 0.18)" : "none",
                        }}
                      >
                        {isChosen ? (
                          <Check size={13} strokeWidth={2.5} color="var(--brand-teal)" />
                        ) : (
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: "var(--text-subtle)",
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
        </Modal>
      )}
    </div>
  );
}
