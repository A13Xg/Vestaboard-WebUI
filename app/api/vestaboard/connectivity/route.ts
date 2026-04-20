import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server-auth";
import { checkVestaboardConnectivity } from "@/lib/vestaboard-server";
import { unexpectedError } from "@/lib/api-error";

export async function GET() {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const result = await checkVestaboardConnectivity();
    return NextResponse.json(result);
  } catch (err) {
    return unexpectedError("vestaboard.connectivity", err);
  }
}
