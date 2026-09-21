import type { ApiResult } from "./types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "https://wapiapi.vercel.app";

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
    const json = (await res.json()) as ApiResult<{ accessToken: string }>;
    if (!json.success) return false;
    localStorage.setItem(ACCESS_KEY, json.data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers, ...init.headers } });

  if (res.status === 401 && !retried && getRefreshToken()) {
    const ok = await refreshAccessToken();
    if (ok) return api<T>(path, init, true);
    clearTokens();
  }

  let json: ApiResult<T>;
  try {
    json = (await res.json()) as ApiResult<T>;
  } catch {
    throw new ApiError("NETWORK_ERROR", "Unable to reach the server", res.status);
  }
  if (!json.success) {
    throw new ApiError(json.error.code, json.error.message, res.status, json.error.details);
  }
  return json.data;
}

export interface UploadResult {
  handle: string;
  mimeType: string;
  size: number;
}

/** Multipart upload (FormData); auth via Bearer header, with one 401 retry.
 * purpose "send" (default) returns a numeric media id for send payloads;
 * purpose "sample" returns a resumable handle for template creation. */
export async function uploadFile(path: string, file: File, purpose: "send" | "sample" = "send"): Promise<UploadResult> {
  const doUpload = async (): Promise<Response> => {
    const form = new FormData();
    form.append("file", file);
    const headers: Record<string, string> = {};
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_URL}${path}?purpose=${purpose}`, { method: "POST", headers, body: form });
  };

  let res = await doUpload();
  if (res.status === 401 && getRefreshToken()) {
    const ok = await refreshAccessToken();
    if (ok) res = await doUpload();
  }
  let json: ApiResult<UploadResult>;
  try {
    json = (await res.json()) as ApiResult<UploadResult>;
  } catch {
    throw new ApiError("NETWORK_ERROR", "Unable to reach the server", res.status);
  }
  if (!json.success) throw new ApiError(json.error.code, json.error.message, res.status, json.error.details);
  return json.data;
}
