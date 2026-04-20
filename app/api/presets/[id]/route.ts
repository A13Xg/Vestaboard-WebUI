import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server-auth";
import { deletePreset, updatePreset } from "@/lib/preset-store";
import type { PresetUpdateRequest } from "@/types";
import { unexpectedError } from "@/lib/api-error";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const { id } = await context.params;
    const patch = (await req.json()) as PresetUpdateRequest;
    const updated = await updatePreset(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message && !message.toLowerCase().includes("internal")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return unexpectedError("presets.update", err);
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const { id } = await context.params;
    const removed = await deletePreset(id);
    if (!removed) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return unexpectedError("presets.delete", err);
  }
}
