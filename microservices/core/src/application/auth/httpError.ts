/**
 * HttpError — typed exception for "this request should not have got this
 * far" failures inside route handlers and plugins.
 *
 * The auth plugin throws this on bad credentials. A future `.onError` hook
 * in api.ts (Block F) maps the `status` to the response status code; until
 * then Elysia's default error handler emits a 500, which is fine for the
 * "auth is off by default" phase.
 *
 * Messages are operator-facing and must not embed PII — callers should
 * stick to fixed strings.
 */
export class HttpError extends Error {
  override name = "HttpError";

  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
