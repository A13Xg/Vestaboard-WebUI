import { NextRequest, NextResponse } from "next/server";
import type { PreviewRequest, PreviewResponse } from "@/types";
import { textToMatrix } from "@/lib/board-utils";
import { unexpectedError } from "@/lib/api-error";
import { validateMessageText } from "@/lib/message-validation";
import { BOARD_PROFILES } from "@/lib/board-model";
import { requireSession } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const body = (await req.json()) as PreviewRequest;
    const boardModel = body.boardModel === "note" ? "note" : "flagship";
    const validation = validateMessageText(body.text ?? "", boardModel);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const profile = BOARD_PROFILES[boardModel];

    // TODO: Call Vestaboard VBML or encode API to get accurate matrix
    const matrix = textToMatrix(
      validation.normalizedText,
      profile.rows,
      profile.cols,
      body.alignment ?? "left",
    );

    return NextResponse.json<PreviewResponse>({
      matrix,
      valid: true,
      warnings: [],
    });
  } catch (err) {
    return unexpectedError("vestaboard.preview", err);
  }
}
