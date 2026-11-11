/**
 * Client-side checks mirroring the template-body rules Meta enforces before
 * review. Each rule returns a human-readable message, or null when it passes.
 */

const VAR = /\{\{\d+\}\}/g;
const VAR_ANY = /\{\{\d+\}\}/;

/** Characters Meta/our parser treats as invalid around a variable. */
const IRREGULAR_SPACE = /[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/;

/** Minimum static words required per variable (Meta error 2388293). */
const MIN_STATIC_WORDS_PER_VAR = 3;

export function hasIrregularWhitespace(text: string): boolean {
  return IRREGULAR_SPACE.test(text);
}

function stripVars(line: string): string {
  return line.replace(VAR, "").trim();
}

/** Letters/digits that count as real static text (emoji and punctuation don't). */
function staticWordCount(text: string): number {
  return text
    .replace(VAR, " ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function validateBodyPlacement(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (hasIrregularWhitespace(text)) {
    return "Body contains non-breaking or irregular spaces. Use normal spaces around variables and text.";
  }

  if (/^\{\{\d+\}\}/.test(trimmed)) {
    return "Body cannot start with a variable. Add text before it, e.g. \"Hi {{1}}, ...\".";
  }

  // Trailing punctuation alone ("... {{2}}.") is not enough — real words must follow.
  const lastVar = trimmed.match(/^[\s\S]*\{\{\d+\}\}/);
  if (lastVar) {
    const afterLastVar = trimmed.slice(lastVar[0].length);
    if (!/[\p{L}\p{N}]/u.test(afterLastVar)) {
      return "Body cannot end with a variable (punctuation alone is not enough). Add words after it, e.g. \"... {{2}}. Thank you!\".";
    }
  }

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const onlyVars = VAR_ANY.test(lines[i]) && stripVars(lines[i]) === "";
    if (onlyVars) {
      return `Line ${i + 1} contains only a variable. Each variable needs surrounding text, e.g. "Order: {{3}}".`;
    }
  }

  // e.g. "Hi {{1}}Your order" (no separator after) or "order#{{2}}" (none before)
  const dangling = /\{\{\d+\}\}(?=[^\s.,;:!?)\]}'"-])/g;
  const glue = /[^\s.,;:!?(\[{'"-]\{\{\d+\}\}/g;
  if (dangling.test(trimmed) || glue.test(trimmed)) {
    return "Variables must be separated from adjacent text by a space or punctuation, e.g. \"Hi {{1}}, your order…\".";
  }

  return null;
}

export function validateVariableDensity(text: string): string | null {
  const varCount = (text.match(VAR) ?? []).length;
  if (varCount === 0) return null;
  const words = staticWordCount(text);
  const needed = varCount * MIN_STATIC_WORDS_PER_VAR;
  if (words < needed) {
    return `Too many variables for the amount of text: ${varCount} variable(s) need at least ${needed} descriptive words (currently ${words}). Add explanation or reduce variables.`;
  }
  return null;
}

/** First failing rule for a UTILITY/MARKETING body, or null when all pass. */
export function validateTemplateBody(text: string): string | null {
  return validateBodyPlacement(text) ?? validateVariableDensity(text);
}

/** One entry per variable: variable, following character, and whether its spacing is clean. */
export interface VariableDetail {
  variable: string;
  before: string;
  after: string;
  clean: boolean;
}

export function inspectVariables(text: string): VariableDetail[] {
  const out: VariableDetail[] = [];
  for (const m of text.matchAll(VAR)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const before = text[start - 1] ?? "";
    const after = text[end] ?? "";
    const boundaryOk = (ch: string) => ch === "" || /[\s.,;:!?)\]}'"-]/.test(ch) || IRREGULAR_SPACE.test(ch);
    out.push({
      variable: m[0],
      before,
      after,
      clean: !IRREGULAR_SPACE.test(before) && !IRREGULAR_SPACE.test(after) && boundaryOk(before) && boundaryOk(after),
    });
  }
  return out;
}
