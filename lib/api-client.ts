import type {
  ApiResult,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  CurrentDisplayResponse,
  PreviewRequest,
  PreviewResponse,
  SendRequest,
  SendResponse,
  Workflow,
  WorkflowCreateRequest,
  WorkflowListResponse,
  WorkflowRunResponse,
  WorkflowUpdateRequest,
  WorkflowPreviewRequest,
  WorkflowPreviewResponse,
  TransitionResponse,
  SetTransitionRequest,
  SessionData,
  MessageHistoryResponse,
  Preset,
  PresetCreateRequest,
  PresetListResponse,
  PresetUpdateRequest,
} from "@/types";
import { API_ROUTES } from "@/config";
import { pushClientLog } from "@/lib/client-logger";

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  const method = options?.method ?? "GET";
  try {
    pushClientLog("info", `${method} ${url} started`);
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });

    const rawText = await res.text();
    let json: any = null;
    try {
      json = rawText ? JSON.parse(rawText) : {};
    } catch {
      json = { raw: rawText };
    }

    if (!res.ok) {
      const detail = [
        `status=${res.status}`,
        json?.error ? `error=${json.error}` : "",
        json?.detail ? `detail=${json.detail}` : "",
      ]
        .filter(Boolean)
        .join("; ");
      pushClientLog("error", `${method} ${url} failed`, detail || "Request failed");
      return {
        data: null,
        error: { error: json.error ?? `Request failed (${res.status})`, code: String(res.status) },
      };
    }

    pushClientLog("success", `${method} ${url} succeeded`, `status=${res.status}`);
    return { data: json as T, error: null };
  } catch (err) {
    const message = (err as Error).message;
    pushClientLog("error", `${method} ${url} exception`, message);
    return { data: null, error: { error: message } };
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (body: LoginRequest) =>
    request<LoginResponse>(API_ROUTES.authLogin, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  logout: () =>
    request<LogoutResponse>(API_ROUTES.authLogout, { method: "POST" }),

  session: () => request<SessionData>(API_ROUTES.authSession),
};

// ─── Vestaboard ──────────────────────────────────────────────────────────────

export const boardApi = {
  current: () => request<CurrentDisplayResponse>(API_ROUTES.currentDisplay),

  preview: (body: PreviewRequest) =>
    request<PreviewResponse>(API_ROUTES.preview, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  send: (body: SendRequest) =>
    request<SendResponse>(API_ROUTES.send, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getTransition: () => request<TransitionResponse>(API_ROUTES.transitionGet),

  setTransition: (body: SetTransitionRequest) =>
    request<TransitionResponse>(API_ROUTES.transitionSet, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  connectivity: () =>
    request<{ connected: boolean; reason: string | null; statusCode: number }>(
      API_ROUTES.vestaboardConnectivity
    ),

  history: (limit = 100) =>
    request<MessageHistoryResponse>(`${API_ROUTES.messageHistory}?limit=${limit}`),
};

export const workflowApi = {
  list: () => request<WorkflowListResponse>(API_ROUTES.workflows),

  create: (body: WorkflowCreateRequest) =>
    request<Workflow>(API_ROUTES.workflows, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: WorkflowUpdateRequest) =>
    request<Workflow>(`${API_ROUTES.workflows}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  remove: (id: string) =>
    request<{ success: boolean }>(`${API_ROUTES.workflows}/${id}`, {
      method: "DELETE",
    }),

  runDue: () =>
    request<WorkflowRunResponse>(API_ROUTES.workflowsRunner, {
      method: "POST",
      body: JSON.stringify({ mode: "due" }),
    }),

  runById: (id: string) =>
    request<WorkflowRunResponse>(API_ROUTES.workflowsRunner, {
      method: "POST",
      body: JSON.stringify({ mode: "single", workflowId: id }),
    }),

  preview: (body: WorkflowPreviewRequest) =>
    request<WorkflowPreviewResponse>(API_ROUTES.workflowsPreview, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const presetApi = {
  list: () => request<PresetListResponse>(API_ROUTES.presets),

  create: (body: PresetCreateRequest) =>
    request<Preset>(API_ROUTES.presets, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: PresetUpdateRequest) =>
    request<Preset>(`${API_ROUTES.presets}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  remove: (id: string) =>
    request<{ success: boolean }>(`${API_ROUTES.presets}/${id}`, {
      method: "DELETE",
    }),
};
