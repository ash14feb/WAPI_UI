import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { api, ApiError, asArray } from "../api/client";
import type { Conversation } from "../api/types";
import { useRealtime } from "../realtime/useRealtime";
import type { RealtimeEvent } from "../realtime/useRealtime";
import { LoadingSpinner } from "../components/Loader";
import {
  Search,
  MessageSquare,
  Check,
  CheckCheck,
  Filter,
  User,
} from "lucide-react";

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

export function InboxPage() {
  const { conversationId } = useParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const activeIdRef = useRef(conversationId);
  activeIdRef.current = conversationId;

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const data = await api<Conversation[] | { items: Conversation[] }>(
        `/api/v1/conversations${debounced ? `?search=${encodeURIComponent(debounced)}` : ""}`,
      );
      setConversations(asArray(data));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    // Initial load and search changes only; realtime keeps the list fresh after that.
    void load();
  }, [load]);

  const onRealtime = useCallback(
    (e: RealtimeEvent) => {
      if (e.type === "message.created" || e.type === "message.updated") {
        const { conversationId, message } = e;
        setConversations((prev) => {
          const index = prev.findIndex((c) => c.id === conversationId);
          if (index === -1) {
            // A conversation we don't know about yet (new contact): fetch the list.
            void load();
            return prev;
          }
          const current = prev[index];
          const isNewer = !current.lastMessage ||
            new Date(message.createdAt).getTime() >= new Date(current.lastMessage.createdAt).getTime();
          const next: Conversation = {
            ...current,
            lastMessageAt: isNewer ? message.createdAt : current.lastMessageAt,
            lastMessage: isNewer ? message : current.lastMessage,
            unreadCount:
              message.direction === "INBOUND" && isNewer
                ? current.unreadCount + (e.type === "message.created" ? 1 : 0)
                : current.unreadCount,
          };
          // An edited last message (status tick) doesn't change ordering, so
          // updating in place avoids re-sorting and re-rendering the list.
          if (e.type === "message.updated" || index === 0) {
            const copy = [...prev];
            copy[index] = next;
            return copy;
          }
          const copy = prev.filter((_, i) => i !== index);
          return [next, ...copy];
        });
        if (e.type === "message.created" && conversationId === activeIdRef.current) {
          markSeen(conversationId);
        }
        return;
      }
      if (e.type === "conversation.updated") {
        void load();
      }
    },
    [load],
  );
  useRealtime(onRealtime);

  useEffect(() => {
    // Safety net only: realtime handles the common path.
    const t = setInterval(() => void load(), 120000);
    return () => clearInterval(t);
  }, [load]);

  const displayedList = filterUnread
    ? conversations.filter(isUnread)
    : conversations;

  return (
    <div className="inbox-layout">
      <aside className={`conv-panel ${conversationId ? "sidebar-hidden-mobile" : ""}`}>
        <div className="conv-panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <MessageSquare size={20} color="#00a884" />
            <strong>Chats</strong>
            <span
              style={{
                fontSize: "0.75rem",
                background: "#e2e8f0",
                color: "#475569",
                fontWeight: 700,
                padding: "0.15rem 0.45rem",
                borderRadius: "9999px",
              }}
            >
              {conversations.length}
            </span>
          </div>

          <button
            onClick={() => setFilterUnread((v) => !v)}
            style={{
              background: filterUnread ? "#e6f7f3" : "transparent",
              color: filterUnread ? "#00a884" : "#64748b",
              border: filterUnread ? "1px solid #00a884" : "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "0.3rem 0.6rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
            title="Filter unread chats"
          >
            <Filter size={13} />
            <span>Unread</span>
          </button>
        </div>

        <div className="search-box">
          <div className="search-box-inner">
            <Search size={15} className="search-box-icon" />
            <input
              type="search"
              placeholder="Search or start new chat…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="error" style={{ margin: "0.5rem" }}>{error}</div>}

        {loading ? (
          <div className="center muted" style={{ padding: "2.5rem 1rem", flexDirection: "column", gap: "0.6rem" }}>
            <LoadingSpinner size={22} color="#00a884" />
            <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 500 }}>Loading conversations…</span>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="center muted" style={{ flexDirection: "column", gap: "0.5rem", padding: "3rem 1.5rem", textAlign: "center" }}>
            <MessageSquare size={32} color="#cbd5e1" />
            <span style={{ fontWeight: 600, color: "#475569" }}>No conversations found</span>
            <span className="tiny">Messages from your WhatsApp Cloud API webhook will appear here automatically.</span>
          </div>
        ) : (
          <ul className="conv-list">
            {displayedList.map((c) => {
              const name = displayName(c);
              const unread = isUnread(c);
              const { bg, text } = getAvatarColors(name);
              const initial = name.charAt(0).toUpperCase();

              return (
                <li key={c.id}>
                  <NavLink
                    to={`/inbox/${c.id}`}
                    className={({ isActive }) => `conv-item${isActive ? " active" : ""}`}
                    onClick={() => markSeen(c.id)}
                  >
                    <div
                      className="conv-avatar"
                      style={{ background: bg, color: text }}
                    >
                      {initial || <User size={18} />}
                    </div>

                    <div className="conv-content">
                      <div className="conv-top">
                        <span className="conv-name">{name}</span>
                        <span className="conv-time">{timeAgo(c.lastMessageAt)}</span>
                      </div>
                      {c.whatsappAccount && (
                        <div className="tiny" style={{ color: "#00a884", fontWeight: 700, marginTop: "0.1rem" }} title={`Via ${c.whatsappAccount.businessName ?? ""} ${c.whatsappAccount.displayPhoneNumber ?? ""}`}>
                          via {c.whatsappAccount.businessName || c.whatsappAccount.displayPhoneNumber || "number"}
                        </div>
                      )}

                      <div className="conv-bottom">
                        <span className="conv-preview ellipsis" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          {c.lastMessage?.direction === "OUTBOUND" && (
                            c.lastMessage.status === "READ" ? (
                              <CheckCheck size={14} color="#53bdeb" style={{ flexShrink: 0 }} />
                            ) : c.lastMessage.status === "DELIVERED" ? (
                              <CheckCheck size={14} color="#8696a0" style={{ flexShrink: 0 }} />
                            ) : (
                              <Check size={14} color="#8696a0" style={{ flexShrink: 0 }} />
                            )
                          )}
                          <span className="ellipsis">{preview(c)}</span>
                        </span>

                        {unread && (
                          <span className="unread-badge">
                            {c.unreadCount > 0 ? c.unreadCount : "•"}
                          </span>
                        )}
                      </div>
                    </div>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <main className={`detail ${conversationId ? "" : "detail-hidden-mobile"}`}>
        <Outlet context={{ onChanged: load }} />
      </main>
    </div>
  );
}
