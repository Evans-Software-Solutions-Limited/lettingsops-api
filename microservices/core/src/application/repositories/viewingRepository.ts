/**
 * ViewingRepository
 *
 * Data access for Viewing records.
 */

export type Viewing = {
  id: string;
  leadId: string;
  propertyRef: string;
  slotId: string;
  calendarEventId?: string;
  confirmedAt: string;
  cancelledAt?: string;
  createdAt: string;
};

export type CreateViewingInput = {
  leadId: string;
  propertyRef: string;
  slotId: string;
  calendarEventId?: string;
  confirmedAt: string;
};

export class ViewingRepository {
  static readonly key = "ViewingRepository";

  async create(input: CreateViewingInput): Promise<Viewing> {
    // TODO: implement with Drizzle ORM
    throw new Error("Not implemented: ViewingRepository.create");
  }

  async findById(id: string): Promise<Viewing | null> {
    // TODO: implement with Drizzle ORM
    throw new Error("Not implemented: ViewingRepository.findById");
  }

  async findByLeadId(leadId: string): Promise<Viewing[]> {
    // TODO: implement with Drizzle ORM
    throw new Error("Not implemented: ViewingRepository.findByLeadId");
  }

  async cancel(id: string): Promise<void> {
    // TODO: implement — set cancelledAt, remove calendar event
    throw new Error("Not implemented: ViewingRepository.cancel");
  }
}
