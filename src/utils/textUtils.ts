const win1252Map: Record<number, number> = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
};

const charToByte = new Map<string, number>();
for (let i = 0; i < 256; i++) {
  charToByte.set(String.fromCharCode(i), i);
}
for (const [byte, code] of Object.entries(win1252Map)) {
  charToByte.set(String.fromCharCode(code), Number(byte));
}

function decodeChunk(chunk: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < chunk.length; i++) {
    const b = charToByte.get(chunk[i]);
    if (b === undefined) return chunk;
    bytes.push(b);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return chunk;
  }
}

/**
 * Repairs text that suffered from Mojibake (UTF-8 bytes misread as Windows-1252 / ISO-8859-1).
 * For instance: 'ðŸŽ‰' becomes '🎉', 'âœ¨' becomes '✨', 'ðŸš€' becomes '🚀'.
 */
export function fixMojibake(str: string): string {
  if (!str || typeof str !== "string") return str;

  const continuation =
    "[\\u0080-\\u00BF\\u0152\\u0153\\u0160\\u0161\\u0178\\u017D\\u017E\\u0192\\u02C6\\u02DC\\u2013\\u2014\\u2018\\u2019\\u201A\\u201C\\u201D\\u201E\\u2020\\u2021\\u2022\\u2026\\u2030\\u2039\\u203A\\u20AC\\u2122]";
  const mojibakeRegex = new RegExp(
    `(?:[\\u00C2-\\u00DF]${continuation}|[\\u00E0-\\u00EF]${continuation}{2}|[\\u00F0-\\u00F4]${continuation}{3})+`,
    "g",
  );

  let res = str.replace(mojibakeRegex, (match) => decodeChunk(match));
  if (mojibakeRegex.test(res)) {
    res = res.replace(mojibakeRegex, (match) => decodeChunk(match));
  }
  return res;
}

/**
 * Recursively cleans Mojibake text inside strings, objects, arrays, and serialized JSON strings.
 */
export function sanitizeData<T>(val: T): T {
  if (val == null) return val;
  if (typeof val === "string") {
    const fixed = fixMojibake(val);
    const trimmed = fixed.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(fixed);
        const sanitized = sanitizeData(parsed);
        return JSON.stringify(sanitized) as unknown as T;
      } catch {
        return fixed as unknown as T;
      }
    }
    return fixed as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeData(item)) as unknown as T;
  }
  if (typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = sanitizeData(v);
    }
    return out as unknown as T;
  }
  return val;
}
