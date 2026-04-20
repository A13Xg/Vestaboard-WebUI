import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_OPTIONS } from "@/config/session";
import type { SessionData } from "@/types";
import { unexpectedError } from "@/lib/api-error";

export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
    return NextResponse.json<SessionData>({
      isAuthenticated: session.isAuthenticated ?? false,
      authenticatedAt: session.authenticatedAt,
    });
  } catch (err) {
    return unexpectedError("auth.session", err);
  }
}
