import { useCallback, useEffect, useRef, useState } from "react";
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
} from "lucide-react";

interface Ctx {
  onChanged: () => void;
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
    <span className="ticks" title="Sending…">
      <Clock size={13} color="#8696a0" />
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load conversation");
    }
  }, [conversationId]);

  useEffect(() => {
    setConversation(null);
    setMessages([]);
    setAttachment(null);
    void load();
  }, [load]);

  const onRealtime = useCallback(
    (e: RealtimeEvent) => {
      if (e.type !== "message.created" && e.type !== "message.updated") return;
      if (e.conversationId !== conversationId) return;
      if (e.type === "message.created") {
        setMessages((prev) => (prev.some((m) => m.id === e.message.id) ? prev : [...prev, e.message]));
        markSeen(e.conversationId);
      } else {
        setMessages((prev) => prev.map((m) => (m.id === e.message.id ? e.message : m)));
      }
      onChanged();
    },
    [conversationId, onChanged],
  );
  useRealtime(onRealtime);

  useEffect(() => {
    const t = setInterval(() => void load(), 60000);
    return () => clearInterval(t);
  }, [load]);

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
    setSending(true);
    setError(null);
    try {
      await api(`/api/v1/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify(
          attachment
            ? {
                mediaKind: attachment.kind,
                mediaId: attachment.mediaId,
                caption: text.trim() || undefined,
                filename: attachment.kind === "document" ? attachment.fileName : undefined,
              }
            : { text: text.trim() },
        ),
      });
      setText("");
      setAttachment(null);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (!conversationId) {
    return (
      <div className="center muted" style={{ height: "100%", flexDirection: "column", gap: "1rem", background: "#f8fafc" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "#e6f7f3", display: "flex", alignItems: "center", justifyContent: "center", color: "#00a884" }}>
          <Phone size={32} />
        </div>
        <div style={{ textAlign: "center" }}>
          <h3 style={{ fontSize: "1.25rem", color: "#0f172a", marginBottom: "0.25rem" }}>ImmerzoWAPI Shared Inbox</h3>
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
  const canSend = !sending && !uploading && (!!text.trim() || !!attachment);

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
            </div>
            <div className="muted tiny" style={{ fontFamily: "var(--font-mono)", color: "#64748b" }}>
              {conversation?.contact.phone}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
          <div key={m.id} className={`bubble ${m.direction === "OUTBOUND" ? "out" : "in"}`}>
            <MessageBody m={m} />
            <div
              className="bubble-meta"
              title={m.messageTimestamp ? new Date(m.messageTimestamp).toLocaleString() : statusLabel(m)}
            >
              <span>{timeAgo(m.messageTimestamp)}</span>
              {m.direction === "OUTBOUND" && (
                <Ticks status={m.status} />
              )}
            </div>
          </div>
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
            disabled={sending || uploading}
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
          {sending ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </form>
    </div>
  );
}
