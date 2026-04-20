import type {
  Workflow,
  WorkflowCreateRequest,
  WorkflowListResponse,
  WorkflowRunResult,
  WorkflowRunResponse,
  WorkflowUpdateRequest,
} from "@/types";
import { computeNextRunAt, shouldRunNow } from "@/lib/workflow-scheduler";
import { sendMessageToVestaboard } from "@/lib/vestaboard-server";

type WorkflowState = {
  items: Workflow[];
};

declare global {
  // eslint-disable-next-line no-var
  var __workflowState: WorkflowState | undefined;
}

function getState(): WorkflowState {
  if (!global.__workflowState) {
    const now = new Date().toISOString();
    global.__workflowState = {
      items: [
        {
          id: "wf-1",
          name: "Morning Welcome",
          enabled: true,
          message: { text: "GOOD MORNING TEAM", alignment: "center", style: "default" },
          schedule: { type: "daily", timeHHMM: "09:00" },
          createdAt: now,
          updatedAt: now,
          nextRunAt: computeNextRunAt({ type: "daily", timeHHMM: "09:00" }),
          lastRunAt: null,
        },
      ],
    };
  }
  return global.__workflowState;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function listWorkflows(): WorkflowListResponse {
  const state = getState();
  return { workflows: clone(state.items) };
}

export function getWorkflow(id: string): Workflow | null {
  const state = getState();
  const workflow = state.items.find((w) => w.id === id);
  return workflow ? clone(workflow) : null;
}

export function createWorkflow(input: WorkflowCreateRequest): Workflow {
  const state = getState();
  const now = new Date().toISOString();

  const workflow: Workflow = {
    id: `wf-${Date.now()}`,
    name: input.name,
    enabled: input.enabled,
    message: input.message,
    schedule: input.schedule,
    createdAt: now,
    updatedAt: now,
    nextRunAt: input.enabled ? computeNextRunAt(input.schedule) : null,
    lastRunAt: null,
  };

  state.items.unshift(workflow);
  return clone(workflow);
}

export function updateWorkflow(id: string, patch: WorkflowUpdateRequest): Workflow | null {
  const state = getState();
  const index = state.items.findIndex((w) => w.id === id);
  if (index === -1) return null;

  const current = state.items[index];
  const next: Workflow = {
    ...current,
    ...patch,
    message: patch.message ? { ...current.message, ...patch.message } : current.message,
    schedule: patch.schedule ? { ...current.schedule, ...patch.schedule } : current.schedule,
    updatedAt: new Date().toISOString(),
  };

  next.nextRunAt = next.enabled ? computeNextRunAt(next.schedule) : null;
  state.items[index] = next;
  return clone(next);
}

export function deleteWorkflow(id: string): boolean {
  const state = getState();
  const before = state.items.length;
  state.items = state.items.filter((w) => w.id !== id);
  return before !== state.items.length;
}

async function runWorkflow(workflow: Workflow): Promise<WorkflowRunResult> {
  const send = await sendMessageToVestaboard({
    text: workflow.message.text,
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
  };
}

export async function runDueWorkflows(now: Date = new Date()): Promise<WorkflowRunResponse> {
  const state = getState();
  const due = state.items.filter((w) => w.enabled && w.nextRunAt && shouldRunNow(w.nextRunAt, now));

  const results: WorkflowRunResult[] = [];
  for (const workflow of due) {
    const result = await runWorkflow(workflow);
    results.push(result);

    const idx = state.items.findIndex((w) => w.id === workflow.id);
    if (idx !== -1) {
      state.items[idx].lastRunAt = result.runAt;
      state.items[idx].nextRunAt = computeNextRunAt(state.items[idx].schedule, new Date(result.runAt));
      state.items[idx].updatedAt = result.runAt;
    }
  }

  return {
    triggered: results.length,
    results,
  };
}

export async function runWorkflowById(id: string): Promise<WorkflowRunResult | null> {
  const state = getState();
  const workflow = state.items.find((w) => w.id === id);
  if (!workflow) return null;

  const result = await runWorkflow(workflow);
  const idx = state.items.findIndex((w) => w.id === id);
  if (idx !== -1) {
    state.items[idx].lastRunAt = result.runAt;
    state.items[idx].nextRunAt = computeNextRunAt(state.items[idx].schedule, new Date(result.runAt));
    state.items[idx].updatedAt = result.runAt;
  }

  return result;
}
