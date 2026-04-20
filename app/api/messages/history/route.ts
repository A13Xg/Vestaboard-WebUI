import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server-auth";
import { getMessageHistory } from "@/lib/message-history";
import { unexpectedError } from "@/lib/api-error";
import type { MessageHistoryResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 100;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 1000) : 100;

    const messages = await getMessageHistory(safeLimit);
    return NextResponse.json<MessageHistoryResponse>({ messages });
  } catch (err) {
    return unexpectedError("messages.history", err);
  }
}
