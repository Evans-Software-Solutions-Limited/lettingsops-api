/**
 * API Keys Service (Block F task F3)
 *
 * Provides create / list / revoke operations for API keys scoped to the
 * caller's agency. Callers must have resolved a real `agencyId` from their
 * auth context before calling any method — passing `null` will throw.
 *
 * Raw keys are returned **only** on creation; after that only the hash is
 * stored. The caller must record the raw key immediately.
 */
import Elysia from "elysia";
import { randomBytes, createHash } from "node:crypto";
import { getDb } from "@lettingsops/db";
import { ApiKeyRepository } from "../auth/apiKeyRepository";
import { HttpError } from "../auth/httpError";

export type CreatedApiKey = {
  id: string;
  agencyId: string;
  label: string | null;
  /** Raw key — shown only once. Not stored; store the hash only. */
  key: string;
  createdAt: string;
};

export type ApiKeyListItem = {
  id: string;
  agencyId: string;
  label: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Require a real (non-null) agencyId from the auth context. */
function requireAgencyId(agencyId: string | null): string {
  if (!agencyId) {
    throw new HttpError(
      401,
      "Authentication required to manage API keys",
    );
  }
  return agencyId;
}

export const ApiKeysService = new Elysia({
  name: "ApiKeysService",
}).decorate("apiKeysService", {
  /**
   * Issue a new API key for the caller's agency.
   * Returns the raw key ONCE — the caller must store it immediately.
   */
  async createApiKey(
    agencyId: string | null,
    label?: string,
  ): Promise<CreatedApiKey> {
    const resolvedAgencyId = requireAgencyId(agencyId);
    const repo = new ApiKeyRepository(getDb());

    // Generate 32 bytes of entropy → 64-char hex string
    const rawKey = randomBytes(32).toString("hex");
    const keyHash = sha256Hex(rawKey);

    const row = await repo.create({
      agencyId: resolvedAgencyId,
      keyHash,
      label: label ?? null,
    });

    return {
      id: row.id,
      agencyId: row.agencyId,
      label: row.label,
      key: rawKey,
      createdAt: row.createdAt.toISOString(),
    };
  },

  /** List all API keys (active + revoked) for the caller's agency. */
  async listApiKeys(agencyId: string | null): Promise<ApiKeyListItem[]> {
    const resolvedAgencyId = requireAgencyId(agencyId);
    const repo = new ApiKeyRepository(getDb());
    const rows = await repo.listForAgency(resolvedAgencyId);

    return rows.map((row) => ({
      id: row.id,
      agencyId: row.agencyId,
      label: row.label,
      lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  /** Revoke an API key by ID. The key must belong to the caller's agency. */
  async revokeApiKey(agencyId: string | null, keyId: string): Promise<void> {
    const resolvedAgencyId = requireAgencyId(agencyId);
    const repo = new ApiKeyRepository(getDb());

    // Verify ownership before revoking — listForAgency returns all keys for
    // this agency, so if the key isn't in the list it either doesn't exist or
    // belongs to a different agency.
    const rows = await repo.listForAgency(resolvedAgencyId);
    const owned = rows.some((r) => r.id === keyId);
    if (!owned) {
      throw new HttpError(404, `API key not found: ${keyId}`);
    }

    await repo.revoke(keyId);
  },
});
