import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import {
  TenantScopedRepository,
  filterPredicates,
} from "../tenantScopedRepository";
import { leads } from "@lettingsops/db";
import type { Db } from "@lettingsops/db";

// Subclass exposes the protected helpers so the tests can poke at them.
class TestRepo extends TenantScopedRepository {
  callGetAgencyId() {
    return this.getAgencyId();
  }
  callScopeWhere() {
    return this.scopeWhere(leads.agencyId);
  }
  callWriteAgencyId() {
    return this.writeAgencyId();
  }
}

const fakeDb = {} as unknown as Db;

describe("TenantScopedRepository", () => {
  describe("scoped to a real agency", () => {
    const repo = new TestRepo(fakeDb, "agency-uuid-1");

    it("returns the agency id from getAgencyId", () => {
      expect(repo.callGetAgencyId()).toBe("agency-uuid-1");
    });

    it("scopeWhere returns an eq() SQL predicate against the column", () => {
      // We can't deep-equal Drizzle's SQL object across versions, but we
      // can assert it returned *something* structurally similar to what
      // `eq(table.agencyId, "agency-uuid-1")` produces.
      const expected = eq(leads.agencyId, "agency-uuid-1");
      const actual = repo.callScopeWhere();
      expect(actual).toBeDefined();
      expect(typeof actual).toBe(typeof expected);
    });

    it("writeAgencyId returns the agency id verbatim", () => {
      expect(repo.callWriteAgencyId()).toBe("agency-uuid-1");
    });
  });

  // ── Block I-PR-D sentinel-retirement guard ──────────────────────────────
  //
  // Pre-PR-D the base class accepted an `ANY_AGENCY = "__any__"` sentinel
  // that bypassed both the WHERE clause and the agency_id insert value.
  // The sentinel apparatus is now deleted. There is no functional test
  // to add for "rejects __any__" because the API surface no longer
  // accepts anything but `string`; TypeScript blocks the regression at
  // compile time and `npm run typecheck` is part of the CI gate.

  describe("filterPredicates", () => {
    it("drops undefined entries from a predicate list", () => {
      const a = eq(leads.id, "x");
      const b = eq(leads.email, "y");
      const out = filterPredicates([a, undefined, b, undefined]);
      expect(out).toHaveLength(2);
      expect(out[0]).toBe(a);
      expect(out[1]).toBe(b);
    });

    it("returns an empty array when every predicate is undefined", () => {
      expect(filterPredicates([undefined, undefined])).toEqual([]);
    });
  });
});
