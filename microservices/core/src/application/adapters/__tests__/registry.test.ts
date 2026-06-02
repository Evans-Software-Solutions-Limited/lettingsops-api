import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AgencyIntegrationsRow } from "@lettingsops/db";
import {
  getCrmAdapter,
  getSlotSourceAdapter,
  registerCrmAdapter,
  registerSlotSourceAdapter,
  clearRegisteredAdapters,
  invalidateAgencyIntegrationsCache,
  UnknownAdapterKindError,
  CONFIG_CACHE_TTL_MS,
  type AdapterFactoryContext,
} from "../registry";
import { AgencyIntegrationsRepository } from "../../repositories/agencyIntegrationsRepository";
import { setSecretReader } from "../credentials";
import type { CrmAdapter } from "../crm/crmAdapter";
import type { SlotSourceAdapter } from "../booking/slotSourceAdapter";

const AGENCY = "agency-1";

function fakeCrm(kind: string): CrmAdapter {
  return {
    kind,
    pushLead: vi.fn(async () => ({ externalId: "x" })),
    updateLeadStatus: vi.fn(async () => {}),
    pushQualification: vi.fn(async () => {}),
    pushViewing: vi.fn(async () => ({ externalId: "x" })),
  };
}

function fakeSlot(kind: string): SlotSourceAdapter {
  return {
    kind,
    getAvailableSlots: vi.fn(async () => []),
    bookSlot: vi.fn(async () => ({
      externalEventId: "e",
      confirmedAt: "2026-06-02T00:00:00.000Z",
    })),
    cancelSlot: vi.fn(async () => {}),
  };
}

function configRow(
  over: Partial<AgencyIntegrationsRow>,
): AgencyIntegrationsRow {
  return {
    id: "cfg-1",
    agencyId: AGENCY,
    crmAdapterKind: "noop",
    crmCredentialsSecret: null,
    slotAdapterKind: "mock",
    slotCredentialsSecret: null,
    slotGranularityMinutes: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as AgencyIntegrationsRow;
}

describe("adapter registry", () => {
  beforeEach(() => {
    clearRegisteredAdapters();
    invalidateAgencyIntegrationsCache();
    setSecretReader(null);
    // Defaults Block D will register; the registry treats null config as
    // noop/mock, so both must be present for the default path to resolve.
    registerCrmAdapter("noop", () => fakeCrm("noop"));
    registerCrmAdapter("mock", () => fakeCrm("mock"));
    registerSlotSourceAdapter("mock", () => fakeSlot("mock"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setSecretReader(null);
  });

  describe("getCrmAdapter", () => {
    it("falls back to the noop default when no config row exists", async () => {
      vi.spyOn(
        AgencyIntegrationsRepository.prototype,
        "findForAgency",
      ).mockResolvedValue(null);

      const adapter = await getCrmAdapter(AGENCY);
      expect(adapter.kind).toBe("noop");
    });

    it("constructs the configured kind and passes config + null creds", async () => {
      const ctxSeen: AdapterFactoryContext[] = [];
      registerCrmAdapter("mock", (ctx) => {
        ctxSeen.push(ctx);
        return fakeCrm("mock");
      });
      const cfg = configRow({ crmAdapterKind: "mock" });
      vi.spyOn(
        AgencyIntegrationsRepository.prototype,
        "findForAgency",
      ).mockResolvedValue(cfg);

      const adapter = await getCrmAdapter(AGENCY);
      expect(adapter.kind).toBe("mock");
      expect(ctxSeen[0]).toEqual({
        agencyId: AGENCY,
        config: cfg,
        credentials: null,
      });
    });

    it("resolves credentials from the configured secret", async () => {
      setSecretReader(() => JSON.stringify({ bucket: "b1" }));
      const ctxSeen: AdapterFactoryContext[] = [];
      registerCrmAdapter("csv_export", (ctx) => {
        ctxSeen.push(ctx);
        return fakeCrm("csv_export");
      });
      vi.spyOn(
        AgencyIntegrationsRepository.prototype,
        "findForAgency",
      ).mockResolvedValue(
        configRow({
          crmAdapterKind: "csv_export",
          crmCredentialsSecret: "SomeSecret",
        }),
      );

      await getCrmAdapter(AGENCY);
      expect(ctxSeen[0]?.credentials).toEqual({ bucket: "b1" });
    });

    it("throws UnknownAdapterKindError for an unregistered kind", async () => {
      vi.spyOn(
        AgencyIntegrationsRepository.prototype,
        "findForAgency",
      ).mockResolvedValue(configRow({ crmAdapterKind: "reapit" }));

      await expect(getCrmAdapter(AGENCY)).rejects.toBeInstanceOf(
        UnknownAdapterKindError,
      );
      await expect(getCrmAdapter(AGENCY)).rejects.toMatchObject({
        port: "crm",
        kind: "reapit",
        agencyId: AGENCY,
      });
    });
  });

  describe("getSlotSourceAdapter", () => {
    it("falls back to the mock default when no config row exists", async () => {
      vi.spyOn(
        AgencyIntegrationsRepository.prototype,
        "findForAgency",
      ).mockResolvedValue(null);

      const adapter = await getSlotSourceAdapter(AGENCY);
      expect(adapter.kind).toBe("mock");
    });

    it("throws UnknownAdapterKindError for an unregistered slot kind", async () => {
      vi.spyOn(
        AgencyIntegrationsRepository.prototype,
        "findForAgency",
      ).mockResolvedValue(configRow({ slotAdapterKind: "outlook_365" }));

      await expect(getSlotSourceAdapter(AGENCY)).rejects.toMatchObject({
        port: "slot",
        kind: "outlook_365",
      });
    });
  });

  describe("config cache (10s TTL)", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("hits the DB once within the TTL window", async () => {
      const spy = vi
        .spyOn(AgencyIntegrationsRepository.prototype, "findForAgency")
        .mockResolvedValue(null);

      await getCrmAdapter(AGENCY);
      await getCrmAdapter(AGENCY);
      await getSlotSourceAdapter(AGENCY);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("reloads after the TTL expires", async () => {
      const spy = vi
        .spyOn(AgencyIntegrationsRepository.prototype, "findForAgency")
        .mockResolvedValue(null);

      await getCrmAdapter(AGENCY);
      vi.advanceTimersByTime(CONFIG_CACHE_TTL_MS + 1);
      await getCrmAdapter(AGENCY);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("reloads immediately after invalidation", async () => {
      const spy = vi
        .spyOn(AgencyIntegrationsRepository.prototype, "findForAgency")
        .mockResolvedValue(null);

      await getCrmAdapter(AGENCY);
      invalidateAgencyIntegrationsCache(AGENCY);
      await getCrmAdapter(AGENCY);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("keeps separate cache entries per agency", async () => {
      const spy = vi
        .spyOn(AgencyIntegrationsRepository.prototype, "findForAgency")
        .mockResolvedValue(null);

      await getCrmAdapter("agency-a");
      await getCrmAdapter("agency-b");
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
});
