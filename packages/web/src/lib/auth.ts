/**
 * Lightweight token store backed by localStorage.
 *
 * Used by the Eden Treaty client to attach the JWT on every API request.
 * The token is a signed HS256 JWT issued by the backend (Block D/F).
 *
 * Never log or expose the raw token value — it is a bearer credential.
 */

const TOKEN_KEY = "lettingsops_jwt";

/** Persist a JWT after successful login. */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Return the stored JWT, or null if the user is not logged in. */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Remove the stored JWT (logout). */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** True when a token is present (does not validate the token). */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}
