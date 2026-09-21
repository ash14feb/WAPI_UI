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

export type RealtimeEvent = RealtimeMessageEvent | RealtimeCampaignEvent;

/**
 * Subscribes to the tenant SSE stream. EventSource cannot send headers,
 * so auth travels as ?token=. Auto-reconnects on drop (browser default).
 */
export function useRealtime(onEvent: (e: RealtimeEvent) => void): void {
  const latest = useRef(onEvent);
  latest.current = onEvent;

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const es = new EventSource(
      `${API_URL}/api/v1/realtime/events?token=${encodeURIComponent(token)}`,
    );
    es.onmessage = (msg) => {
      try {
        latest.current(JSON.parse(msg.data) as RealtimeEvent);
      } catch {
        // Ignore malformed frames (e.g. comments/pings).
      }
    };
    return () => es.close();
  }, []);
}
