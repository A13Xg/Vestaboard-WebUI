// ─── Auth ───────────────────────────────────────────────────────────────────

export interface SessionData {
  isAuthenticated: boolean;
  authenticatedAt?: string;
}

export interface LoginRequest {
  accessCode: string;
}

export interface LoginResponse {
  success: boolean;
  error?: string;
}

export interface LogoutResponse {
  success: boolean;
}

// ─── Board ──────────────────────────────────────────────────────────────────

/** 6 rows × 22 columns of character codes (0–71) */
export type BoardMatrix = number[][];

export interface BoardCharacter {
  code: number;
  color?: BoardColor;
}

export type BoardColor =
  | "blank"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "violet"
  | "white"
  | "black"
  | "filled";

export interface BoardMessage {
  id: string;
  matrix: BoardMatrix;
  text?: string;
  sentAt?: string;
  label?: string;
}

export interface CurrentDisplayResponse {
  message: BoardMessage | null;
  syncedAt: string;
  status: BoardSyncStatus;
  source?: "live" | "mock";
}

export type BoardSyncStatus = "synced" | "syncing" | "stale" | "error" | "offline";

// ─── Compose ────────────────────────────────────────────────────────────────

export interface ComposeRequest {
  text: string;
  matrix?: BoardMatrix;
  style?: TextStyle;
  alignment?: TextAlignment;
  colorInserts?: ColorInsert[];
  boardModel?: "flagship" | "note";
}

export type TextStyle = "default" | "bold" | "narrow" | "extraBold" | "script";
export type TextAlignment = "left" | "center" | "right";

export interface ColorInsert {
  position: number;
  color: BoardColor;
}

export interface PreviewRequest extends ComposeRequest {}

export interface PreviewResponse {
  matrix: BoardMatrix;
  valid: boolean;
  warnings?: string[];
}

export interface SendRequest extends ComposeRequest {
  draftId?: string;
  transitionId?: string;
  submittedBy?: string;
}

export interface SendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: "vestaboard" | "none";
}

export interface MessageHistoryEntry {
  id: string;
  timestamp: string;
  submittedBy: string;
  source: "manual" | "workflow";
  provider: "vestaboard" | "none";
  boardModel: "flagship" | "note";
  text: string;
  matrix: BoardMatrix;
  layout: string;
  meta?: {
    workflowId?: string;
    workflowName?: string;
  };
}

export interface MessageHistoryFile {
  version: number;
  messages: MessageHistoryEntry[];
}

export interface MessageHistoryResponse {
  messages: MessageHistoryEntry[];
}

// ─── Presets ────────────────────────────────────────────────────────────────

export interface Preset {
  id: string;
  label: string;
  description?: string;
  text: string;
  style?: TextStyle;
  alignment?: TextAlignment;
  colorInserts?: ColorInsert[];
  isFavorite?: boolean;
  usedAt?: string;
}

// ─── Transitions ────────────────────────────────────────────────────────────

export interface TransitionOption {
  id: string;
  label: string;
  description?: string;
  durationMs?: number;
}

export interface TransitionSettings {
  selectedId: string;
  speed: "slow" | "normal" | "fast";
}

export interface TransitionResponse {
  available: TransitionOption[];
  current: TransitionSettings;
}

export interface SetTransitionRequest extends TransitionSettings {}

// ─── Workflows ──────────────────────────────────────────────────────────────

export type WorkflowScheduleType = "once" | "daily" | "weekly" | "cron";

export interface WorkflowSchedule {
  type: WorkflowScheduleType;
  at?: string;
  timeHHMM?: string;
  daysOfWeek?: number[];
  cron?: string;
  timezone?: string;
}

export interface WorkflowMessageTemplate {
  text: string;
  style?: TextStyle;
  alignment?: TextAlignment;
  colorInserts?: ColorInsert[];
}

export interface Workflow {
  id: string;
  name: string;
  enabled: boolean;
  message: WorkflowMessageTemplate;
  schedule: WorkflowSchedule;
  createdAt: string;
  updatedAt: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
}

export interface WorkflowCreateRequest {
  name: string;
  enabled: boolean;
  message: WorkflowMessageTemplate;
  schedule: WorkflowSchedule;
}

export interface WorkflowUpdateRequest {
  name?: string;
  enabled?: boolean;
  message?: Partial<WorkflowMessageTemplate>;
  schedule?: Partial<WorkflowSchedule>;
}

export interface WorkflowListResponse {
  workflows: Workflow[];
}

export interface WorkflowRunResult {
  workflowId: string;
  workflowName: string;
  success: boolean;
  message: string;
  runAt: string;
}

export interface WorkflowRunResponse {
  triggered: number;
  results: WorkflowRunResult[];
}

// ─── Draft ──────────────────────────────────────────────────────────────────

export interface Draft {
  id: string;
  text: string;
  style?: TextStyle;
  alignment?: TextAlignment;
  colorInserts?: ColorInsert[];
  createdAt: string;
  updatedAt: string;
  label?: string;
}

// ─── API envelope ───────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code?: string;
}

export type ApiResult<T> = { data: T; error: null } | { data: null; error: ApiError };
