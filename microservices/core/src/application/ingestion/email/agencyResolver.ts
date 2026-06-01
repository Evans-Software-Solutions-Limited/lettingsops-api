/**
 * Resolve an inbound email's recipient address to its owning agency.
 *
 * Shared between the SES → S3 → Lambda path (`microservices/core/src/
 * emailProcessor.ts`) and the HTTP webhook path
 * (`POST /webhooks/email`, used by external email-forwarder bridges).
 * Until this module existed both paths inlined a different version of
 * the query — the Lambda did the lookup, the HTTP wrapper fell through
 * the `ANY_AGENCY` sentinel because there was no shared resolver.
 *
 * Returns the `agency.id` UUID on a match, or `null` when no agency
 * owns the recipient address. Callers MUST treat `null` as an
 * authentication failure (HTTP 401), not a 500 — an unknown inbound
 * address is either a misrouted email or a spoofed webhook. See
 * `application/webhooks/CLAUDE.md` for the broader webhook policy.
 *
 * The implementation is read-only and tenant-blind by design (it spans
 * agencies). It MUST never be called from a request handler that
 * already has a resolved `auth.agencyId` — only the two ingest paths
 * that have no auth context.
 */
import { eq, sql } from "drizzle-orm";
import { type Db, agencies, getDb } from "@lettingsops/db";

export async function resolveAgencyFromInboundEmail(
  recipientEmail: string,
  db?: Db,
): Promise<string | null> {
  // Normalise the input before any DB work. Real-world inbound
  // recipients arrive in mixed case (`Lettings@Agency.com`), with
  // surrounding whitespace from header parsers, or via forwarders that
  // don't canonicalise — `eq()` is byte-exact and would 401 well-formed
  // traffic without this. The SQL side is normalised symmetrically
  // (`lower(agency.inboundEmail)`) so stored mixed-case rows still
  // match. Inspector Brad MEDIUM finding, PR #41.
  const normalised = recipientEmail.trim().toLowerCase();

  // Defensive: empty/whitespace-only input never matches. Returning
  // null here saves a round-trip and gives the caller a clean
  // "throw 401" shape without an extra guard at every callsite.
  if (!normalised) return null;

  const client = db ?? getDb();
  const [row] = await client
    .select({ id: agencies.id })
    .from(agencies)
    .where(eq(sql`lower(${agencies.inboundEmail})`, normalised))
    .limit(1);
  return row?.id ?? null;
}
