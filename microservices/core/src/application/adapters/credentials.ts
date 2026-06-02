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
 * SST secret names follow the `LettingsOps<Name>` convention (see
 * `infra/secrets.ts`). The default reader refuses to resolve any name
 * outside that namespace.
 *
 * Why: `agency_integrations.{crm,slot}_credentials_secret` is admin-set
 * data, not code. Without this guard, a stored value of `DATABASE_URL`,
 * `JWT_SIGNING_KEY`, or any other env var would be read straight out of
 * `process.env` and handed to the adapter as "credentials" — an
 * information-disclosure footgun where a DB value chooses which env var
 * to exfiltrate. Pinning to the `LettingsOps*` namespace means a config
 * value can only ever reach a secret deliberately provisioned under that
 * convention, never an unrelated runtime env var. Inspector Brad HIGH
 * finding, PR #46.
 *
 * The pattern also doubles as input validation — it rejects names with
 * whitespace, `${}`, path separators, or other shapes that have no
 * business indexing `process.env`.
 *
 * KNOWN RESIDUAL GAP (sweep 2): the namespace narrows the blast radius
 * from "any env var" to "any LettingsOps* secret" — it does NOT prove
 * the named secret is the *agency's own* credential. An admin could
 * still point `crm_credentials_secret` at a shared platform secret that
 * happens to be LettingsOps-prefixed. Closing that fully needs either a
 * dedicated per-agency-credential sub-namespace (e.g.
 * `LettingsOpsAgencyCred*`) or an allowlist keyed off the agency, both
 * of which depend on the Block D / infra secret-naming convention not
 * yet established. Tracked for Block D.
 */
const SECRET_NAME_PATTERN = /^LettingsOps[A-Za-z0-9_]+$/;

/**
 * Default reader: prefers a directly-linked env var (the established
 * pattern), then falls back to the `SST_RESOURCE_<name>` JSON blob SST
 * injects for every linked resource. Refuses any name outside the
 * `LettingsOps*` SST namespace (see {@link SECRET_NAME_PATTERN}).
 */
function envSecretReader(secretName: string): string | undefined {
  if (!SECRET_NAME_PATTERN.test(secretName)) {
    throw new Error(
      `Refusing to resolve credential secret "${secretName}": integration ` +
        `secret names must be in the LettingsOps* SST namespace.`,
    );
  }

  // Treat an empty string as absent: a secret linked but resolving to ""
  // is an operator error, and letting "" through would silently build a
  // credential-less adapter instead of hitting loadCredentials' loud
  // "configured but not present" throw. Inspector Brad finding, sweep 2.
  const direct = process.env[secretName];
  if (direct !== undefined && direct !== "") return direct;

  const blob = process.env[`SST_RESOURCE_${secretName}`];
  if (blob === undefined || blob === "") return undefined;

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
 * `loadCredentials<{ bucket: string }>(name)`. The `T` is an UNCHECKED
 * assertion — JSON parses to whatever the secret holds, and a bare
 * string is cast straight to `T`. The adapter that receives these
 * credentials MUST validate the shape before use; treat the return as
 * `unknown`-with-a-hint, not a guarantee.
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
