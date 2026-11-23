/**
 * PII-redacting structured JSON logger (Technical Design v1.0 sections 12 and 13).
 *
 * Excludes coordinates, passwords, cookies, QR credentials, Jev keys, and
 * free-text correction explanations from routine logs.
 */

const SENSITIVE_KEY =
  /password|secret|token|cookie|authorization|latitude|longitude|coords|coordinates|locationevidence|explanation|reason|message|apikey|api_key|pass/i;

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactSensitive(entry, depth + 1);
  }
  return out;
}

function emit(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test") return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...(redactSensitive(fields) as Record<string, unknown>),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logInfo(event: string, fields?: Record<string, unknown>): void {
  emit("info", event, fields);
}

export function logWarn(event: string, fields?: Record<string, unknown>): void {
  emit("warn", event, fields);
}

export function logError(event: string, fields?: Record<string, unknown>): void {
  emit("error", event, fields);
}
