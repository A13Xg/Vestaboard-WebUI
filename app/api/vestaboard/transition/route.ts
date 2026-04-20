import { NextRequest, NextResponse } from "next/server";
import type { TransitionResponse, SetTransitionRequest } from "@/types";
import { unexpectedError } from "@/lib/api-error";
import { getTransitionSettings, setTransitionSettings } from "@/lib/transition-store";
import { requireSession } from "@/lib/server-auth";

const CLOUD_TRANSITION_URL = "https://cloud.vestaboard.com/transition";

function getApiToken() {
  return process.env.VESTABOARD_API_TOKEN;
}

async function fetchFromCloud(token: string): Promise<TransitionResponse | null> {
  try {
    const res = await fetch(CLOUD_TRANSITION_URL, {
      method: "GET",
      headers: {
        "X-Vestaboard-Token": token,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as TransitionResponse;
  } catch {
    return null;
  }
}

async function putToCloud(token: string, body: SetTransitionRequest): Promise<TransitionResponse | null> {
  try {
    const res = await fetch(CLOUD_TRANSITION_URL, {
      method: "PUT",
      headers: {
        "X-Vestaboard-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as TransitionResponse;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const token = getApiToken();
    if (token) {
      const live = await fetchFromCloud(token);
      if (live) {
        // Sync to local cache (non-blocking, best-effort)
        setTransitionSettings(live.transition, live.transitionSpeed).catch(() => {});
        return NextResponse.json<TransitionResponse>(live);
      }
    }

    // Fall back to locally stored settings
    const local = await getTransitionSettings();
    return NextResponse.json<TransitionResponse>(local);
  } catch (err) {
    return unexpectedError("vestaboard.transition.get", err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const body = (await req.json()) as SetTransitionRequest;
    const { transition, transitionSpeed } = body;

    const validStyles = ["classic", "wave", "drift", "curtain"];
    const validSpeeds = ["gentle", "fast"];
    if (!validStyles.includes(transition)) {
      return NextResponse.json({ error: `Invalid transition style. Must be one of: ${validStyles.join(", ")}` }, { status: 400 });
    }
    if (!validSpeeds.includes(transitionSpeed)) {
      return NextResponse.json({ error: `Invalid transition speed. Must be one of: ${validSpeeds.join(", ")}` }, { status: 400 });
    }

    // Always persist locally so the UI reflects the setting even if the cloud call fails
    await setTransitionSettings(transition, transitionSpeed);

    const token = getApiToken();
    if (token) {
      const live = await putToCloud(token, { transition, transitionSpeed });
      if (live) {
        return NextResponse.json<TransitionResponse>(live);
      }
    }

    return NextResponse.json<TransitionResponse>({ transition, transitionSpeed });
  } catch (err) {
    return unexpectedError("vestaboard.transition.put", err);
  }
}

