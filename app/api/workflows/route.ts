import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server-auth";
import { createWorkflow, listWorkflows } from "@/lib/workflow-store";
import type { WorkflowCreateRequest } from "@/types";
import { unexpectedError } from "@/lib/api-error";
import { validateMessageText } from "@/lib/message-validation";

export async function GET() {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    return NextResponse.json(await listWorkflows());
  } catch (err) {
    return unexpectedError("workflows.list", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const body = (await req.json()) as WorkflowCreateRequest;

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Workflow name is required" }, { status: 400 });
    }
    if (!body.message?.text?.trim()) {
      return NextResponse.json({ error: "Workflow message text is required" }, { status: 400 });
    }
    if (!body.schedule?.type) {
      return NextResponse.json({ error: "Workflow schedule type is required" }, { status: 400 });
    }

    let messageText = body.message.text;
    if (!body.dataSource) {
      const messageValidation = validateMessageText(body.message.text, "flagship");
      if (!messageValidation.valid) {
        return NextResponse.json({ error: messageValidation.error }, { status: 400 });
      }
      messageText = messageValidation.normalizedText;
    }

    const created = await createWorkflow({
      name: body.name.trim(),
      enabled: !!body.enabled,
      message: {
        text: messageText,
        alignment: body.message.alignment ?? "center",
        style: body.message.style ?? "default",
        colorInserts: body.message.colorInserts ?? [],
      },
      dataSource: body.dataSource ?? null,
      schedule: body.schedule,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return unexpectedError("workflows.create", err);
  }
}
