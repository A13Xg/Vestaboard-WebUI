import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_OPTIONS } from "@/config/session";
import type { SessionData, LogoutResponse } from "@/types";
import { unexpectedError } from "@/lib/api-error";

export async function POST() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
    session.destroy();
    return NextResponse.json<LogoutResponse>({ success: true });
  } catch (err) {
    return unexpectedError("auth.logout", err);
  }
}
