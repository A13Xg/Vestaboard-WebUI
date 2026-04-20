import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server-auth";
import { unexpectedError } from "@/lib/api-error";
import { buildWorkflowPreview } from "@/lib/workflow-integrations";
import type { WorkflowPreviewRequest, WorkflowPreviewResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const body = (await req.json()) as WorkflowPreviewRequest;
    if (!body.message?.text?.trim()) {
      return NextResponse.json({ error: "Workflow output template is required" }, { status: 400 });
    }

    const preview = await buildWorkflowPreview(body.message.text, body.dataSource ?? null);
    return NextResponse.json<WorkflowPreviewResponse>(preview);
  } catch (err) {
    return unexpectedError("workflows.preview.post", err);
  }
}
