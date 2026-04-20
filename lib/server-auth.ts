import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_OPTIONS } from "@/config/session";
import type { SessionData } from "@/types";

/** Returns the raw iron-session object. Use `requireSession()` in API routes instead. */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
}

/**
 * Server-side auth helper for API route handlers.
 * Returns `{ session, isAuthenticated }` — check `isAuthenticated` and return 401
 * if false. Using this instead of `getIronSession` directly keeps all session
 * configuration in one place.
 */
export async function requireSession() {
  const session = await getSession();
  return {
    session,
    isAuthenticated: !!session.isAuthenticated,
  };
}
