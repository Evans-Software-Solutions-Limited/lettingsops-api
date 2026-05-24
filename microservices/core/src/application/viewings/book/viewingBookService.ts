import Elysia from "elysia";
import { LeadRepository } from "../../repositories/leadRepository";
import { ViewingRepository } from "../../repositories/viewingRepository";
import { ANY_AGENCY } from "../../repositories/tenantScopedRepository";

export type BookViewingInput = {
  leadId: string;
  propertyRef: string;
  slotId: string;
};

export const ViewingBookService = new Elysia({
  name: "ViewingBookService",
}).decorate("viewingBookService", {
  async bookViewing(input: BookViewingInput): Promise<{
    viewingId: string;
    confirmedAt: string;
    calendarEventId?: string;
  }> {
    // TODO(F1): pass `ctx.auth.agencyId` once `.use(auth)` is mounted.
    const leadRepo = new LeadRepository(undefined, ANY_AGENCY);
    const viewingRepo = new ViewingRepository(undefined, ANY_AGENCY);

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
