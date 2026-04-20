import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server-auth";
import type { SendRequest, SendResponse } from "@/types";
import { sendMessageToVestaboard } from "@/lib/vestaboard-server";
import { unexpectedError } from "@/lib/api-error";
import { validateMatrix, validateMessageText } from "@/lib/message-validation";

/**
 * POST /api/vestaboard/send
 * Accepts either a `text` string (validated + converted to matrix server-side)
 * or a pre-built `matrix` array. One of the two must be present.
 * The request is proxied server-side so the Vestaboard API key is never exposed
 * to the browser.
 */
export async function POST(req: NextRequest) {
  try {
    const { isAuthenticated, session } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const body = (await req.json()) as SendRequest;

    const hasText = typeof body.text === "string" && body.text.trim().length > 0;
    const hasMatrix = Array.isArray(body.matrix)
      && body.matrix.length > 0
      && body.matrix.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "number"));

    if (!hasText && !hasMatrix) {
      return NextResponse.json<SendResponse>({ success: false, error: "Either text or matrix is required" }, { status: 400 });
    }

    if (hasText && !hasMatrix) {
      const textValidation = validateMessageText(body.text, body.boardModel === "note" ? "note" : "flagship");
      if (!textValidation.valid) {
        return NextResponse.json<SendResponse>({ success: false, error: textValidation.error }, { status: 400 });
      }
      body.text = textValidation.normalizedText;
    }

    if (hasMatrix && body.matrix) {
      const matrixValidation = validateMatrix(body.matrix);
      if (!matrixValidation.valid) {
        return NextResponse.json<SendResponse>({ success: false, error: matrixValidation.error }, { status: 400 });
      }
    }

    const submittedBy = body.submittedBy?.trim()
      || req.headers.get("x-submitted-by")
      || (session.authenticatedAt ? `session:${session.authenticatedAt}` : "authenticated-user");

    const sent = await sendMessageToVestaboard({
      ...body,
      submittedBy,
    }, {
      source: "manual",
    });
    if (!sent.success) {
      return NextResponse.json<SendResponse>(
        { success: false, error: sent.error, provider: sent.provider },
        { status: 502 }
      );
    }

    return NextResponse.json<SendResponse>({
      success: true,
      messageId: sent.messageId,
      provider: sent.provider,
    });
  } catch (err) {
    return unexpectedError("vestaboard.send", err);
  }
}
