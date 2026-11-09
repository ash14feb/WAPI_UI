import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { api, ApiError, asArray, uploadFile } from "../api/client";
import type { Conversation, Message } from "../api/types";
import { useRealtime } from "../realtime/useRealtime";
import type { RealtimeEvent } from "../realtime/useRealtime";
import { markSeen, timeAgo } from "./InboxPage";
import {
  Send,
  Paperclip,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  X,
  Phone,
  ShieldCheck,
  Ban,
  Sparkles,
} from "lucide-react";

interface Ctx {
  onChanged: () => void;
}

interface AiConversationState {
  conversationId: string;
  aiEnabled: boolean | null;
  summary: string | null;
  facts: Record<string, unknown>;
  handoffAt: string | null;
  lastAiReplyAt: string | null;
  consecutiveErrors: number;
  lastError: string | null;
}

function statusLabel(m: Message): string {
  if (m.direction === "INBOUND") return "";
  return m.status.charAt(0) + m.status.slice(1).toLowerCase();
}

/** WhatsApp-style ticks for outbound messages. */
function Ticks({ status }: { status: string }) {
  if (status === "READ") {
    return (
      <span className="ticks read" title="Read by recipient">
        <CheckCheck size={14} color="#53bdeb" />
      </span>
    );
  }
  if (status === "DELIVERED") {
    return (
      <span className="ticks" title="Delivered to recipient">
        <CheckCheck size={14} color="#8696a0" />
      </span>
    );
  }
  if (status === "SENT") {
    return (
      <span className="ticks" title="Sent via Meta Cloud API">
        <Check size={14} color="#8696a0" />
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="ticks failed" title="Message delivery failed">
        <AlertCircle size={14} color="#dc2626" />
      </span>
    );
  }
  return (
    <span className="ticks sending" title={status === "SENDING" ? "Sending…" : "Queued"}>
      <Clock size={13} color="#8696a0" className="sending-clock" />
    </span>
  );
}

function MessageBody({ m }: { m: Message }) {
  if (m.messageType === "IMAGE") {
    return (
      <div className="bubble-text">
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#0284c7", fontWeight: 600, fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
          <ImageIcon size={14} />
          <span>Image</span>
        </div>
        {m.textContent && <div>{m.textContent}</div>}
      </div>
    );
  }
  if (m.messageType === "VIDEO") {
    return (
      <div className="bubble-text">
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#7c3aed", fontWeight: 600, fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
          <Video size={14} />
          <span>Video</span>
        </div>
        {m.textContent && <div>{m.textContent}</div>}
      </div>
    );
  }
  if (m.messageType === "DOCUMENT") {
    return (
      <div className="bubble-text">
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#b45309", fontWeight: 600, fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
          <FileText size={14} />
          <span>Document</span>
        </div>
        {m.textContent && <div>{m.textContent}</div>}
      </div>
    );
  }
  if (m.messageType === "AUDIO") {
    return (
      <div className="bubble-text">
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#059669", fontWeight: 600, fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
          <Music size={14} />
          <span>Voice Message</span>
        </div>
        {m.textContent && <div>{m.textContent}</div>}
      </div>
    );
  }

  return <div className="bubble-text">{m.textContent ?? ""}</div>;
}

const Bubble = memo(function Bubble({ m }: { m: Message }) {
  return (
    <div className={`bubble ${m.direction === "OUTBOUND" ? "out" : "in"}`}>
      <MessageBody m={m} />
      {m.direction === "OUTBOUND" && m.messageType === "AI" && (
        <div
          className="tiny"
          style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#0284c7", fontWeight: 700, marginTop: "0.25rem" }}
        >
          <Sparkles size={11} /> AI Agent
        </div>
      )}
      <div
        className="bubble-meta"
        title={m.messageTimestamp ? new Date(m.messageTimestamp).toLocaleString() : statusLabel(m)}
      >
        <span>{timeAgo(m.messageTimestamp)}</span>
        {m.direction === "OUTBOUND" && <Ticks status={m.status} />}
      </div>
    </div>
  );
});

interface Attachment {
  kind: "image" | "video" | "document";
  mediaId: string;
  fileName: string;
  previewUrl: string | null;
}

export function ConversationView() {
  const { conversationId } = useParams();
  const { onChanged } = useOutletContext<Ctx>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiState, setAiState] = useState<AiConversationState | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!conversationId) return;
    try {
      const [conv, msgs] = await Promise.all([
        api<Conversation>(`/api/v1/conversations/${conversationId}`),
        api<Message[] | { items: Message[] }>(`/api/v1/conversations/${conversationId}/messages`),
      ]);
      setConversation(conv);
      setMessages(asArray(msgs));
      markSeen(conversationId);
      setError(null);
      api<AiConversationState>(`/api/v1/ai/conversations/${conversationId}/state`)
        .then(setAiState)
        .catch(() => setAiState(null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load conversation");
    }
  }, [conversationId]);

  useEffect(() => {
    setConversation(null);
    setMessages([]);
    setAiState(null);
    setAttachment(null);
    void load();
  }, [load]);

  // Server ids (or temp ids) of optimistic rows awaiting their SSE echo.
  const pendingTempIdsRef = useRef(new Set<string>());

  const mergeIncoming = useCallback((incoming: Message) => {
    setMessages((prev) => {
      const byId = prev.findIndex((m) => m.id === incoming.id);
      if (byId !== -1) {
        const copy = [...prev];
        copy[byId] = incoming;
        return copy;
      }
      // Our optimistic row, echoed back over SSE before the POST resolved:
      // adopt the server identity instead of rendering the message twice.
      const pendingIndex = prev.findIndex(
        (m) => m.status === "SENDING" && pendingTempIdsRef.current.has(m.id),
      );
      if (pendingIndex !== -1) {
        pendingTempIdsRef.current.delete(prev[pendingIndex].id);
        const copy = [...prev];
        copy[pendingIndex] = incoming;
        return copy;
      }
      return [...prev, incoming];
    });
  }, []);

  const onRealtime = useCallback(
    (e: RealtimeEvent) => {
      if (e.type !== "message.created" && e.type !== "message.updated") return;
      if (e.conversationId !== conversationId) return;
      mergeIncoming(e.message);
      if (e.type === "message.created") {
        markSeen(e.conversationId);
        onChanged();
      }
    },
    [conversationId, mergeIncoming, onChanged],
  );
  useRealtime(onRealtime);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function onAttach(file: File | undefined) {
    if (!file || sending) return;
    const kind = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : "document";
    setUploading(true);
    setError(null);
    try {
      const r = await uploadFile("/api/v1/whatsapp/media/upload", file);
      setAttachment({
        kind,
        mediaId: r.handle,
        fileName: file.name,
        previewUrl: kind === "image" ? URL.createObjectURL(file) : null,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Media upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if ((!text.trim() && !attachment) || !conversationId || sending || uploading) return;

    const outgoingText = text.trim();
    const outgoingAttachment = attachment;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Message = {
      id: tempId,
      conversationId,
      whatsappMessageId: null,
      direction: "OUTBOUND",
      messageType: outgoingAttachment ? outgoingAttachment.kind.toUpperCase() : "TEXT",
      textContent: outgoingText || null,
      status: "SENDING",
      messageTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Paint immediately: the composer never waits on the network.
    pendingTempIdsRef.current.add(tempId);
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setAttachment(null);
    setSending(true);
    setError(null);

    try {
      const saved = await api<{ message?: Message; messageId: string }>(
        `/api/v1/conversations/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify(
            outgoingAttachment
              ? {
                  mediaKind: outgoingAttachment.kind,
                  mediaId: outgoingAttachment.mediaId,
                  caption: outgoingText || undefined,
                  filename: outgoingAttachment.kind === "document" ? outgoingAttachment.fileName : undefined,
                }
              : { text: outgoingText },
          ),
        },
      );
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== tempId) return m;
          pendingTempIdsRef.current.delete(tempId);
          if (saved?.message) {
            pendingTempIdsRef.current.delete(saved.message.id);
            return saved.message;
          }
          // Response without the row body: keep waiting for the SSE update.
          const serverId = saved?.messageId ?? m.id;
          pendingTempIdsRef.current.add(serverId);
          return { ...m, id: serverId };
        }),
      );
      onChanged();
    } catch (err) {
      pendingTempIdsRef.current.delete(tempId);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "FAILED" } : m)));
      setError(err instanceof ApiError ? err.message : "Failed to send message");
      // Nothing was lost: restore the draft so the user can retry.
      setText((current) => (current ? current : outgoingText));
      if (outgoingAttachment) setAttachment(outgoingAttachment);
    } finally {
      setSending(false);
    }
  }

  async function toggleAi() {
    if (!conversationId) return;
    const next = aiState?.aiEnabled === false;
    try {
      const state = await api<AiConversationState>(`/api/v1/ai/conversations/${conversationId}/state`, {
        method: "PUT",
        body: JSON.stringify({ aiEnabled: next }),
      });
      setAiState(state);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update AI agent");
    }
  }

  if (!conversationId) {
    return (
      <div className="center muted" style={{ height: "100%", flexDirection: "column", gap: "1rem", background: "#f8fafc" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "#e6f7f3", display: "flex", alignItems: "center", justifyContent: "center", color: "#00a884" }}>
          <Phone size={32} />
        </div>
        <div style={{ textAlign: "center" }}>
          <h3 style={{ fontSize: "1.25rem", color: "#0f172a", marginBottom: "0.25rem" }}>UnifyLead Shared Inbox</h3>
          <p className="muted small" style={{ maxWidth: "340px", margin: "0 auto" }}>
            Select a customer conversation from the list to reply directly through WhatsApp Business Cloud API.
          </p>
        </div>
      </div>
    );
  }

  const name =
    conversation?.contact.name ??
    conversation?.contact.profileName ??
    conversation?.contact.phone ??
    "…";

  const initial = name.charAt(0).toUpperCase();
  const optedOut = (conversation?.contact.tags ?? "")
    .split(",")
    .some((t) => t.trim().toLowerCase() === "opted_out");
  const canSend = !sending && !uploading && !optedOut && (!!text.trim() || !!attachment);

  return (
    <div className="conv-detail">
      <header className="detail-header">
        <div className="detail-header-contact">
          <Link to="/inbox" className="back-link" style={{ marginRight: "0.25rem", color: "#64748b" }}>
            <ArrowLeft size={20} />
          </Link>

          <div className="detail-header-avatar">
            {initial}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <strong style={{ fontSize: "1rem", color: "#0f172a" }}>{name}</strong>
              <span title="Verified WhatsApp Contact" style={{ display: "inline-flex" }}>
                <ShieldCheck size={14} color="#00a884" />
              </span>
              {optedOut && (
                <span
                  title="This contact replied STOP and cannot be messaged until re-subscribed"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    background: "#fef2f2",
                    color: "#b91c1c",
                    border: "1px solid #fecaca",
                    borderRadius: "999px",
                    padding: "0.1rem 0.5rem",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  <Ban size={11} />
                  <span>Opted out</span>
                </span>
              )}
            </div>
            <div className="muted tiny" style={{ fontFamily: "var(--font-mono)", color: "#64748b" }}>
              {conversation?.contact.phone}
            </div>
            {conversation?.whatsappAccount && (
              <div className="tiny" style={{ color: "#00a884", fontWeight: 700, marginTop: "0.15rem" }}>
                Replies send from {conversation.whatsappAccount.businessName || conversation.whatsappAccount.displayPhoneNumber || "this number"}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            className="ghost-btn"
            onClick={() => void toggleAi()}
            title={
              aiState?.aiEnabled === false
                ? "AI agent is paused for this conversation — click to re-enable"
                : "AI agent can reply in this conversation — click to pause"
            }
            style={{ opacity: aiState?.aiEnabled === false ? 0.6 : 1 }}
          >
            <Sparkles size={15} color={aiState?.aiEnabled === false ? "#94a3b8" : "#00a884"} />
            <span>{aiState?.aiEnabled === false ? "AI paused" : "AI on"}</span>
          </button>
          <button
            className="ghost-btn"
            onClick={() => void load()}
            title="Refresh messages"
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {error && <div className="error" style={{ margin: "0.5rem 1rem" }}>{error}</div>}

      {optedOut && !error && (
        <div
          style={{
            margin: "0.5rem 1rem",
            padding: "0.6rem 0.85rem",
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: "8px",
            color: "#9a3412",
            fontSize: "0.8125rem",
          }}
        >
          This contact opted out by replying STOP. Sending is disabled until they message you again, or you remove the
          <code style={{ background: "#ffedd5", padding: "0 0.25rem", borderRadius: "4px" }}> opted_out </code>
          tag from Contacts.
        </div>
      )}

      <div className="msg-list">
        <div style={{ textAlign: "center", margin: "0.75rem 0", userSelect: "none" }}>
          <span
            style={{
              background: "#ffffff",
              color: "#64748b",
              fontSize: "0.6875rem",
              fontWeight: 600,
              padding: "0.3rem 0.75rem",
              borderRadius: "8px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            🔒 End-to-end encrypted via WhatsApp Business Cloud API
          </span>
        </div>

        {messages.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {attachment && (
        <div className="attach-bar">
          {attachment.previewUrl ? (
            <img src={attachment.previewUrl} alt="Attachment" className="attach-thumb" />
          ) : (
            <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={20} color="#00a884" />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="small ellipsis" style={{ fontWeight: 600 }}>{attachment.fileName}</div>
            <div className="muted tiny" style={{ textTransform: "uppercase" }}>{attachment.kind} attached</div>
          </div>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setAttachment(null)}
            title="Remove attachment"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <form className="composer" onSubmit={onSend}>
        <label className="ghost-btn" title="Attach file or media" style={{ cursor: "pointer", borderRadius: "50%", padding: "0.6rem" }}>
          <Paperclip size={18} color="#54656f" />
          <input
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
            disabled={uploading}
            onChange={(e) => {
              void onAttach(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={attachment ? "Add a caption to this media…" : "Type a message…"}
          maxLength={4096}
        />

        <button type="submit" disabled={!canSend} title="Send WhatsApp Message">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
