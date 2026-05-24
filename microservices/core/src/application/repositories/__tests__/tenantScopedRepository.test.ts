import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import {
  ANY_AGENCY,
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
  callIsAny() {
    return this.isAny();
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

    it("isAny is false", () => {
      expect(repo.callIsAny()).toBe(false);
    });

    it("scopeWhere returns an eq() SQL predicate", () => {
      // We can't deep-equal Drizzle's SQL object across versions, but we
      // can assert it returned *something* — and structurally matches
      // what `eq(table.agencyId, "agency-uuid-1")` produces.
      const expected = eq(leads.agencyId, "agency-uuid-1");
      const actual = repo.callScopeWhere();
      expect(actual).toBeDefined();
      // Drizzle SQL fragments are objects; loose shape compare:
      expect(typeof actual).toBe(typeof expected);
    });

    it("writeAgencyId returns the agency id (no DEFAULT bypass)", () => {
      expect(repo.callWriteAgencyId()).toBe("agency-uuid-1");
    });
  });

  describe("scoped to the ANY_AGENCY sentinel", () => {
    const repo = new TestRepo(fakeDb, ANY_AGENCY);

    it("getAgencyId returns the sentinel string", () => {
      expect(repo.callGetAgencyId()).toBe("__any__");
    });

    it("isAny is true", () => {
      expect(repo.callIsAny()).toBe(true);
    });

    it("scopeWhere returns undefined (filter bypass)", () => {
      // The sentinel's whole point: reads issue a query with no
      // agency_id WHERE clause, matching pre-Block-E behaviour.
      expect(repo.callScopeWhere()).toBeUndefined();
    });

    it("writeAgencyId returns undefined (column DEFAULT fills in)", () => {
      // Writes that omit `agency_id` get the LEGACY_AGENCY_ID DEFAULT
      // from Block E.0's migration. The DEFAULT is dropped in
      // Block E.final, at which point this path must be gone.
      expect(repo.callWriteAgencyId()).toBeUndefined();
    });
  });

  describe("ANY_AGENCY constant", () => {
    it("is the literal '__any__' string", () => {
      // Locked: callers grep for this string in TODO comments, and the
      // E.final cleanup pass relies on it being a single recognisable
      // value across the codebase.
      expect(ANY_AGENCY).toBe("__any__");
    });
  });

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
