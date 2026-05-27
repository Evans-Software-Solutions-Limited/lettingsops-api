import Elysia from "elysia";
import { LeadRepository } from "../../repositories/leadRepository";
import { ViewingRepository } from "../../repositories/viewingRepository";
import { type AgencyScope } from "../../repositories/tenantScopedRepository";

export type BookViewingInput = {
  leadId: string;
  propertyRef: string;
  slotId: string;
};

export const ViewingBookService = new Elysia({
  name: "ViewingBookService",
}).decorate("viewingBookService", {
  async bookViewing(
    agencyId: AgencyScope,
    input: BookViewingInput,
  ): Promise<{
    viewingId: string;
    confirmedAt: string;
    calendarEventId?: string;
  }> {
    const leadRepo = new LeadRepository(undefined, agencyId);
    const viewingRepo = new ViewingRepository(undefined, agencyId);

    const lead = await leadRepo.findById(input.leadId);
    if (!lead) throw new Error(`Lead not found: ${input.leadId}`);

    // TODO: confirm slot is still available via calendar service
    // TODO: create Google Calendar / Outlook event
    const calendarEventId: string | undefined = undefined;

    const viewing = await viewingRepo.create({
      leadId: input.leadId,
      propertyRef: input.propertyRef,
      slotId: input.slotId,
      calendarEventId,
      confirmedAt: new Date().toISOString(),
    });

    await leadRepo.updateStatus(input.leadId, "VIEWING_BOOKED");

    return {
      viewingId: viewing.id,
      confirmedAt: viewing.confirmedAt,
      calendarEventId: viewing.calendarEventId,
    };
  },
});
