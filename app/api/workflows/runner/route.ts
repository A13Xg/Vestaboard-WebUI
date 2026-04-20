import { NextRequest, NextResponse } from "next/server";
import { runDueWorkflows, runWorkflowById } from "@/lib/workflow-store";
import { requireSession } from "@/lib/server-auth";
import { unexpectedError } from "@/lib/api-error";

interface RunnerBody {
  /** "due" runs all overdue enabled workflows; "single" targets one workflow by id. */
  mode?: "due" | "single";
  workflowId?: string;
}

/**
 * Accepts the CRON_SECRET in either the `X-Cron-Secret` header or a Bearer token
 * so the route can be triggered both by Vercel Cron Jobs and custom schedulers.
 * When CRON_SECRET is not configured this always returns false (secret guard disabled).
 */
function hasCronSecret(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided = req.headers.get("x-cron-secret");
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  return provided === expected || bearer === expected;
}

/**
 * POST /api/workflows/runner
 * Dual-auth: accepts either a valid session cookie (browser/UI calls)
 * or the CRON_SECRET header (automated scheduler calls).
 * Body: `{ mode: "due" }` — runs all overdue workflows.
 * Body: `{ mode: "single", workflowId }` — runs one workflow immediately.
 */
export async function POST(req: NextRequest) {
  try {
    const { isAuthenticated } = await requireSession();
    const cronAuthorized = hasCronSecret(req);
    if (!isAuthenticated && !cronAuthorized) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing session and cron secret" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as RunnerBody;

    if (body.mode === "single") {
      if (!body.workflowId) {
        return NextResponse.json({ error: "workflowId is required for single mode" }, { status: 400 });
      }

      const result = await runWorkflowById(body.workflowId);
      if (!result) {
        return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
      }

      return NextResponse.json({ triggered: 1, results: [result] });
    }

    const due = await runDueWorkflows();
    return NextResponse.json(due);
  } catch (err) {
    return unexpectedError("workflows.runner.post", err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const cronAuthorized = hasCronSecret(req);
    const { isAuthenticated } = await requireSession();

    if (!cronAuthorized && !isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized", detail: "Missing session and cron secret" }, { status: 401 });
    }

    const due = await runDueWorkflows();
    return NextResponse.json(due);
  } catch (err) {
    return unexpectedError("workflows.runner.get", err);
  }
}
