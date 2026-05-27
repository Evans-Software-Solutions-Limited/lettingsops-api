/**
 * API Keys handler — POST / GET / DELETE /api-keys
 *
 * Auth-protected (JWT or API key). Scoped to the caller's agency.
 * Webhook routes (email, ElevenLabs) must NOT use this handler.
 */
import Elysia, { t } from "elysia";
import { auth } from "../auth/authPlugin";
import { ApiKeysService } from "./apiKeysService";

export const apiKeysHandler = new Elysia()
  .use(auth)
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
