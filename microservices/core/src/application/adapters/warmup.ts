/**
 * Cold-start adapter warm-up (spec §2.2, C4).
 *
 * On Lambda cold start `api.ts` fires `void warmUpAdapters()`. For every
 * agency it resolves both configured adapters once. The point is twofold:
 *
 *   - **Fail loud, early.** An unknown / misconfigured adapter kind
 *     (`agency_integrations.crm_adapter_kind` pointing at a kind no
 *     module registered, or a credential secret that was never linked)
 *     surfaces here as a logged `error` line — which the CloudWatch
 *     `level=error` metric filter turns into an alarm — instead of
 *     500ing the first live request that happens to need it.
 *   - **Prime the cache.** Each resolve populates the registry's 10s
 *     config cache, so the first real request for that agency skips the
 *     DB round-trip.
 *
 * Strictly non-blocking and fully defensive: every failure is caught and
 * logged per-agency, so one bad row can't abort the sweep, and the
 * function never throws. Listing agencies failing (DB down at init)
 * logs once and returns — the API still serves; adapters resolve lazily
 * per request.
 *
 * SCALE NOTE: this is an O(agencies) sequential sweep on every cold
 * start (each agency's config is read once and then cached by the
 * registry). Fine at current tenant counts; if the agency table grows
 * into the hundreds, revisit — bound the sweep (e.g. warm only the N
 * most-recently-active agencies) or drop it in favour of pure lazy
 * resolution. The lazy path already works; warm-up is an optimisation +
 * an early-alarm, not a correctness requirement.
 */
import { logger, formatError } from "@lettingsops/api-utils/logger";
import type { Db } from "@lettingsops/db";
import { AgencyRepository } from "../repositories/agencyRepository";
import { getCrmAdapter, getSlotSourceAdapter } from "./registry";

export interface WarmUpOptions {
  /** Inject a db for tests; defaults to the ambient `getDb()`. */
  db?: Db;
}

async function warmAgency(agencyId: string, db?: Db): Promise<void> {
  try {
    const crm = await getCrmAdapter(agencyId, { db });
    logger.info("adapter warm-up: crm ready", {
      agencyId,
      port: "crm",
      kind: crm.kind,
    });
  } catch (err) {
    logger.error("adapter warm-up: crm adapter failed to resolve", {
      agencyId,
      port: "crm",
      ...formatError(err),
    });
  }

  try {
    const slot = await getSlotSourceAdapter(agencyId, { db });
    logger.info("adapter warm-up: slot source ready", {
      agencyId,
      port: "slot",
      kind: slot.kind,
    });
  } catch (err) {
    logger.error("adapter warm-up: slot source adapter failed to resolve", {
      agencyId,
      port: "slot",
      ...formatError(err),
    });
  }
}

export async function warmUpAdapters(opts: WarmUpOptions = {}): Promise<void> {
  const agencyRepo = new AgencyRepository(opts.db);

  let agencyIds: string[];
  try {
    const agencies = await agencyRepo.listAll();
    agencyIds = agencies.map((a) => a.id);
  } catch (err) {
    logger.error("adapter warm-up: failed to list agencies — skipping", {
      ...formatError(err),
    });
    return;
  }

  logger.info("adapter warm-up: starting", { agencyCount: agencyIds.length });

  for (const agencyId of agencyIds) {
    await warmAgency(agencyId, opts.db);
  }

  logger.info("adapter warm-up: complete", { agencyCount: agencyIds.length });
}
