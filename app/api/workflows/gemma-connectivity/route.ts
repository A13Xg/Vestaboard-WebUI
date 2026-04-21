import { NextResponse } from "next/server";
import { unexpectedError } from "@/lib/api-error";
import { verifyGemmaConnectivity } from "@/lib/gemma-server";
import { requireSession } from "@/lib/server-auth";

export async function GET() {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const result = await verifyGemmaConnectivity();
    return NextResponse.json(result);
  } catch (err) {
    return unexpectedError("workflows.gemma-connectivity.get", err);
  }
}
