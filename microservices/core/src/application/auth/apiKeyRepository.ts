/**
 * ApiKeyRepository
 *
 * Data access for server-to-server API keys.
 *
 * Raw keys are never stored. The caller (key-issuance handler) hashes the raw
 * key with sha-256 before passing it in via `create()`, and lookups happen by
 * hash via `findActive(keyHash)`. A key is "active" when `revoked_at IS NULL`.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { type Db, apiKeys, type ApiKeyRow, getDb } from "@lettingsops/db";

export interface CreateApiKeyInput {
  agencyId: string;
  name: string;
  keyHash: string;
  prefix: string;
}

export class ApiKeyRepository {
  static readonly key = "ApiKeyRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  async create(input: CreateApiKeyInput): Promise<ApiKeyRow> {
    const [row] = await this.db
      .insert(apiKeys)
      .values({
        agencyId: input.agencyId,
        name: input.name,
        keyHash: input.keyHash,
        prefix: input.prefix,
      })
      .returning();

    if (!row) throw new Error("Failed to create api key — no row returned");
    return row;
  }

  async findActive(keyHash: string): Promise<ApiKeyRow | null> {
    const [row] = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
      .limit(1);
    return row ?? null;
  }

  async revoke(id: string): Promise<void> {
    // Guard against double-revoke: only update rows that are still active.
    // Without `isNull(revokedAt)` in the WHERE, a second `revoke(id)` would
    // overwrite the original `revoked_at` timestamp and destroy the audit
    // trail for "when was this key killed?". The DB enforces idempotence.
    await this.db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)));
  }

  async touch(id: string): Promise<void> {
    // Mirror the `revoke()` guard. The auth flow is
    // `findActive(hash)` → validate → `touch(id)` with no row lock between
    // calls. A revoke that races in that window would otherwise leave
    // `last_used_at > revoked_at` — i.e. the audit log claiming the key was
    // used after it was killed. The WHERE filter no-ops the UPDATE at the
    // DB when the row is already revoked.
    await this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)));
  }

  async listForAgency(agencyId: string): Promise<ApiKeyRow[]> {
    return this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.agencyId, agencyId))
      .orderBy(desc(apiKeys.createdAt));
  }
}
