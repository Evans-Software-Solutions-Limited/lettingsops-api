import { treaty } from "@elysiajs/eden";
import type { LettingsApi } from "@lettingsops/lettings-service";
import { getToken } from "./auth";

/**
 * Eden Treaty client for the LettingsOps API.
 *
 * The `onRequest` hook runs before every fetch and attaches the JWT from
 * localStorage if one is present. Once `AUTH_ENFORCED=true` is deployed
 * (Block F4), requests without a token will receive 401.
 *
 * Key lifecycle:
 *   - `setToken(jwt)` after login → all subsequent requests are authenticated
 *   - `clearToken()` on logout → requests become anonymous (401 in enforced mode)
 */
export const api = {
  lettings: treaty<LettingsApi>(import.meta.env.VITE_LETTINGS_API_URL, {
    onRequest(_path, options) {
      const token = getToken();
      if (token) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      return options;
    },
  }),
};
