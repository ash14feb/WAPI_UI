import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { api, ApiError, uploadFile } from "../api/client";
import type { Conversation, Message } from "../api/types";
import { useRealtime } from "../realtime/useRealtime";
import type { RealtimeEvent } from "../realtime/useRealtime";
import { markSeen, timeAgo } from "./InboxPage";

interface Ctx {
  onChanged: () => void;
}

function statusLabel(m: Message): string {
  if (m.direction === "INBOUND") return "";
  return m.status.charAt(0) + m.status.slice(1).toLowerCase();
}

/** WhatsApp-style ticks for outbound messages. */
function Ticks({ status }: { status: string }) {
  if (status === "READ") return <span className="ticks read" title="Read">✓<span className="overlap">✓</span></span>;
  if (status === "DELIVERED") return <span className="ticks" title="Delivered">✓<span className="overlap">✓</span></span>;
  if (status === "SENT") return <span className="ticks" title="Sent">✓</span>;
  if (status === "FAILED") return <span className="ticks failed" title="Failed">⚠</span>;
  return <span className="ticks" title="Sending">🕐</span>;
}

const MEDIA_LABEL: Record<string, string> = {
  IMAGE: "🖼 Image",
  VIDEO: "🎬 Video",
  DOCUMENT: "📄 Document",
  AUDIO: "🎵 Audio",
  STICKER: "⭐ Sticker",
};

function MessageBody({ m }: { m: Message }) {
  const label = MEDIA_LABEL[m.messageType];
  if (!label) return <div className="bubble-text">{m.textContent ?? ""}</div>;
  return (
    <div className="bubble-text">
      <div className="muted small">{label}</div>
      {m.textContent && <div style={{ marginTop: "0.25rem" }}>{m.textContent}</div>}
    </div>
  );
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
        api<Message[]>(`/api/v1/conversations/${conversationId}/messages`),
      ]);
      setConversation(conv);
      setMessages(msgs);
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

  // Live-merge events for the open conversation; slow refresh as fallback.
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
    return <div className="center muted">Select a conversation to start messaging.</div>;
  }

  const name =
    conversation?.contact.name ??
    conversation?.contact.profileName ??
    conversation?.contact.phone ??
    "…";

  const canSend = !sending && !uploading && (!!text.trim() || !!attachment);

  return (
    <div className="conv-detail">
      <header className="detail-header">
        <Link to="/inbox" className="back-link">←</Link>
        <div>
          <strong>{name}</strong>
          <div className="muted small">{conversation?.contact.phone}</div>
        </div>
        <button className="link-btn" onClick={() => void load()}>Refresh</button>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="msg-list">
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.direction === "OUTBOUND" ? "out" : "in"}`}>
            <MessageBody m={m} />
            <div
              className="bubble-meta muted tiny"
              title={m.messageTimestamp ? new Date(m.messageTimestamp).toLocaleString() : statusLabel(m)}
            >
              {timeAgo(m.messageTimestamp)}
              {m.direction === "OUTBOUND" && (
                <>
                  {" "}<Ticks status={m.status} />
                </>
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
            <span className="muted">📎</span>
          )}
          <span className="small ellipsis">{attachment.fileName}</span>
          <button className="link-btn" onClick={() => setAttachment(null)}>Remove</button>
        </div>
      )}

      <form className="composer" onSubmit={onSend}>
        <label className="ghost-btn attach-btn" title="Attach image, video or document">
          📎
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
          placeholder={attachment ? "Add a caption…" : "Type a message…"}
          maxLength={4096}
        />
        <button type="submit" disabled={!canSend}>
          {sending ? "…" : uploading ? "⇪" : "Send"}
        </button>
      </form>
    </div>
  );
}
