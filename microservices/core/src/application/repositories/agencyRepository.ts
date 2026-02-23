/**
 * AgencyRepository
 *
 * Data access for Agency entities — backed by Neon (serverless Postgres) via Drizzle ORM.
 * Pass a `db` instance to the constructor to inject a test database.
 */
import { eq, asc } from "drizzle-orm";
import {
  type Db,
  agencies,
  agencyRequiredFields,
  type AgencyRow,
  type AgencyRequiredFieldRow,
  getDb,
} from "@lettingsops/db";

export class AgencyRepository {
  static readonly key = "AgencyRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  async findById(agencyId: string): Promise<AgencyRow | null> {
    const [row] = await this.db
      .select()
      .from(agencies)
      .where(eq(agencies.id, agencyId))
      .limit(1);
    return row ?? null;
  }

  async getRequiredFields(agencyId: string): Promise<AgencyRequiredFieldRow[]> {
    const rows = await this.db
      .select()
      .from(agencyRequiredFields)
      .where(eq(agencyRequiredFields.agencyId, agencyId))
      .orderBy(asc(agencyRequiredFields.sortOrder));
    return rows;
  }
}
