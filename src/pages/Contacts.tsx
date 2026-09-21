import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../api/client";
import type { Contact } from "../api/types";

interface Draft {
  phone: string;
  name: string;
  email: string;
}

const EMPTY: Draft = { phone: "", name: "", email: "" };

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (q: string) => {
    try {
      setContacts(
        await api<Contact[]>(`/api/v1/contacts${q.trim() ? `?search=${encodeURIComponent(q.trim())}` : ""}`),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load contacts");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const phoneValid = /^\+?[1-9]\d{6,14}$/.test(draft.phone.trim());
  const emailValid = !draft.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim());

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!phoneValid || !emailValid || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body = JSON.stringify({
        phone: draft.phone.trim(),
        name: draft.name.trim() || undefined,
        email: draft.email.trim() || undefined,
      });
      if (editing) {
        await api(`/api/v1/contacts/${editing.id}`, { method: "PUT", body });
        setNotice("Contact updated.");
      } else {
        await api("/api/v1/contacts", { method: "POST", body });
        setNotice("Contact added.");
      }
      setDraft(EMPTY);
      setEditing(null);
      setShowForm(false);
      await load(search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(c: Contact) {
    setEditing(c);
    setDraft({ phone: c.phone, name: c.name ?? "", email: c.email ?? "" });
    setShowForm(true);
    setError(null);
    setNotice(null);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft(EMPTY);
    setShowForm(false);
  }

  async function onDelete(c: Contact) {
    const label = c.name || c.profileName || c.phone;
    if (!window.confirm(`Delete ${label}? Their conversations, messages and campaign links are removed too.`)) {
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
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Contacts</h1>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            Customers you can message and target in campaigns.
          </p>
        </div>
        <div className="page-actions">
          <button className="primary-btn" onClick={() => { cancelEdit(); setShowForm(true); setError(null); }}>
            + Create Contact
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => cancelEdit()}>
          <div className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{editing ? "Edit contact" : "Add contact"}</h2>
              <button className="link-btn" onClick={() => cancelEdit()}>✕</button>
            </div>
            <form onSubmit={onSubmit} className="form-grid form-single" noValidate>
          <label>
            Phone (digits, e.g. 919986439557)
            <input
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              required
              disabled={busy}
              placeholder="919986439557"
            />
            {draft.phone && !phoneValid && (
              <span className="field-error">Digits only, E.164 style.</span>
            )}
          </label>
          <label>
            Name (optional)
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              maxLength={120}
              disabled={busy}
            />
          </label>
          <label>
            Email (optional)
            <input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              disabled={busy}
            />
            {draft.email.trim() && !emailValid && (
              <span className="field-error">Enter a valid email.</span>
            )}
          </label>
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={cancelEdit}>
              Cancel
            </button>
            <button type="submit" disabled={busy || !phoneValid || !emailValid}>
              {busy ? "Saving…" : editing ? "Save changes" : "Add contact"}
            </button>
          </div>
        </form>
          </div>
        </div>
      )}

      <section className="card">
        <div className="search-box" style={{ padding: 0, border: "none", marginBottom: "0.75rem" }}>
          <input
            type="search"
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {contacts.length === 0 ? (
          <div className="muted">No contacts yet — use Create Contact, or message a customer first.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Name</th><th>Phone</th><th>Email</th><th></th></tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td>{c.name || c.profileName || "—"}</td>
                  <td className="muted small">{c.phone}</td>
                  <td className="muted small">{c.email || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="link-btn" onClick={() => startEdit(c)}>Edit</button>
                    <button className="link-btn danger-text" onClick={() => void onDelete(c)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
