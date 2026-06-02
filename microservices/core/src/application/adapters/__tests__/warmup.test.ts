import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "@lettingsops/api-utils/logger";
import type { AgencyRow, AgencyIntegrationsRow } from "@lettingsops/db";
import { warmUpAdapters } from "../warmup";
import {
  registerCrmAdapter,
  registerSlotSourceAdapter,
  clearRegisteredAdapters,
  invalidateAgencyIntegrationsCache,
} from "../registry";
import { AgencyRepository } from "../../repositories/agencyRepository";
import { AgencyIntegrationsRepository } from "../../repositories/agencyIntegrationsRepository";
import { setSecretReader } from "../credentials";

function fakeCrm(kind: string) {
  return {
    kind,
    pushLead: vi.fn(),
    updateLeadStatus: vi.fn(),
    pushQualification: vi.fn(),
    pushViewing: vi.fn(),
  };
}
function fakeSlot(kind: string) {
  return {
    kind,
    getAvailableSlots: vi.fn(),
    bookSlot: vi.fn(),
    cancelSlot: vi.fn(),
  };
}

function configRow(
  over: Partial<AgencyIntegrationsRow>,
): AgencyIntegrationsRow {
  return {
    id: "cfg",
    agencyId: "a1",
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

describe("warmUpAdapters", () => {
  beforeEach(() => {
    clearRegisteredAdapters();
    invalidateAgencyIntegrationsCache();
    setSecretReader(null);
    registerCrmAdapter("noop", () => fakeCrm("noop"));
    registerSlotSourceAdapter("mock", () => fakeSlot("mock"));
    vi.spyOn(logger, "info").mockImplementation(() => {});
    vi.spyOn(logger, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setSecretReader(null);
  });

  it("resolves both adapters for every agency and logs readiness", async () => {
    vi.spyOn(AgencyRepository.prototype, "listAll").mockResolvedValue([
      { id: "a1" },
      { id: "a2" },
    ] as AgencyRow[]);
    vi.spyOn(
      AgencyIntegrationsRepository.prototype,
      "findForAgency",
    ).mockResolvedValue(null);

    await warmUpAdapters();

    const infoMsgs = (logger.info as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    );
    expect(infoMsgs).toContain("adapter warm-up: crm ready");
    expect(infoMsgs).toContain("adapter warm-up: slot source ready");
    // crm-ready + slot-ready per agency, plus start + complete.
    expect(
      (logger.info as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => c[0] === "adapter warm-up: crm ready",
      ),
    ).toHaveLength(2);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs an error (not a throw) for an unknown adapter kind", async () => {
    vi.spyOn(AgencyRepository.prototype, "listAll").mockResolvedValue([
      { id: "a1" },
    ] as AgencyRow[]);
    vi.spyOn(
      AgencyIntegrationsRepository.prototype,
      "findForAgency",
    ).mockResolvedValue(configRow({ crmAdapterKind: "reapit" }));

    await expect(warmUpAdapters()).resolves.toBeUndefined();

    const errMsgs = (logger.error as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    );
    expect(errMsgs).toContain("adapter warm-up: crm adapter failed to resolve");
    // The slot adapter (default "mock") still resolved fine.
    const infoMsgs = (logger.info as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    );
    expect(infoMsgs).toContain("adapter warm-up: slot source ready");
  });

  it("logs an error for an unknown slot kind while the crm still resolves", async () => {
    vi.spyOn(AgencyRepository.prototype, "listAll").mockResolvedValue([
      { id: "a1" },
    ] as AgencyRow[]);
    vi.spyOn(
      AgencyIntegrationsRepository.prototype,
      "findForAgency",
    ).mockResolvedValue(configRow({ slotAdapterKind: "outlook_365" }));

    await expect(warmUpAdapters()).resolves.toBeUndefined();

    const errMsgs = (logger.error as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    );
    expect(errMsgs).toContain(
      "adapter warm-up: slot source adapter failed to resolve",
    );
    const infoMsgs = (logger.info as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    );
    expect(infoMsgs).toContain("adapter warm-up: crm ready");
  });

  it("logs once and returns when listing agencies fails", async () => {
    vi.spyOn(AgencyRepository.prototype, "listAll").mockRejectedValue(
      new Error("db down"),
    );

    await expect(warmUpAdapters()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "adapter warm-up: failed to list agencies — skipping",
      expect.objectContaining({ errorName: "Error" }),
    );
  });

  it("does nothing harmful when there are no agencies", async () => {
    vi.spyOn(AgencyRepository.prototype, "listAll").mockResolvedValue(
      [] as AgencyRow[],
    );

    await warmUpAdapters();

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("adapter warm-up: starting", {
      agencyCount: 0,
    });
  });
});
