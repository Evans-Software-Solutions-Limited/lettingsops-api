import { createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import Elysia, { t } from "elysia";
import { logger } from "@lettingsops/api-utils/logger";
import { HttpError } from "../../auth/httpError";
import { ElevenLabsWebhookService } from "./elevenLabsWebhookService";

/**
 * Maximum allowed clock skew between the ElevenLabs-stamped timestamp
 * and the receiving Lambda's clock, in seconds. Five minutes mirrors
 * the typical Stripe/Slack tolerance — wide enough to absorb network +
 * Lambda cold-start, narrow enough that a captured signature can't be
 * replayed days later.
 */
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

/**
 * Validate the `ElevenLabs-Signature` header against the body using
 * HMAC-SHA256 keyed on `ELEVENLABS_WEBHOOK_SECRET`. Throws:
 *   - `HttpError(500)` when the env var isn't configured (operator
 *     misconfig; mirrors `JWT_SIGNING_KEY` + the email webhook guard).
 *     Kept distinct from 401 so the missing-config alarm can fire.
 *   - `HttpError(401)` on missing/malformed header, timestamp out of
 *     tolerance, or HMAC mismatch.
 *
 * Block I-PR-B+C 3rd-sweep fix; see Inspector Brad's MEDIUM finding on
 * PR #41 (signature parity with the email path). The webhook policy in
 * `application/webhooks/CLAUDE.md` mandates signature validation —
 * after I-PR-C wired `agentId → agency.id`, an attacker who guesses a
 * mapped `agentId` could otherwise inject leads into the target
 * agency's pipeline.
 */
export async function verifyElevenLabsSignature(
  request: Request,
): Promise<void> {
  const expected = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!expected) {
    logger.error("ELEVENLABS_WEBHOOK_SECRET env var not configured");
    throw new HttpError(500, "Webhook secret not configured");
  }

  const header = request.headers.get("elevenlabs-signature");
  if (!header) {
    logger.warn("ElevenLabs webhook signature missing");
    throw new HttpError(401, "Missing signature");
  }

  // Parse `t=<unix_seconds>,v0=<hex_signature>`. Tolerate arbitrary
  // ordering and ignore unknown components so a future format addition
  // (e.g. `v1=`) is forward-compatible.
  const parts = Object.fromEntries(
    header
      .split(",")
      .map((p) => p.trim().split("="))
      .filter((pair): pair is [string, string] => pair.length === 2),
  );
  const ts = parts["t"];
  const sig = parts["v0"];
  if (!ts || !sig) {
    logger.warn("ElevenLabs webhook signature malformed", {
      reason: "missing_t_or_v0",
    });
    throw new HttpError(401, "Malformed signature");
  }

  // Timestamp tolerance — using process.uptime() would be wrong here
  // (we need wall-clock). Date.now() is correct.
  const tsNum = Number.parseInt(ts, 10);
  if (!Number.isFinite(tsNum)) {
    logger.warn("ElevenLabs webhook signature malformed", {
      reason: "non_numeric_timestamp",
    });
    throw new HttpError(401, "Malformed signature");
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsNum) > SIGNATURE_TOLERANCE_SECONDS) {
    logger.warn("ElevenLabs webhook signature outside tolerance window", {
      tsSkewSeconds: nowSeconds - tsNum,
    });
    throw new HttpError(401, "Signature timestamp out of tolerance");
  }

  // Read body via `clone()` so the actual handler can still parse the
  // original. `await request.text()` would consume the stream and
  // break the schema-validated parse downstream.
  const rawBody = await request.clone().text();

  const computed = createHmac("sha256", expected)
    .update(`${ts}.${rawBody}`)
    .digest("hex");

  // Constant-time compare. Both must be the same length (hex of a
  // sha256 digest is always 64 bytes) before `timingSafeEqual` will
  // even accept them.
  const sigBuf = Buffer.from(sig);
  const compBuf = Buffer.from(computed);
  if (sigBuf.length !== compBuf.length || !timingSafeEqual(sigBuf, compBuf)) {
    logger.warn("ElevenLabs webhook signature mismatch");
    throw new HttpError(401, "Invalid signature");
  }
}

export const elevenLabsWebhookHandler = new Elysia()
  // Map HttpError to its HTTP status code. Block I-PR-C added the
  // `HttpError(401)` throw for unknown agentIds and the 3rd-sweep
  // commit added the `verifyElevenLabsSignature` throws above; without
  // this mapping any of them would surface as 500 (Elysia default) and
  // the upstream ElevenLabs caller would retry indefinitely. Same
  // pattern as the 7 business handlers; planned for promotion to a
  // global onError in api.ts under Block G's follow-up.
  .onError(({ error, set }) => {
    if (error instanceof HttpError) {
      set.status = error.status;
      return { error: error.message };
    }
  })
  // Verify the HMAC signature BEFORE schema validation so unauthorised
  // probes can't fingerprint the body shape via 422s.
  .onRequest(async ({ request }) => {
    await verifyElevenLabsSignature(request);
  })
  .use(ElevenLabsWebhookService)
  .post(
    "/webhooks/elevenlabs",
    async (ctx) => {
      return ctx.elevenLabsWebhookService.handleWebhook(ctx.body);
    },
    {
      body: t.Object({
        callId: t.String(),
        agentId: t.String(),
        intent: t.Union([
          t.Literal("viewing_enquiry"),
          t.Literal("maintenance"),
          t.Literal("rent_query"),
          t.Literal("other"),
        ]),
        extractedFields: t.Optional(
          t.Object({
            name: t.Optional(t.String()),
            email: t.Optional(t.String()),
            phone: t.Optional(t.String()),
            propertyRef: t.Optional(t.String()),
            moveInDate: t.Optional(t.String()),
          }),
        ),
        transcript: t.Optional(
          t.Array(
            t.Object({
              role: t.Union([t.Literal("agent"), t.Literal("user")]),
              message: t.String(),
              timestamp: t.String(),
            }),
          ),
        ),
        callDurationSeconds: t.Optional(t.Number()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          leadId: t.String(),
        }),
      },
    },
  );
