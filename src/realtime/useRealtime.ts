import { useEffect, useRef } from "react";
import { API_URL, getAccessToken } from "../api/client";
import type { Message } from "../api/types";

export interface RealtimeMessageEvent {
  type: "message.created" | "message.updated";
  conversationId: string;
  message: Message;
}

export interface RealtimeCampaignEvent {
  type: "campaign.updated";
  campaignId: string;
  campaign: {
    id: string;
    status: string;
    total: number;
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
  };
}

export interface RealtimeConversationEvent {
  type: "conversation.updated";
  conversationId: string;
}

export type RealtimeEvent = RealtimeMessageEvent | RealtimeCampaignEvent | RealtimeConversationEvent;

type Listener = (e: RealtimeEvent) => void;

// One EventSource per tab, shared by every component that subscribes. Pages
// mount and unmount freely without tearing down the stream.
const listeners = new Set<Listener>();
let source: EventSource | null = null;
let sourceToken: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;

function dispatch(event: RealtimeEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // A faulty subscriber must not break delivery to the others.
    }
  }
}

function connect(): void {
  if (typeof EventSource === "undefined" || listeners.size === 0) return;
  const token = getAccessToken();
  if (!token) return;
  if (source && sourceToken === token) return;

  closeSource();
  sourceToken = token;
  const es = new EventSource(`${API_URL}/api/v1/realtime/events?token=${encodeURIComponent(token)}`);
  source = es;

  es.onmessage = (msg) => {
    try {
      dispatch(JSON.parse(msg.data) as RealtimeEvent);
    } catch {
      // Ignore malformed frames (e.g. comments/pings).
    }
  };
  es.onopen = () => {
    reconnectAttempt = 0;
  };
  es.onerror = () => {
    // The browser retries native errors itself; a CLOSED stream (401/network
    // failure after retries) needs a manual reconnect with fresh tokens.
    if (es.readyState !== EventSource.CLOSED) return;
    if (source === es) closeSource();
    if (listeners.size === 0) return;
    const delay = Math.min(1000 * 2 ** reconnectAttempt, 30000);
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(connect, delay);
  };
}

function closeSource(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  source?.close();
  source = null;
  sourceToken = null;
}

/**
 * Subscribes to the tenant SSE stream. EventSource cannot send headers,
 * so auth travels as ?token=.
 */
export function useRealtime(onEvent: (e: RealtimeEvent) => void): void {
  const latest = useRef(onEvent);
  latest.current = onEvent;

  useEffect(() => {
    const listener: Listener = (e) => latest.current(e);
    listeners.add(listener);
    connect();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) closeSource();
    };
  }, []);
}
