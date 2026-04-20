import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_OPTIONS } from "@/config/session";
import type { SessionData } from "@/types";

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
}

export async function requireSession() {
  const session = await getSession();
  return {
    session,
    isAuthenticated: !!session.isAuthenticated,
  };
}
