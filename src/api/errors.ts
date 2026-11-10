import { ApiError } from "./client";

export interface ExplainOptions {
  /** Headline prefix, e.g. "Template was not created". */
  action: string;
  /** Fallback when the error carries no message. */
  fallback: string;
}

export interface ExplainedError {
  title: string;
  message?: string;
  detail?: string;
}

interface MetaDetail {
  hint?: string;
  blameField?: string;
  traceId?: string;
  code?: number;
  subcode?: number;
}

function isMetaDetail(d: unknown): d is MetaDetail {
  return !!d && typeof d === "object" && ("hint" in d || "blameField" in d || "code" in d);
}

function metaFooter(d: MetaDetail): string | undefined {
  const parts: string[] = [];
  if (d.blameField) parts.push(`field: ${d.blameField}`);
  if (d.code !== undefined) parts.push(d.subcode !== undefined ? `code: ${d.code}/${d.subcode}` : `code: ${d.code}`);
  if (d.traceId) parts.push(`trace: ${d.traceId}`);
  return parts.length ? parts.join(" · ") : undefined;
}

/**
 * Turns an API failure into a headline + the exact provider message + supporting
 * detail, so the user knows precisely what to fix rather than a bare status code.
 */
export function explainApiError(err: unknown, { action, fallback }: ExplainOptions): ExplainedError {
  if (err instanceof ApiError) {
    if (err.code === "TIMEOUT" || err.code === "NETWORK_ERROR") {
      return { title: `${action}: network problem`, message: err.message };
    }
    if (err.code === "VALIDATION_ERROR" && err.details) {
      const issues = (err.details as { issues?: Array<{ field?: string; message?: string }> }).issues;
      if (Array.isArray(issues) && issues.length > 0) {
        const lines = issues.map((i) => (i.field ? `${i.field}: ${i.message ?? ""}` : (i.message ?? "")));
        return {
          title: action,
          message: lines[0],
          detail: lines.length > 1 ? lines.slice(1).join("\n") : undefined,
        };
      }
    }
    if (isMetaDetail(err.details)) {
      const d = err.details;
      const headline = d.hint ? `${action}: ${d.hint}` : `${action}: ${err.message}`;
      return {
        title: headline,
        message: d.hint ? `Meta said: ${err.message}` : undefined,
        detail: metaFooter(d),
      };
    }
    const code = err.code && err.code !== `HTTP_${err.status}` ? ` (${err.code})` : "";
    return { title: `${action}: ${err.message || fallback}${code}` };
  }
  if (err instanceof Error && err.message) return { title: `${action}: ${err.message}` };
  return { title: `${action}: ${fallback}` };
}
