import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, asArray } from "../api/client";
import type { Contact } from "../api/types";
import { PageLoader, ButtonSpinner } from "../components/Loader";
import {
  Users,
  UserPlus,
  Search,
  Smartphone,
  Mail,
  Edit3,
  Trash2,
  X,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

interface Draft {
  phone: string;
  name: string;
  email: string;
}

const EMPTY: Draft = { phone: "", name: "", email: "" };

const AVATAR_COLORS = [
  "#e0f2fe", "#fef3c7", "#dcfce7", "#f3e8ff", "#fee2e2", "#ffedd5"
];
const AVATAR_TEXT = [
  "#0369a1", "#b45309", "#15803d", "#7e22ce", "#b91c1c", "#c2410c"
];

function getAvatarColors(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return { bg: AVATAR_COLORS[idx], text: AVATAR_TEXT[idx] };
}

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      setContacts(
        asArray(await api<Contact[] | { items: Contact[] }>(`/api/v1/contacts${q.trim() ? `?search=${encodeURIComponent(q.trim())}` : ""}`)),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const phoneValid = /^\+?[1-9]\d{6,14}$/.test(draft.phone.trim());
  const emailValid = !draft.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim());

  // Check if phone number already exists in contacts
  const phoneClean = draft.phone.trim().replace(/\D/g, "");
  const isDuplicatePhone =
    phoneClean.length >= 7 &&
    contacts.some((c) => {
      if (editing && c.id === editing.id) return false;
      const cClean = c.phone.replace(/\D/g, "");
      return cClean === phoneClean || c.phone.trim() === draft.phone.trim();
    });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (isDuplicatePhone) {
      setFormError("This phone number is already present in your audience contacts.");
      return;
    }
    if (!phoneValid || !emailValid || busy) return;
    setBusy(true);
    setFormError(null);
    setNotice(null);
    try {
      const body = JSON.stringify({
        phone: draft.phone.trim(),
        name: draft.name.trim() || undefined,
        email: draft.email.trim() || undefined,
      });
      if (editing) {
        await api(`/api/v1/contacts/${editing.id}`, { method: "PUT", body });
        setNotice("Contact updated successfully.");
      } else {
        await api("/api/v1/contacts", { method: "POST", body });
        setNotice("Contact added to audience list.");
      }
      setDraft(EMPTY);
      setEditing(null);
      setFormError(null);
      setShowForm(false);
      await load(search);
    } catch (err) {
      // Show validation error inside the modal screen only, not on the previous screen!
      const msg = err instanceof ApiError ? err.message : "Failed to save contact";
      setFormError(msg);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(c: Contact) {
    setEditing(c);
    setDraft({ phone: c.phone, name: c.name ?? "", email: c.email ?? "" });
    setShowForm(true);
    setFormError(null);
    setError(null);
    setNotice(null);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft(EMPTY);
    setFormError(null);
    setShowForm(false);
  }

  async function onDelete(c: Contact) {
    const label = c.name || c.profileName || c.phone;
    if (!window.confirm(`Delete ${label}? Associated conversation history will also be removed.`)) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await api(`/api/v1/contacts/${c.id}`, { method: "DELETE" });
      setNotice("Contact deleted.");
      if (editing?.id === c.id) cancelEdit();
      await load(search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
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
              Audience Directory
            </span>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>•</span>
            <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>
              {contacts.length} Contacts
            </span>
          </div>
          <h1>Audience Contacts</h1>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            Manage your opted-in WhatsApp customer list for conversational support and targeted broadcasts.
          </p>
        </div>

        <div className="page-actions">
          <button
            className="primary-btn"
            onClick={() => {
              cancelEdit();
              setShowForm(true);
              setFormError(null);
              setError(null);
            }}
          >
            <UserPlus size={16} />
            <span>Add Contact</span>
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <h2>
            <Users size={18} color="#00a884" />
            <span>All Contacts ({contacts.length})</span>
          </h2>

          <div className="search-box" style={{ width: "320px", margin: 0 }}>
            <div className="search-box-inner">
              <Search size={14} className="search-box-icon" />
              <input
                type="search"
                placeholder="Search name or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <PageLoader
            message="Loading customer contacts…"
            description="Searching and retrieving verified WhatsApp contacts directory"
            minHeight="260px"
          />
        ) : contacts.length === 0 ? (
          <div className="center muted" style={{ flexDirection: "column", gap: "0.75rem", padding: "3.5rem 1rem" }}>
            <Users size={36} color="#cbd5e1" />
            <span style={{ fontWeight: 600, color: "#475569" }}>No contacts found</span>
            <span className="tiny">Click "Add Contact" above or receive an inbound customer message to populate this directory.</span>
          </div>
        ) : (
          <div className="table-container">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Customer Profile</th>
                  <th>WhatsApp Number</th>
                  <th>Email Address</th>
                  <th>Verification</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => {
                  const name = c.name || c.profileName || "Unknown Customer";
                  const initial = name.charAt(0).toUpperCase();
                  const { bg, text } = getAvatarColors(name);

                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              background: bg,
                              color: text,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "0.875rem",
                              flexShrink: 0,
                            }}
                          >
                            {initial}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>{name}</div>
                            {c.profileName && c.name && (
                              <div className="muted tiny">WA: {c.profileName}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontFamily: "var(--font-mono)", color: "#334155" }}>
                          <Smartphone size={14} color="#00a884" />
                          <span>{c.phone}</span>
                        </div>
                      </td>
                      <td>
                        {c.email ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#475569", fontSize: "0.8125rem" }}>
                            <Mail size={13} color="#94a3b8" />
                            <span>{c.email}</span>
                          </div>
                        ) : (
                          <span className="muted small">—</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-approved" style={{ fontSize: "0.6875rem" }}>
                          <ShieldCheck size={11} />
                          <span>Opted In</span>
                        </span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                          <button
                            className="secondary-btn"
                            style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}
                            onClick={() => startEdit(c)}
                            title="Edit Contact"
                          >
                            <Edit3 size={13} />
                            <span>Edit</span>
                          </button>
                          <button
                            className="ghost-btn"
                            style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem", color: "#dc2626" }}
                            onClick={() => void onDelete(c)}
                            title="Delete Contact"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit / Create Contact Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={cancelEdit}>
          <div className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <UserPlus size={18} color="#00a884" />
                <h2>{editing ? "Edit Audience Contact" : "Add Audience Contact"}</h2>
              </div>
              <button className="ghost-btn" onClick={cancelEdit}>
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div
                className="error"
                style={{
                  marginBottom: "1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.84rem",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "8px",
                  background: "#fee2e2",
                  border: "1px solid #fca5a5",
                  color: "#991b1b",
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="form-grid form-single" noValidate>
              <label>
                Phone Number (E.164 digits, e.g. 15553829920 or 919986439557)
                <input
                  value={draft.phone}
                  onChange={(e) => {
                    setDraft({ ...draft, phone: e.target.value });
                    setFormError(null);
                  }}
                  required
                  disabled={busy}
                  placeholder="e.g. 15553829920"
                  style={isDuplicatePhone ? { borderColor: "#ef4444" } : undefined}
                />
                {isDuplicatePhone && (
                  <span className="field-error" style={{ color: "#dc2626", fontWeight: 600 }}>
                    This phone number is already present in your audience contacts.
                  </span>
                )}
                {draft.phone && !phoneValid && !isDuplicatePhone && (
                  <span className="field-error">Digits only with country code, E.164 formatted.</span>
                )}
              </label>

              <label>
                Full Name (Optional)
                <input
                  value={draft.name}
                  onChange={(e) => {
                    setDraft({ ...draft, name: e.target.value });
                    setFormError(null);
                  }}
                  placeholder="e.g. Maya Lin"
                  maxLength={120}
                  disabled={busy}
                />
              </label>

              <label>
                Email Address (Optional)
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => {
                    setDraft({ ...draft, email: e.target.value });
                    setFormError(null);
                  }}
                  placeholder="maya@example.com"
                  disabled={busy}
                />
                {draft.email.trim() && !emailValid && (
                  <span className="field-error">Enter a valid email address.</span>
                )}
              </label>

              <div className="modal-actions" style={{ marginTop: "1rem" }}>
                <button type="button" className="secondary-btn" onClick={cancelEdit}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={busy || !phoneValid || !emailValid || isDuplicatePhone}
                >
                  {busy ? (
                    <>
                      <ButtonSpinner size={14} />
                      <span>Saving…</span>
                    </>
                  ) : editing ? (
                    "Save Changes"
                  ) : (
                    "Add to Audience"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
