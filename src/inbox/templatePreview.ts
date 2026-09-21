/** Highest {{n}} index in template body text. */
export function countVars(text: string): number {
  let max = 0;
  for (const m of text.matchAll(/\{\{(\d+)\}\}/g)) {
    max = Math.max(max, Number(m[1]));
  }
  return max;
}

/** Preview with {{n}} replaced by values[n-1]; missing kept as-is. */
export function renderPreview(text: string, values: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (match, n: string) => {
    const v = values[Number(n) - 1];
    return v !== undefined && v !== "" ? v : match;
  });
}

/** Full preview: positional {{1}} via values, named {{name}} via named map. */
export function renderPreviewFull(text: string, values: string[], named: Record<string, string>): string {
  const positional = renderPreview(text, values);
  return positional.replace(/\{\{([a-z_][a-z0-9_]*)\}\}/gi, (match, n: string) => {
    const key = n.toLowerCase();
    return named[key] ?? named[n] ?? match;
  });
}

interface StoredComponent {
  type?: string;
  format?: string;
  text?: string;
  example?: {
    body_text?: unknown;
    body_text_named_params?: Array<{ param_name?: string; example?: string }>;
    header_text?: unknown;
    header_handle?: unknown;
  };
}

function parseComponents(componentsJson: string | null): StoredComponent[] {
  if (!componentsJson) return [];
  try {
    const arr = JSON.parse(componentsJson) as StoredComponent[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Positional sample values from a BODY component example, if Meta provided them. */
export function extractExampleValues(componentsJson: string | null): string[] {
  const body = parseComponents(componentsJson).find((c) => c.type === "BODY" || c.type === "body");
  const ex = body?.example?.body_text;
  if (Array.isArray(ex) && ex.length > 0 && Array.isArray(ex[0])) {
    return (ex[0] as unknown[]).filter((x): x is string => typeof x === "string");
  }
  return [];
}

/** Named sample values ({param_name: example}) from a BODY component example. */
export function extractNamedExamples(componentsJson: string | null): Record<string, string> {
  const body = parseComponents(componentsJson).find((c) => c.type === "BODY" || c.type === "body");
  const params = body?.example?.body_text_named_params;
  const out: Record<string, string> = {};
  if (Array.isArray(params)) {
    for (const p of params) {
      if (p.param_name && typeof p.example === "string") out[p.param_name.toLowerCase()] = p.example;
    }
  }
  return out;
}

/** Sample header text values (TEXT headers with variables). */
export function extractHeaderExampleValues(componentsJson: string | null): string[] {
  const h = parseComponents(componentsJson).find((c) => c.type === "HEADER" || c.type === "header");
  const ex = (h?.example as { header_text?: unknown } | undefined)?.header_text;
  if (Array.isArray(ex)) return ex.filter((x): x is string => typeof x === "string");
  return [];
}

/** BODY text from stored components JSON (creation shape uses UPPERCASE types). */
export function extractBodyText(componentsJson: string | null): string | null {
  if (!componentsJson) return null;
  try {
    const arr = JSON.parse(componentsJson) as Array<{ type?: string; text?: string }>;
    if (!Array.isArray(arr)) return null;
    const body = arr.find((c) => c.type === "BODY" || c.type === "body");
    return typeof body?.text === "string" ? body.text : null;
  } catch {
    return null;
  }
}

export interface HeaderInfo {
  format: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
}

/** HEADER component from stored components JSON, if any. */
export function extractHeader(componentsJson: string | null): HeaderInfo | null {
  if (!componentsJson) return null;
  try {
    const arr = JSON.parse(componentsJson) as Array<{ type?: string; format?: string; text?: string }>;
    if (!Array.isArray(arr)) return null;
    const h = arr.find((c) => c.type === "HEADER" || c.type === "header");
    if (!h) return null;
    const format = (h.format ?? "TEXT").toUpperCase();
    if (format !== "TEXT" && format !== "IMAGE" && format !== "VIDEO" && format !== "DOCUMENT") {
      return { format: "TEXT", text: h.text };
    }
    return { format: format as HeaderInfo["format"], text: h.text };
  } catch {
    return null;
  }
}
