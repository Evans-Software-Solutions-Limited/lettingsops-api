import Elysia from "elysia";

export type SlotQuery = {
  propertyRef: string;
  from: string;
  to: string;
};

export type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
};

export const ViewingSlotsService = new Elysia({
  name: "ViewingSlotsService",
}).decorate("viewingSlotsService", {
  async getAvailableSlots(
    _agencyId: string,
    _query: SlotQuery,
  ): Promise<{ slots: Slot[] }> {
    // TODO: integrate with Google Calendar or Outlook Calendar API
    // Flow: fetch calendar events for propertyRef within date range,
    //       scoped to agencyId, return free slots as 30-min or 60-min windows
    throw new Error("Not implemented: calendar integration pending");
  },
});
