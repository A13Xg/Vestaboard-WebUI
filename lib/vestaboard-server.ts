import { matrixToPlainText, normalizeMatrixSize, textToMatrix } from "@/lib/board-utils";
import type { BoardMatrix, CurrentDisplayResponse, SendRequest } from "@/types";
import { MOCK_CURRENT_DISPLAY } from "@/lib/mock-data";
import { BOARD_COLS, BOARD_ROWS } from "@/config";
import { BOARD_PROFILES, type BoardModel } from "@/lib/board-model";
import { appendMessageHistory } from "@/lib/message-history";
import { validateMessageText } from "@/lib/message-validation";

interface SendHistoryContext {
  source?: "manual" | "workflow";
  meta?: {
    workflowId?: string;
    workflowName?: string;
  };
}

const RW_ENDPOINT = "https://rw.vestaboard.com/";

function getApiToken() {
  return process.env.VESTABOARD_API_TOKEN;
}

/**
 * Runtime type-guard: confirms the value is a non-empty 2-D array of numbers,
 * matching the Vestaboard character-code matrix format.
 */
function isMatrix(value: unknown): value is BoardMatrix {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "number"))
  );
}

/**
 * Normalises any matrix to exactly BOARD_ROWS × BOARD_COLS.
 * Extra rows/columns are trimmed; missing ones are filled with 0 (blank).
 */
function normalizeMatrix(input: BoardMatrix): BoardMatrix {
  const normalized = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(0));
  for (let r = 0; r < Math.min(input.length, BOARD_ROWS); r++) {
    for (let c = 0; c < Math.min(input[r].length, BOARD_COLS); c++) {
      normalized[r][c] = input[r][c];
    }
  }
  return normalized;
}

function parseLayoutString(value: unknown): BoardMatrix | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return isMatrix(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Walks the multiple response shapes returned by the Vestaboard RW API
 * (bare matrix, `currentMessage.layout`, `message.layout`, `characters`, etc.)
 * and returns the first valid `BoardMatrix` found, or `null` if none match.
 */
function extractMatrix(data: unknown): BoardMatrix | null {
  if (isMatrix(data)) return data;
  if (typeof data !== "object" || data === null) return null;

  const asObj = data as Record<string, unknown>;
  if (isMatrix(asObj.currentMessage)) return asObj.currentMessage;
  const currentMessage = asObj.currentMessage as Record<string, unknown> | undefined;
  if (currentMessage) {
    const fromLayout = parseLayoutString(currentMessage.layout);
    if (fromLayout) return fromLayout;
  }
  if (isMatrix(asObj.message)) return asObj.message;
  const messageObj = asObj.message as Record<string, unknown> | undefined;
  if (messageObj) {
    const fromLayout = parseLayoutString(messageObj.layout);
    if (fromLayout) return fromLayout;
  }
  if (isMatrix(asObj.characters)) return asObj.characters;
  const fromLayout = parseLayoutString(asObj.layout);
  if (fromLayout) return fromLayout;
  return null;
}

export async function checkVestaboardConnectivity() {
  const token = getApiToken();
  if (!token) {
    return { connected: false, reason: "Missing VESTABOARD_API_TOKEN", statusCode: 0 };
  }

  try {
    const res = await fetch(RW_ENDPOINT, {
      method: "GET",
      headers: {
        "X-Vestaboard-Read-Write-Key": token,
      },
      cache: "no-store",
    });

    if (res.ok) {
      return { connected: true, reason: null, statusCode: res.status };
    }

    return {
      connected: false,
      reason: `Vestaboard API returned ${res.status}`,
      statusCode: res.status,
    };
  } catch (error) {
    return {
      connected: false,
      reason: (error as Error).message,
      statusCode: 0,
    };
  }
}

export async function getCurrentDisplayLiveOrMock(): Promise<CurrentDisplayResponse> {
  const token = getApiToken();
  if (!token) {
    return {
      ...MOCK_CURRENT_DISPLAY,
      syncedAt: new Date().toISOString(),
      source: "mock",
    };
  }

  try {
    const res = await fetch(RW_ENDPOINT, {
      method: "GET",
      headers: {
        "X-Vestaboard-Read-Write-Key": token,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        ...MOCK_CURRENT_DISPLAY,
        status: "stale",
        syncedAt: new Date().toISOString(),
        source: "mock",
      };
    }

    const data = await res.json();
    const matrix = extractMatrix(data);

    if (!matrix) {
      return {
        ...MOCK_CURRENT_DISPLAY,
        status: "stale",
        syncedAt: new Date().toISOString(),
        source: "mock",
      };
    }

    return {
      message: {
        id: `live-${Date.now()}`,
        matrix: normalizeMatrix(matrix),
        sentAt: new Date().toISOString(),
        label: "Live board state",
      },
      status: "synced",
      syncedAt: new Date().toISOString(),
      source: "live",
    };
  } catch {
    return {
      ...MOCK_CURRENT_DISPLAY,
      status: "error",
      syncedAt: new Date().toISOString(),
      source: "mock",
    };
  }
}

export async function sendMessageToVestaboard(body: SendRequest, historyContext: SendHistoryContext = {}) {
  const token = getApiToken();
  if (!token) {
    return {
      success: false,
      error: "VESTABOARD_API_TOKEN is not configured",
      provider: "none" as const,
    };
  }

  const boardModel: BoardModel = body.boardModel === "note" ? "note" : "flagship";
  const profile = BOARD_PROFILES[boardModel];

  if (!body.matrix) {
    const textValidation = validateMessageText(body.text ?? "", boardModel);
    if (!textValidation.valid) {
      return {
        success: false,
        error: textValidation.error,
        provider: "none" as const,
      };
    }

    body.text = textValidation.normalizedText;
  }

  const matrix = body.matrix
    ? normalizeMatrixSize(body.matrix, profile.rows, profile.cols)
    : textToMatrix(body.text ?? "", profile.rows, profile.cols, body.alignment ?? "left");
  const resolvedText = (typeof body.text === "string" && body.text.trim().length > 0)
    ? body.text
    : matrixToPlainText(matrix);

  try {
    const res = await fetch(RW_ENDPOINT, {
      method: "POST",
      headers: {
        "X-Vestaboard-Read-Write-Key": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(matrix),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `Vestaboard API error ${res.status}: ${text.slice(0, 160)}`,
        provider: "vestaboard" as const,
      };
    }

    try {
      await appendMessageHistory({
        submittedBy: body.submittedBy ?? "authenticated-user",
        source: historyContext.source ?? "manual",
        provider: "vestaboard",
        boardModel,
        text: resolvedText,
        matrix,
        meta: historyContext.meta,
      });
    } catch (historyErr) {
      console.error("[message-history.append]", historyErr);
    }

    return {
      success: true,
      provider: "vestaboard" as const,
      messageId: `vb-${Date.now()}`,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      provider: "vestaboard" as const,
    };
  }
}
