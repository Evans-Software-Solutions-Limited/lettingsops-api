import { treaty } from "@elysiajs/eden";
import { type LettingsApi } from "@lettingsops/lettings-service";

export const api = {
  lettings: treaty<LettingsApi>(import.meta.env.VITE_LETTINGS_API_URL),
};
