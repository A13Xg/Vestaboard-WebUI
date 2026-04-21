import { promises as fs } from "fs";
import path from "path";
import type {
  Workflow,
  WorkflowCreateRequest,
  WorkflowFile,
  WorkflowListResponse,
  WorkflowRunResult,
  WorkflowRunResponse,
  WorkflowUpdateRequest,
} from "@/types";
import { computeNextRunAt, shouldRunNow } from "@/lib/workflow-scheduler";
import { sendMessageToVestaboard } from "@/lib/vestaboard-server";
import { buildWorkflowPreview } from "@/lib/workflow-integrations";

const WORKFLOW_FILE_PATH = path.join(process.cwd(), "data", "workflows.json");
const WORKFLOW_DIR_PATH = path.dirname(WORKFLOW_FILE_PATH);

const DEFAULT_WORKFLOW_FILE: WorkflowFile = {
  version: 1,
  workflows: [],
};

/**
 * A global singleton promise chain used as a write-lock for the workflows JSON file.
 * Stored on `global` so it survives hot-reloads in Next.js dev mode. All mutations
 * funnel through `withWriteLock` to guarantee sequential, non-overlapping writes.
 */
declare global {
  // eslint-disable-next-line no-var
  var __workflowWriteQueue: Promise<void> | undefined;
}

async function ensureWorkflowFile() {
  await fs.mkdir(WORKFLOW_DIR_PATH, { recursive: true });
  try {
    await fs.access(WORKFLOW_FILE_PATH);
  } catch {
    await fs.writeFile(WORKFLOW_FILE_PATH, JSON.stringify(DEFAULT_WORKFLOW_FILE, null, 2), "utf8");
  }
}

async function readWorkflowFile(): Promise<WorkflowFile> {
  await ensureWorkflowFile();
  try {
    const raw = await fs.readFile(WORKFLOW_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<WorkflowFile>;
    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      workflows: Array.isArray(parsed.workflows) ? parsed.workflows : [],
    };
  } catch {
    return { ...DEFAULT_WORKFLOW_FILE };
  }
}

async function writeWorkflowFile(file: WorkflowFile) {
  await ensureWorkflowFile();
  await fs.writeFile(WORKFLOW_FILE_PATH, JSON.stringify(file, null, 2), "utf8");
}

/**
 * Serialises all write operations onto a single promise chain so concurrent
 * requests can never interleave mid-write and corrupt the JSON file.
 * `.catch(run)` means a failed predecessor never blocks future writes.
 */
async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  let out: T;
  const run = async () => {
    out = await fn();
  };

  global.__workflowWriteQueue = (global.__workflowWriteQueue ?? Promise.resolve())
    .then(run)
    .catch(run);

  await global.__workflowWriteQueue;
  return out!;
}

/** Deep-clones a value via JSON round-trip to avoid returning mutable internal state. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export async function listWorkflows(): Promise<WorkflowListResponse> {
  const file = await readWorkflowFile();
  return { workflows: clone(file.workflows) };
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const file = await readWorkflowFile();
  const workflow = file.workflows.find((item) => item.id === id);
  return workflow ? clone(workflow) : null;
}

export async function createWorkflow(input: WorkflowCreateRequest): Promise<Workflow> {
  return withWriteLock(async () => {
    const file = await readWorkflowFile();
    const now = new Date().toISOString();
    const workflow: Workflow = {
      id: `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name.trim(),
      enabled: !!input.enabled,
      message: input.message,
      dataSource: input.dataSource ?? null,
      schedule: input.schedule,
      createdAt: now,
      updatedAt: now,
      nextRunAt: input.enabled ? computeNextRunAt(input.schedule) : null,
      lastRunAt: null,
      lastExecution: null,
    };
    file.workflows.unshift(workflow);
    await writeWorkflowFile(file);
    return clone(workflow);
  });
}

export async function updateWorkflow(id: string, patch: WorkflowUpdateRequest): Promise<Workflow | null> {
  return withWriteLock(async () => {
    const file = await readWorkflowFile();
    const idx = file.workflows.findIndex((item) => item.id === id);
    if (idx === -1) return null;

    const current = file.workflows[idx];
    const next: Workflow = {
      ...current,
      ...patch,
      message: patch.message ? { ...current.message, ...patch.message } : current.message,
      schedule: patch.schedule ? { ...current.schedule, ...patch.schedule } : current.schedule,
      dataSource: patch.dataSource !== undefined ? patch.dataSource : current.dataSource,
      updatedAt: new Date().toISOString(),
    };

    next.nextRunAt = next.enabled ? computeNextRunAt(next.schedule) : null;
    file.workflows[idx] = next;
    await writeWorkflowFile(file);
    return clone(next);
  });
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const file = await readWorkflowFile();
    const before = file.workflows.length;
    file.workflows = file.workflows.filter((item) => item.id !== id);
    if (file.workflows.length === before) return false;
    await writeWorkflowFile(file);
    return true;
  });
}

/**
 * Resolves the workflow's data source, renders the message template, then posts
 * the resulting text to the Vestaboard API. Returns a run-result summary including
 * success/failure and the rendered text for audit logging.
 */
async function executeWorkflow(workflow: Workflow): Promise<WorkflowRunResult & { renderedText?: string }> {
  try {
    const preview = await buildWorkflowPreview(workflow.message.text, workflow.dataSource ?? null, {
      alignment: workflow.message.alignment,
    });
    const send = await sendMessageToVestaboard({
      text: preview.renderedText,
      matrix: preview.renderedMatrix,
      alignment: workflow.message.alignment,
      style: workflow.message.style,
      colorInserts: workflow.message.colorInserts,
      submittedBy: `workflow:${workflow.name}`,
    }, {
      source: "workflow",
      meta: {
        workflowId: workflow.id,
        workflowName: workflow.name,
      },
    });

    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      success: send.success,
      message: send.success ? "Message sent" : send.error ?? "Failed to send",
      runAt: new Date().toISOString(),
        renderedText: preview.renderedText,
      };
  } catch (error) {
    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      success: false,
      message: (error as Error).message,
      runAt: new Date().toISOString(),
      renderedText: undefined,
    };
  }
}

/**
 * Finds all enabled workflows whose `nextRunAt` is at or before `now`, executes
 * each one sequentially, then updates `lastRunAt` / `nextRunAt` in the store.
 * Called by the runner API route on each heartbeat tick.
 */
export async function runDueWorkflows(now: Date = new Date()): Promise<WorkflowRunResponse> {
  return withWriteLock(async () => {
    const file = await readWorkflowFile();
    const due = file.workflows.filter((item) => item.enabled && item.nextRunAt && shouldRunNow(item.nextRunAt, now));

    const results: WorkflowRunResult[] = [];
    for (const workflow of due) {
      const result = await executeWorkflow(workflow);
      results.push({
        workflowId: result.workflowId,
        workflowName: result.workflowName,
        success: result.success,
        message: result.message,
        runAt: result.runAt,
      });

      const idx = file.workflows.findIndex((item) => item.id === workflow.id);
      if (idx !== -1) {
        file.workflows[idx].lastRunAt = result.runAt;
        file.workflows[idx].nextRunAt = file.workflows[idx].enabled
          ? computeNextRunAt(file.workflows[idx].schedule, new Date(result.runAt))
          : null;
        file.workflows[idx].updatedAt = result.runAt;
        file.workflows[idx].lastExecution = {
          success: result.success,
          executedAt: result.runAt,
          renderedText: result.renderedText,
          summary: result.message,
          error: result.success ? undefined : result.message,
        };
      }
    }

    await writeWorkflowFile(file);
    return { triggered: results.length, results };
  });
}

export async function runWorkflowById(id: string): Promise<WorkflowRunResult | null> {
  return withWriteLock(async () => {
    const file = await readWorkflowFile();
    const idx = file.workflows.findIndex((item) => item.id === id);
    if (idx === -1) return null;

    const result = await executeWorkflow(file.workflows[idx]);
    file.workflows[idx].lastRunAt = result.runAt;
    file.workflows[idx].nextRunAt = file.workflows[idx].enabled
      ? computeNextRunAt(file.workflows[idx].schedule, new Date(result.runAt))
      : null;
    file.workflows[idx].updatedAt = result.runAt;
    file.workflows[idx].lastExecution = {
      success: result.success,
      executedAt: result.runAt,
      renderedText: result.renderedText,
      summary: result.message,
      error: result.success ? undefined : result.message,
    };
    await writeWorkflowFile(file);

    return {
      workflowId: result.workflowId,
      workflowName: result.workflowName,
      success: result.success,
      message: result.message,
      runAt: result.runAt,
    };
  });
}
