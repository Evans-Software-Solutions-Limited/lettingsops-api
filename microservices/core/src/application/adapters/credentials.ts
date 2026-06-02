/**
 * Credential loader — resolves an adapter's credentials from the SST
 * secret named in `agency_integrations.{crm,slot}_credentials_secret`.
 *
 * Adapters take their credentials object in their constructor (Block D)
 * — there is no env-var sprinkling inside adapters. The registry
 * (`registry.ts`) calls `loadCredentials(cfg.crmCredentialsSecret)`
 * once at construction time and hands the result to the factory.
 *
 * How a secret name resolves to a value at runtime
 * ------------------------------------------------
 * SST v3 links secrets into the Lambda environment (see `infra/api.ts`,
 * e.g. `EMAIL_WEBHOOK_SECRET`). Reading `process.env[name]` is therefore
 * the same pattern every other secret in this codebase already uses. SST
 * additionally mirrors every linked resource into `SST_RESOURCE_<name>`
 * as a JSON blob (`{"value":"...","type":"Secret"}`), so the default
 * reader checks both forms.
 *
 * NOTE for Block D / infra: a per-agency credential secret (e.g.
 * `LettingsOpsGoogleServiceAccount`) must be linked into the API
 * function's environment in `infra/api.ts` before the adapter that
 * needs it goes live — exactly as the webhook secrets are. The noop /
 * mock adapters need no credentials, so the un-configured default path
 * (`crm_credentials_secret = NULL`) never reaches the reader.
 *
 * Spec: `.kiro/specs/02-crm-and-booking-adapters/design.md` §2.2.
 */

/**
 * Maps an SST secret name to its raw string value, or `undefined` when
 * the secret is not present in the runtime environment. Swappable in
 * tests via {@link setSecretReader} so suites never depend on real
 * secrets being linked.
 */
export type SecretReader = (secretName: string) => string | undefined;

/**
 * Default reader: prefers a directly-linked env var (the established
 * pattern), then falls back to the `SST_RESOURCE_<name>` JSON blob SST
 * injects for every linked resource.
 */
function envSecretReader(secretName: string): string | undefined {
  const direct = process.env[secretName];
  if (direct !== undefined) return direct;

  const blob = process.env[`SST_RESOURCE_${secretName}`];
  if (blob === undefined) return undefined;

  // SST stores `{"value":"<secret>","type":"Secret"}`. Pull `.value`
  // when the blob parses to that shape; otherwise hand back the raw
  // blob so a non-standard linkage still resolves to *something*.
  try {
    const parsed: unknown = JSON.parse(blob);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      typeof (parsed as { value?: unknown }).value === "string"
    ) {
      return (parsed as { value: string }).value;
    }
    return blob;
  } catch {
    return blob;
  }
}

let activeReader: SecretReader = envSecretReader;

/**
 * Override the secret reader (tests inject a fake; pass `null` to
 * restore the default env-backed reader). Kept tiny on purpose — the
 * registry never calls this, only test setup does.
 */
export function setSecretReader(reader: SecretReader | null): void {
  activeReader = reader ?? envSecretReader;
}

/**
 * Resolve the credentials for an adapter.
 *
 *   - `secretName` null / empty → `null` (the noop / mock default path:
 *     the adapter needs no credentials).
 *   - secret name set but the value is absent at runtime → throws. This
 *     is an operator misconfiguration (a kind was configured to need a
 *     secret that was never linked) and must surface loudly rather than
 *     silently constructing a credential-less adapter. The registry's
 *     caller decides what to do with the throw — the warm-up path
 *     (`warmup.ts`) catches and alerts; a request path lets it bubble.
 *   - value present → parsed as JSON when it parses, otherwise returned
 *     verbatim (a bare token like an API key is a valid credential).
 *
 * Generic over the credential shape so call sites read e.g.
 * `loadCredentials<{ bucket: string }>(name)`.
 */
export function loadCredentials<T = unknown>(
  secretName: string | null | undefined,
): T | null {
  if (!secretName) return null;

  const raw = activeReader(secretName);
  if (raw === undefined) {
    throw new Error(
      `Integration credentials secret "${secretName}" is configured but not present at runtime — link it in infra/api.ts`,
    );
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    // Not JSON — a bare string credential (API key, token). Hand it back
    // as-is; the adapter decides how to interpret its own credential type.
    return raw as unknown as T;
  }
}
