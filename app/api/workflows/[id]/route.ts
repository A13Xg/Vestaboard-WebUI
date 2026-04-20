import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server-auth";
import { deleteWorkflow, getWorkflow, updateWorkflow } from "@/lib/workflow-store";
import type { WorkflowUpdateRequest } from "@/types";
import { unexpectedError } from "@/lib/api-error";
import { validateMessageText } from "@/lib/message-validation";

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const { id } = await context.params;
    const workflow = await getWorkflow(id);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    return NextResponse.json(workflow);
  } catch (err) {
    return unexpectedError("workflows.get", err);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const { id } = await context.params;
    const patch = (await req.json()) as WorkflowUpdateRequest;

    const existing = await getWorkflow(id);
    if (!existing) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const resultingDataSource = patch.dataSource !== undefined ? patch.dataSource : existing.dataSource;
    if (patch.message?.text !== undefined && !resultingDataSource) {
      const messageValidation = validateMessageText(patch.message.text, "flagship");
      if (!messageValidation.valid) {
        return NextResponse.json({ error: messageValidation.error }, { status: 400 });
      }

      patch.message.text = messageValidation.normalizedText;
    }

    const updated = await updateWorkflow(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    return unexpectedError("workflows.update", err);
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { isAuthenticated } = await requireSession();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing or invalid session cookie" }, { status: 401 });
    }

    const { id } = await context.params;
    const removed = await deleteWorkflow(id);
    if (!removed) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return unexpectedError("workflows.delete", err);
  }
}
