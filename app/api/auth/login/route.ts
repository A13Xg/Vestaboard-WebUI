import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_OPTIONS } from "@/config/session";
import type { SessionData, LoginRequest, LoginResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LoginRequest;
    const { accessCode } = body;

    if (!accessCode || typeof accessCode !== "string") {
      return NextResponse.json<LoginResponse>({ success: false, error: "Access code is required" }, { status: 400 });
    }

    const validCode = process.env.ACCESS_CODE;
    if (!validCode) {
      console.error("ACCESS_CODE env var is not set");
      return NextResponse.json<LoginResponse>({ success: false, error: "Server misconfiguration" }, { status: 500 });
    }

    // Constant-time comparison to prevent timing attacks
    const isValid = timingSafeEqual(accessCode, validCode);
    if (!isValid) {
      // Artificial delay to slow brute-force
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json<LoginResponse>({ success: false, error: "Invalid access code" }, { status: 401 });
    }

    const session = await getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
    session.isAuthenticated = true;
    session.authenticatedAt = new Date().toISOString();
    await session.save();

    return NextResponse.json<LoginResponse>({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[auth.login]", err);
    return NextResponse.json<LoginResponse>({ success: false, error: `Internal server error: ${detail}` }, { status: 500 });
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
