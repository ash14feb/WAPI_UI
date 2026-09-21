import type { ApiResult } from "./types";
import { sanitizeData } from "../utils/textUtils";

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "https://wapiapi.vercel.app";

const ACCESS_KEY = "wa.accessToken";
const REFRESH_KEY = "wa.refreshToken";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { success?: boolean; data?: { accessToken: string }; accessToken?: string };
    const token = json.data?.accessToken ?? json.accessToken;
    if (!token) return false;
    localStorage.setItem(ACCESS_KEY, token);
    return true;
  } catch {
    return false;
  }
}

export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { ...headers, ...init.headers },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("TIMEOUT", "Request timed out after 20 seconds. Please check your network connection.", 408);
    }
    const msg = err instanceof Error ? err.message : "Network error";
    throw new ApiError("NETWORK_ERROR", `Failed to connect to ${API_URL}: ${msg}`, 0);
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401 && !retried && getRefreshToken()) {
    const ok = await refreshAccessToken();
    if (ok) return api<T>(path, init, true);
    clearTokens();
  }

  let json: unknown;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      json = await res.json();
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const errObj = json as { success?: boolean; error?: { code?: string; message?: string; details?: unknown }; message?: string } | null;
    const code = errObj?.error?.code ?? `HTTP_${res.status}`;
    const message = errObj?.error?.message ?? errObj?.message ?? `Request failed with status ${res.status}`;
    const details = errObj?.error?.details;
    throw new ApiError(code, message, res.status, details);
  }

  // Handle standard envelope { success: true, data: T }
  const envelope = json as ApiResult<T> | null;
  if (envelope && typeof envelope === "object" && "success" in envelope) {
    if (!envelope.success) {
      const err = envelope as unknown as { error?: { code?: string; message?: string; details?: unknown } };
      throw new ApiError(err.error?.code ?? "ERROR", err.error?.message ?? "API reported failure", res.status, err.error?.details);
    }
    return sanitizeData(envelope.data);
  }

  // If the backend returns data directly
  return sanitizeData(json as T);
}

export interface UploadResult {
  handle: string;
  mimeType: string;
  size: number;
}

export async function uploadFile(
  path: string,
  file: File,
  purpose: "send" | "sample" = "send",
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}?purpose=${purpose}`, {
    method: "POST",
    headers,
    body: form,
  });

  const json = (await res.json()) as { success?: boolean; data?: UploadResult; handle?: string; mimeType?: string; size?: number; error?: { code?: string; message?: string } };
  if (!res.ok || json.success === false) {
    const msg = json.error?.message ?? "Media upload failed";
    throw new ApiError(json.error?.code ?? `HTTP_${res.status}`, msg, res.status);
  }
  if (json.data) return json.data;
  return {
    handle: json.handle ?? "",
    mimeType: json.mimeType ?? file.type,
    size: json.size ?? file.size,
  };
}
