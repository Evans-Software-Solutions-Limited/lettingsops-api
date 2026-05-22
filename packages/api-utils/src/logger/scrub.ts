/**
 * PII scrub.
 *
 * Per design §3.2: the redaction is shallow on the **key**, not deep on the
 * value. If a key matches the PII allowlist, its value is replaced with
 * `<redacted>` regardless of what the value is. We do not inspect strings for
 * email/phone-looking content — that's noisy and unreliable. We trust the call
 * site to use sane key names.
 *
 * Nested objects and arrays are walked so a PII key buried under a wrapper
 * (e.g. `{ tenant: { email: "…" } }`) still gets redacted.
 */

const REDACTED = "<redacted>";

/**
 * Default PII allowlist. The list is intentionally small and explicit —
 * extending it is a code-review decision, not a free-form addition. Adding a
 * new field that carries PII means adding its key here in the same PR.
 */
export const DEFAULT_PII_KEYS = new Set<string>([
  "email",
  "phone",
  "address",
  "name",
  "body",
  "transcript",
  "message",
  "extractedFields",
  "answers",
  "collectedFields",
]);

export interface ScrubOptions {
  /** Override the PII key set. Defaults to `DEFAULT_PII_KEYS`. */
  keys?: ReadonlySet<string>;
}

/**
 * Return a structurally-equivalent clone of `input` with PII keys redacted.
 * Returns `input` unchanged for non-object inputs (string, number, null, etc.).
 */
export function scrub<T>(input: T, options: ScrubOptions = {}): T {
  const keys = options.keys ?? DEFAULT_PII_KEYS;
  return scrubValue(input, keys) as T;
}

function scrubValue(value: unknown, keys: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, keys));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (keys.has(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = scrubValue(v, keys);
      }
    }
    return out;
  }
  return value;
}

/**
 * True for objects created from object literals or `Object.create(null)`.
 * False for class instances (Date, Error, Map, custom classes) — those are
 * treated as opaque values and not walked, which avoids exploding on internal
 * fields we don't recognise.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === null || proto === Object.prototype;
}
