import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { Conversation } from "../api/types";
import { useRealtime } from "../realtime/useRealtime";

const LAST_SEEN_PREFIX = "wa.lastSeen.";

function getLastSeen(id: string): number {
  return Number(localStorage.getItem(LAST_SEEN_PREFIX + id) ?? 0);
}

export function isUnread(c: Conversation): boolean {
  if (c.unreadCount > 0) return true;
  if (!c.lastMessage || c.lastMessage.direction !== "INBOUND" || !c.lastMessageAt) return false;
  return new Date(c.lastMessageAt).getTime() > getLastSeen(c.id);
}

export function markSeen(id: string): void {
  localStorage.setItem(LAST_SEEN_PREFIX + id, String(Date.now()));
}

function displayName(c: Conversation): string {
  return c.contact.name || c.contact.profileName || c.contact.phone;
}

function preview(c: Conversation): string {
  if (!c.lastMessage) return "No messages yet";
  return c.lastMessage.textContent ?? `[${c.lastMessage.messageType.toLowerCase()}]`;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "now";
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return secs <= 5 ? "now" : `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export function InboxPage() {
  const { conversationId } = useParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const data = await api<Conversation[]>(
        `/api/v1/conversations${debounced ? `?search=${encodeURIComponent(debounced)}` : ""}`,
      );
      setConversations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Live updates replace polling for the list; keep one slow safety refresh.
  const onRealtime = useCallback((_e: unknown) => void load(), [load]);
  useRealtime(onRealtime);

  useEffect(() => {
    const t = setInterval(() => void load(), 60000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="inbox-layout">
      <aside className={`conv-panel ${conversationId ? "sidebar-hidden-mobile" : ""}`}>
        <div className="conv-panel-header">
          <strong>Inbox</strong>
        </div>
        <div className="search-box">
          <input
            type="search"
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {error && <div className="error">{error}</div>}
        {loading ? (
          <div className="center muted">Loading…</div>
        ) : conversations.length === 0 ? (
          <div className="center muted">No conversations yet.</div>
        ) : (
          <ul className="conv-list">
            {conversations.map((c) => (
              <li key={c.id}>
                <NavLink
                  to={`/inbox/${c.id}`}
                  className={({ isActive }) => `conv-item${isActive ? " active" : ""}`}
                  onClick={() => markSeen(c.id)}
                >
                  <div className="conv-top">
                    <span className="conv-name">{displayName(c)}</span>
                    <span className="muted small">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <div className="conv-bottom">
                    <span className="muted small ellipsis">{preview(c)}</span>
                    {isUnread(c) && <span className="unread-dot" title="Unread" />}
                  </div>
                  <div className="muted tiny">{c.contact.phone}</div>
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <main className={`detail ${conversationId ? "" : "detail-hidden-mobile"}`}>
        <Outlet context={{ onChanged: load }} />
      </main>
    </div>
  );
}
