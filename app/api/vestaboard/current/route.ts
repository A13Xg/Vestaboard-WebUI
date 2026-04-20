import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server-auth";
import { getCurrentDisplayLiveOrMock } from "@/lib/vestaboard-server";
import { unexpectedError } from "@/lib/api-error";

export async function GET() {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const display = await getCurrentDisplayLiveOrMock();
    return NextResponse.json(display);
  } catch (err) {
    return unexpectedError("vestaboard.current", err);
  }
}
