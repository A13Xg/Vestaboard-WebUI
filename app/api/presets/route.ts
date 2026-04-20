import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server-auth";
import { createPreset, listPresets } from "@/lib/preset-store";
import type { PresetCreateRequest } from "@/types";
import { unexpectedError } from "@/lib/api-error";

export async function GET() {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    return NextResponse.json(await listPresets());
  } catch (err) {
    return unexpectedError("presets.list", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const body = (await req.json()) as PresetCreateRequest;
    const created = await createPreset(body);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message && !message.toLowerCase().includes("internal")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return unexpectedError("presets.create", err);
  }
}
