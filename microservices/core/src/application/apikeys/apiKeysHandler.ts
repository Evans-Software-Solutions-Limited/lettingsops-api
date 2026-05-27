/**
 * API Keys handler — POST / GET / DELETE /api-keys
 *
 * **API-key-auth-only** (spec §F3). JWT principals (dashboard users) are
 * rejected with 403. This prevents an agent from minting a service credential
 * without a traceable operator action — an agent would be able to issue a key
 * under their own agencyId and then use it from an external process with no
 * audit trail back to their identity.
 *
 * Webhook routes (email, ElevenLabs) must NOT use this handler.
 */
import Elysia, { t } from "elysia";
import { auth } from "../auth/authPlugin";
import { HttpError } from "../auth/httpError";
import { ApiKeysService } from "./apiKeysService";

export const apiKeysHandler = new Elysia()
  .use(auth)
  // Map HttpError to its HTTP status code. Until a global onError hook is
  // wired in api.ts (planned for Block G), each handler that can throw
  // HttpError must carry its own mapping so callers get 401/403/404 rather
  // than the Elysia default 500.
  .onError(({ error, set }) => {
    if (error instanceof HttpError) {
      set.status = error.status;
      return { error: error.message };
    }
  })
  // ── Principal guard ────────────────────────────────────────────────────────
  .onBeforeHandle(({ auth: ctx }) => {
    if (ctx.principal !== "service") {
      throw new HttpError(
        403,
        "/api-keys requires API key authentication (x-api-key header)",
      );
    }
  })
  .use(ApiKeysService)
  // ── POST /api-keys — issue a new key ────────────────────────────────────
  .post(
    "/api-keys",
    async (ctx) => {
      return ctx.apiKeysService.createApiKey(ctx.auth.agencyId, ctx.body.label);
    },
    {
      body: t.Object({
        label: t.Optional(t.String({ maxLength: 120 })),
      }),
      response: {
        200: t.Object({
          id: t.String(),
          agencyId: t.String(),
          label: t.Nullable(t.String()),
          /** First 8 chars — lets the caller identify this key in the list. */
          prefix: t.String(),
          /** Shown once — caller must record immediately. */
          key: t.String(),
          createdAt: t.String(),
        }),
      },
    },
  )
  // ── GET /api-keys — list keys for caller's agency ───────────────────────
  .get(
    "/api-keys",
    async (ctx) => {
      const keys = await ctx.apiKeysService.listApiKeys(ctx.auth.agencyId);
      return { keys };
    },
    {
      response: {
        200: t.Object({
          keys: t.Array(
            t.Object({
              id: t.String(),
              agencyId: t.String(),
              label: t.Nullable(t.String()),
              /** First 8 chars — shown in the dashboard list view. */
              prefix: t.String(),
              lastUsedAt: t.Nullable(t.String()),
              revokedAt: t.Nullable(t.String()),
              createdAt: t.String(),
            }),
          ),
        }),
      },
    },
  )
  // ── DELETE /api-keys/:id — revoke a key ─────────────────────────────────
  .delete(
    "/api-keys/:id",
    async (ctx) => {
      await ctx.apiKeysService.revokeApiKey(ctx.auth.agencyId, ctx.params.id);
      return { revoked: true };
    },
    {
      params: t.Object({ id: t.String() }),
      response: {
        200: t.Object({ revoked: t.Boolean() }),
      },
    },
  );
