import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_OPTIONS } from "@/config/session";
import type { SessionData, TransitionResponse, SetTransitionRequest } from "@/types";
import { MOCK_TRANSITIONS, MOCK_TRANSITION_SETTINGS } from "@/lib/mock-data";
import { unexpectedError } from "@/lib/api-error";

export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    return NextResponse.json<TransitionResponse>({
      available: MOCK_TRANSITIONS,
      current: MOCK_TRANSITION_SETTINGS,
    });
  } catch (err) {
    return unexpectedError("vestaboard.transition.get", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const body = (await req.json()) as SetTransitionRequest;

    // TODO: Persist transition preference (e.g. database, KV store, or per-session)
    return NextResponse.json<TransitionResponse>({
      available: MOCK_TRANSITIONS,
      current: body,
    });
  } catch (err) {
    return unexpectedError("vestaboard.transition.post", err);
  }
}
