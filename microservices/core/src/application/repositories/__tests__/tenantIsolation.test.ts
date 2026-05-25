import { describe, it, expect, vi } from "vitest";

// The global vitest setup mocks `@lettingsops/db` with stub column
// objects — fine for the per-repository unit tests where we don't care
// what drizzle composes internally. For *this* file we need the real
// `eq()` composition to inspect the resulting SQL fragments, so we
// bypass the mock and pull the actual schema.
vi.unmock("@lettingsops/db");
vi.doUnmock("@lettingsops/db");

import { LeadRepository } from "../leadRepository";
import { ViewingRepository } from "../viewingRepository";
import { QualificationRepository } from "../qualificationRepository";
import { ConversationRepository } from "../conversationRepository";
import { ANY_AGENCY } from "../tenantScopedRepository";
import type { Db } from "@lettingsops/db";

/**
 * Block E task E4 — tenant isolation contract matrix.
 *
 * Asserts the SQL-shape contract every tenant-scoped repository must
 * uphold:
 *
 *   - **Reads** (find/select/list): the WHERE predicate composed by the
 *     repo includes `agency_id` and the scoped agency's UUID when the
 *     repo is constructed with a real agency, and includes neither when
 *     constructed with the `ANY_AGENCY` sentinel.
 *   - **Writes** (insert): the value-set includes `agency_id` and the
 *     scoped agency's UUID when constructed with a real agency, and
 *     includes neither when constructed with the sentinel (letting the
 *     column DEFAULT fill in).
 *
 * The mock filter / values capture uses a `JSON.stringify`-based
 * fingerprint of the predicate object passed to `.where()` and the
 * record passed to `.values()`. Drizzle's `SQL` fragments are opaque
 * objects, but their internal `queryChunks` carry both the column
 * reference (which serialises to include the column name) and the
 * literal value being compared, so a `contains` check on the
 * fingerprint is enough to lock the contract.
 *
 * Two agencies are used to make sure the WHERE encodes the *right*
 * agency, not any agency.
 */

const AGENCY_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const AGENCY_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

interface Capture {
  wheres: unknown[];
  values: unknown[];
  sets: unknown[];
}

function makeCapturingDb(selectResult: unknown[] = []): {
  db: Db;
  capture: Capture;
} {
  const capture: Capture = { wheres: [], values: [], sets: [] };
  const chain: Record<string, unknown> = {};
  const promise = Promise.resolve(selectResult);

  for (const m of ["from", "limit", "offset", "orderBy", "leftJoin"]) {
    chain[m] = () => chain;
  }
  chain.where = (predicate: unknown) => {
    capture.wheres.push(predicate);
    return chain;
  };
  chain.values = (record: unknown) => {
    capture.values.push(record);
    return chain;
  };
  chain.set = (record: unknown) => {
    capture.sets.push(record);
    return chain;
  };
  chain.returning = () => promise;
  chain.then = (
    resolve: Parameters<Promise<unknown[]>["then"]>[0],
    reject?: Parameters<Promise<unknown[]>["then"]>[1],
  ) => promise.then(resolve, reject);
  chain.catch = (reject: Parameters<Promise<unknown[]>["catch"]>[0]) =>
    promise.catch(reject);

  const db = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
  } as unknown as Db;

  return { db, capture };
}

/**
 * Stringify a drizzle predicate / record into a stable fingerprint.
 *
 * Drizzle's `SQL` and column objects are densely cyclic (a column
 * references its table, which references the column back), so the
 * stringifier needs to break cycles. A per-call `WeakSet` does the
 * job without losing breadth.
 */
function fingerprint(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === "function") return "<fn>";
      if (typeof v === "symbol") return v.toString();
      if (typeof v === "bigint") return v.toString();
      if (typeof v === "object" && v !== null) {
        if (seen.has(v as object)) return "<circular>";
        seen.add(v as object);
      }
      return v;
    },
    0,
  );
}

/**
 * Did the captured WHERE predicate carry the agency UUID as a literal?
 *
 * Looking at the column NAME isn't enough: drizzle's column objects
 * carry the entire table schema as metadata, so `eq(leads.id, …)`
 * already includes "agency_id" in its fingerprint via the table ref.
 * The agency UUID literal, on the other hand, only appears when the
 * scope filter is actually composed in.
 */
function whereScopesTo(captured: unknown[], agencyId: string): boolean {
  if (captured.length === 0) return false;
  return fingerprint(captured).includes(agencyId);
}

/**
 * Inverse — used to check the sentinel path doesn't accidentally
 * compose a scope filter.
 */
function whereDoesNotScopeTo(captured: unknown[], agencyId: string): boolean {
  if (captured.length === 0) return true;
  return !fingerprint(captured).includes(agencyId);
}

/** Did the captured INSERT/SET record carry an `agencyId` field with the target value? */
function valuesCarry(
  captured: unknown[],
  agencyId: string,
): boolean {
  if (captured.length === 0) return false;
  const last = captured[captured.length - 1] as Record<string, unknown>;
  return last?.agencyId === agencyId;
}

/** Did the captured INSERT/SET record omit `agencyId` entirely (sentinel write path)? */
function valuesOmitAgencyId(captured: unknown[]): boolean {
  if (captured.length === 0) return false;
  const last = captured[captured.length - 1] as Record<string, unknown>;
  return last?.agencyId === undefined;
}

// ─── LeadRepository ──────────────────────────────────────────────────────────

describe("Tenant isolation: LeadRepository", () => {
  describe("reads — scoped to AGENCY_A", () => {
    it("findById WHERE includes agency_id = A", async () => {
      const { db, capture } = makeCapturingDb([]);
      const repo = new LeadRepository(db, AGENCY_A);
      await repo.findById("lead-1");
      expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
      expect(whereScopesTo(capture.wheres, AGENCY_B)).toBe(false);
    });

    it("findByEmail WHERE includes agency_id = A", async () => {
      const { db, capture } = makeCapturingDb([]);
      const repo = new LeadRepository(db, AGENCY_A);
      await repo.findByEmail("x@example.com");
      expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
    });

    it("findByMessageId scopes the communication_logs lookup", async () => {
      const { db, capture } = makeCapturingDb([]);
      const repo = new LeadRepository(db, AGENCY_A);
      await repo.findByMessageId("msg-1");
      // First (and only, since log was empty) WHERE is on communication_logs.
      expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
    });

    it("list WHERE includes agency_id = A", async () => {
      const { db, capture } = makeCapturingDb([]);
      const repo = new LeadRepository(db, AGENCY_A);
      await repo.list({ page: 1, limit: 10 });
      expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
    });

    it("updateStatus WHERE includes agency_id = A", async () => {
      const { db, capture } = makeCapturingDb([]);
      const repo = new LeadRepository(db, AGENCY_A);
      await repo.updateStatus("lead-1", "QUALIFIED");
      expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
    });

    it("updateScore WHERE includes agency_id = A", async () => {
      const { db, capture } = makeCapturingDb([]);
      const repo = new LeadRepository(db, AGENCY_A);
      await repo.updateScore("lead-1", 50, "MEDIUM");
      expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
    });
  });

  describe("reads — scoped to ANY_AGENCY sentinel", () => {
    it("findById does not compose any agency-scoped WHERE clause", async () => {
      const { db, capture } = makeCapturingDb([]);
      const repo = new LeadRepository(db, ANY_AGENCY);
      await repo.findById("lead-1");
      // No real agency UUID should leak in — neither A nor B.
      expect(whereDoesNotScopeTo(capture.wheres, AGENCY_A)).toBe(true);
      expect(whereDoesNotScopeTo(capture.wheres, AGENCY_B)).toBe(true);
    });

    it("list does not compose any agency-scoped WHERE clause", async () => {
      const { db, capture } = makeCapturingDb([]);
      const repo = new LeadRepository(db, ANY_AGENCY);
      await repo.list({ page: 1, limit: 10 });
      expect(whereDoesNotScopeTo(capture.wheres, AGENCY_A)).toBe(true);
      expect(whereDoesNotScopeTo(capture.wheres, AGENCY_B)).toBe(true);
    });
  });

  describe("writes — scoped to AGENCY_A", () => {
    it("create injects agencyId = A", async () => {
      const NOW = new Date();
      const { db, capture } = makeCapturingDb([
        {
          id: "lead-1",
          agencyId: AGENCY_A,
          name: "x",
          email: "x@x.com",
          source: "manual",
          status: "NEW",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]);
      const repo = new LeadRepository(db, AGENCY_A);
      await repo.create({
        name: "x",
        email: "x@x.com",
        source: "manual",
        status: "NEW",
      });
      expect(valuesCarry(capture.values, AGENCY_A)).toBe(true);
    });

    it("addNote injects agencyId = A on communication_logs", async () => {
      const { db, capture } = makeCapturingDb([]);
      const repo = new LeadRepository(db, AGENCY_A);
      await repo.addNote("lead-1", {
        source: "email",
        messageId: "m1",
        subject: "s",
        receivedAt: new Date().toISOString(),
      });
      expect(valuesCarry(capture.values, AGENCY_A)).toBe(true);
    });
  });

  describe("writes — scoped to ANY_AGENCY sentinel", () => {
    it("create omits agencyId so the column DEFAULT fills in", async () => {
      const NOW = new Date();
      const { db, capture } = makeCapturingDb([
        {
          id: "lead-1",
          agencyId: AGENCY_A,
          name: "x",
          email: "x@x.com",
          source: "manual",
          status: "NEW",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]);
      const repo = new LeadRepository(db, ANY_AGENCY);
      await repo.create({
        name: "x",
        email: "x@x.com",
        source: "manual",
        status: "NEW",
      });
      expect(valuesOmitAgencyId(capture.values)).toBe(true);
    });
  });
});

// ─── ViewingRepository ──────────────────────────────────────────────────────

describe("Tenant isolation: ViewingRepository", () => {
  it("findById WHERE includes agency_id = A", async () => {
    const { db, capture } = makeCapturingDb([]);
    const repo = new ViewingRepository(db, AGENCY_A);
    await repo.findById("viewing-1");
    expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
  });

  it("findByLeadId WHERE includes agency_id = A", async () => {
    const { db, capture } = makeCapturingDb([]);
    const repo = new ViewingRepository(db, AGENCY_A);
    await repo.findByLeadId("lead-1");
    expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
  });

  it("cancel WHERE includes agency_id = A", async () => {
    const { db, capture } = makeCapturingDb([]);
    const repo = new ViewingRepository(db, AGENCY_A);
    await repo.cancel("viewing-1");
    expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
  });

  it("create injects agencyId = A", async () => {
    const NOW = new Date();
    const { db, capture } = makeCapturingDb([
      {
        id: "viewing-1",
        agencyId: AGENCY_A,
        leadId: "l",
        propertyRef: "p",
        slotId: "s",
        confirmedAt: NOW,
        createdAt: NOW,
      },
    ]);
    const repo = new ViewingRepository(db, AGENCY_A);
    await repo.create({
      leadId: "l",
      propertyRef: "p",
      slotId: "s",
      confirmedAt: new Date().toISOString(),
    });
    expect(valuesCarry(capture.values, AGENCY_A)).toBe(true);
  });

  it("ANY_AGENCY sentinel reads do not include any agency UUID", async () => {
    const { db, capture } = makeCapturingDb([]);
    const repo = new ViewingRepository(db, ANY_AGENCY);
    await repo.findById("viewing-1");
    expect(whereDoesNotScopeTo(capture.wheres, AGENCY_A)).toBe(true);
    expect(whereDoesNotScopeTo(capture.wheres, AGENCY_B)).toBe(true);
  });
});

// ─── QualificationRepository ────────────────────────────────────────────────

describe("Tenant isolation: QualificationRepository", () => {
  it("findByLeadId WHERE includes agency_id = A", async () => {
    const { db, capture } = makeCapturingDb([]);
    const repo = new QualificationRepository(db, AGENCY_A);
    await repo.findByLeadId("lead-1");
    expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
  });

  it("create injects agencyId = A", async () => {
    const NOW = new Date();
    const { db, capture } = makeCapturingDb([
      {
        id: "q-1",
        agencyId: AGENCY_A,
        leadId: "l",
        answers: {},
        score: 50,
        category: "MEDIUM",
        createdAt: NOW,
      },
    ]);
    const repo = new QualificationRepository(db, AGENCY_A);
    await repo.create({
      leadId: "l",
      answers: {
        moveInDate: "2024-09-01",
        occupants: 1,
        employmentStatus: "employed",
        incomeBand: "30k_50k",
        hasPets: false,
        viewingAvailability: [],
      },
      score: 50,
      category: "MEDIUM",
    });
    expect(valuesCarry(capture.values, AGENCY_A)).toBe(true);
  });
});

// ─── ConversationRepository ─────────────────────────────────────────────────

describe("Tenant isolation: ConversationRepository", () => {
  it("findById WHERE includes agency_id = A", async () => {
    const { db, capture } = makeCapturingDb([]);
    const repo = new ConversationRepository(db, AGENCY_A);
    await repo.findById("conv-1");
    expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
  });

  it("findByAgencyAndEmail WHERE includes agency_id = A", async () => {
    const { db, capture } = makeCapturingDb([]);
    const repo = new ConversationRepository(db, AGENCY_A);
    await repo.findByAgencyAndEmail(AGENCY_A, "tenant@example.com");
    expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
  });

  it("findByAgencyAndEmail refuses a mismatched agencyId argument", async () => {
    // Defence-in-depth: a caller stale on the old per-method scope
    // should fail loudly rather than silently leak.
    const { db } = makeCapturingDb([]);
    const repo = new ConversationRepository(db, AGENCY_A);
    await expect(
      repo.findByAgencyAndEmail(AGENCY_B, "tenant@example.com"),
    ).rejects.toThrow(/does not match the repository scope/);
  });

  it("create injects agencyId = A", async () => {
    const { db, capture } = makeCapturingDb([
      {
        id: "conv-1",
        agencyId: AGENCY_A,
        tenantEmail: "t@x.com",
        conversationType: "OTHER",
        threadMessageIds: [],
        collectedFields: {},
        status: "active",
      },
    ]);
    const repo = new ConversationRepository(db, AGENCY_A);
    await repo.create({ tenantEmail: "t@x.com" });
    expect(valuesCarry(capture.values, AGENCY_A)).toBe(true);
  });

  it("create refuses the ANY_AGENCY sentinel (no DEFAULT on this table)", async () => {
    const { db } = makeCapturingDb([]);
    const repo = new ConversationRepository(db, ANY_AGENCY);
    await expect(
      repo.create({ tenantEmail: "t@x.com" }),
    ).rejects.toThrow(/requires a real agencyId/);
  });

  it("appendMessageId scopes the UPDATE by agencyId = A", async () => {
    // appendMessageId first does findById; mock a row so the path
    // proceeds to the UPDATE.
    const { db, capture } = makeCapturingDb([
      {
        id: "conv-1",
        agencyId: AGENCY_A,
        tenantEmail: "t@x.com",
        threadMessageIds: [],
      },
    ]);
    const repo = new ConversationRepository(db, AGENCY_A);
    await repo.appendMessageId("conv-1", "msg-001");
    // capture.wheres now has both the findById select and the
    // update — both must scope to A.
    expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
  });

  it("setCollectedFields WHERE includes agency_id = A", async () => {
    const { db, capture } = makeCapturingDb([]);
    const repo = new ConversationRepository(db, AGENCY_A);
    await repo.setCollectedFields("conv-1", { name: "x" });
    expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
  });

  it("markComplete WHERE includes agency_id = A", async () => {
    const { db, capture } = makeCapturingDb([]);
    const repo = new ConversationRepository(db, AGENCY_A);
    await repo.markComplete("conv-1");
    expect(whereScopesTo(capture.wheres, AGENCY_A)).toBe(true);
  });
});
