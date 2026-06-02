/**
 * Adapter registry — resolves the CRM and slot-source adapter for an
 * agency from its `agency_integrations` row.
 *
 *   getCrmAdapter(agencyId)        → CrmAdapter
 *   getSlotSourceAdapter(agencyId) → SlotSourceAdapter
 *
 * Resolution per spec §2.2:
 *   1. Read the agency's config (10s in-process TTL cache in front of
 *      `AgencyIntegrationsRepository.findForAgency`). A `null` row — an
 *      agency created before the Block B backfill — falls back to the
 *      safe defaults (`noop` CRM, `mock` slots).
 *   2. Look up the registered factory for that `kind`.
 *   3. Resolve the adapter's credentials from its configured SST secret
 *      (`credentials.ts`) and hand everything to the factory.
 *
 * Why a factory registry rather than the literal `switch` sketched in
 * the design: the reference adapters land in Block D. A `switch` that
 * named `new NoopCrmAdapter()` today wouldn't compile (the class doesn't
 * exist yet), and Block C must ship green. The registry is the seam
 * Block D plugs into — each adapter module calls `registerCrmAdapter` /
 * `registerSlotSourceAdapter` at import time, the same kind→constructor
 * mapping the `switch` expressed, but late-bound. It also keeps the
 * contract-test rule honest: an adapter that forgets to register itself
 * is an unknown kind, caught by warm-up (`warmup.ts`).
 *
 * An unknown kind throws {@link UnknownAdapterKindError}. On the
 * request path that bubbles; on the cold-start warm-up path it is
 * caught and alerted, so a misconfigured agency surfaces in logs/alarms
 * rather than 500ing a live request unexpectedly.
 *
 * ──────────────────────────────────────────────────────────────────────
 * Wiring contracts for Block F — read before hooking these into services:
 *
 *   1. RESOLUTION IS NOT COVERED BY THE RETRY GUARANTEE.
 *      `retryIntegrationCall` promises never to throw out of the caller,
 *      but resolving the adapter happens BEFORE that helper runs and CAN
 *      throw — `UnknownAdapterKindError`, or a credential-load failure
 *      from `loadCredentials`. So `await getCrmAdapter(...)` outside the
 *      retry `fn` re-introduces the "CRM misconfig 500s lead creation"
 *      failure mode the helper exists to prevent. Resolve the adapter
 *      INSIDE the `fn` you pass to `retryIntegrationCall` — a plain Error
 *      there is treated as permanent and recorded, never thrown:
 *
 *        retryIntegrationCall("crm.pushLead", async () => {
 *          const crm = await getCrmAdapter(agencyId);   // throws → captured
 *          return crm.pushLead(lead);
 *        }, { events, refId: lead.id });
 *
 *   2. INVALIDATE ON WRITE. The 10s TTL is the staleness ceiling, not a
 *      substitute for invalidation. The dashboard / service path that
 *      writes `agency_integrations` (via `AgencyIntegrationsRepository
 *      .update`) MUST call `invalidateAgencyIntegrationsCache(agencyId)`
 *      after the write, or a kind/secret change is ignored for up to the
 *      TTL. The repository deliberately does not call it itself — a data-
 *      access class shouldn't know about this in-process cache.
 * ──────────────────────────────────────────────────────────────────────
 *
 * Spec: `.kiro/specs/02-crm-and-booking-adapters/design.md` §2.2.
 */
import type { Db, AgencyIntegrationsRow } from "@lettingsops/db";
import { AgencyIntegrationsRepository } from "../repositories/agencyIntegrationsRepository";
import { loadCredentials } from "./credentials";
import type { CrmAdapter } from "./crm/crmAdapter";
import type { SlotSourceAdapter } from "./booking/slotSourceAdapter";

/** Safe defaults for an agency with no `agency_integrations` row. */
export const DEFAULT_CRM_KIND = "noop";
export const DEFAULT_SLOT_KIND = "mock";

/** In-process config cache TTL (spec §2.2). */
export const CONFIG_CACHE_TTL_MS = 10_000;

/**
 * Context handed to every adapter factory. `config` is the agency's
 * full row (or `null` when defaulting); `credentials` is the already-
 * resolved secret payload (or `null` when the adapter needs none).
 */
export interface AdapterFactoryContext {
  agencyId: string;
  config: AgencyIntegrationsRow | null;
  /** Resolved secret payload, or `null` when the adapter needs none. */
  credentials: unknown;
}

export type CrmAdapterFactory = (ctx: AdapterFactoryContext) => CrmAdapter;
export type SlotSourceAdapterFactory = (
  ctx: AdapterFactoryContext,
) => SlotSourceAdapter;

export class UnknownAdapterKindError extends Error {
  override name = "UnknownAdapterKindError";
  readonly port: "crm" | "slot";
  readonly kind: string;
  readonly agencyId: string;

  constructor(port: "crm" | "slot", kind: string, agencyId: string) {
    super(
      `No ${port} adapter registered for kind "${kind}" (agency ${agencyId}). ` +
        `Is the adapter module imported so it can register itself?`,
    );
    this.port = port;
    this.kind = kind;
    this.agencyId = agencyId;
  }
}

const crmFactories = new Map<string, CrmAdapterFactory>();
const slotFactories = new Map<string, SlotSourceAdapterFactory>();

/** Register a CRM adapter factory under its `kind`. Called at import time by Block D. */
export function registerCrmAdapter(
  kind: string,
  factory: CrmAdapterFactory,
): void {
  crmFactories.set(kind, factory);
}

/** Register a slot-source adapter factory under its `kind`. */
export function registerSlotSourceAdapter(
  kind: string,
  factory: SlotSourceAdapterFactory,
): void {
  slotFactories.set(kind, factory);
}

/** Drop all registered factories. Test seam — not used in production. */
export function clearRegisteredAdapters(): void {
  crmFactories.clear();
  slotFactories.clear();
}

interface CacheEntry {
  config: AgencyIntegrationsRow | null;
  expiresAt: number;
}

const configCache = new Map<string, CacheEntry>();

/**
 * Invalidate the config cache. Call after an `agency_integrations`
 * write so the next `getCrmAdapter` / `getSlotSourceAdapter` rebuilds
 * with the new kind/secret rather than serving a stale adapter for up
 * to the TTL. Pass an `agencyId` to evict one entry; omit to clear all.
 */
export function invalidateAgencyIntegrationsCache(agencyId?: string): void {
  if (agencyId === undefined) configCache.clear();
  else configCache.delete(agencyId);
}

async function loadConfig(
  agencyId: string,
  db?: Db,
): Promise<AgencyIntegrationsRow | null> {
  const now = Date.now();
  const cached = configCache.get(agencyId);
  if (cached !== undefined && cached.expiresAt > now) {
    return cached.config;
  }

  const repo = new AgencyIntegrationsRepository(db, agencyId);
  const config = await repo.findForAgency();
  configCache.set(agencyId, { config, expiresAt: now + CONFIG_CACHE_TTL_MS });
  return config;
}

export interface GetAdapterOptions {
  /** Inject a db for tests / warm-up; defaults to the ambient `getDb()`. */
  db?: Db;
}

export async function getCrmAdapter(
  agencyId: string,
  opts: GetAdapterOptions = {},
): Promise<CrmAdapter> {
  const config = await loadConfig(agencyId, opts.db);
  const kind = config?.crmAdapterKind ?? DEFAULT_CRM_KIND;
  const factory = crmFactories.get(kind);
  if (factory === undefined) {
    throw new UnknownAdapterKindError("crm", kind, agencyId);
  }
  const credentials = loadCredentials(config?.crmCredentialsSecret);
  return factory({ agencyId, config, credentials });
}

export async function getSlotSourceAdapter(
  agencyId: string,
  opts: GetAdapterOptions = {},
): Promise<SlotSourceAdapter> {
  const config = await loadConfig(agencyId, opts.db);
  const kind = config?.slotAdapterKind ?? DEFAULT_SLOT_KIND;
  const factory = slotFactories.get(kind);
  if (factory === undefined) {
    throw new UnknownAdapterKindError("slot", kind, agencyId);
  }
  const credentials = loadCredentials(config?.slotCredentialsSecret);
  return factory({ agencyId, config, credentials });
}
