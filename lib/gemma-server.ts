import type { GemmaConnectivityResponse } from "@/types";

export const GEMMA_MODEL = "gemma-3-4b-it";
export const GEMMA_FALLBACK_MODELS = ["gemma-3-1b-it"] as const;

const GEMMA_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMMA_CONNECTIVITY_TIMEOUT_MS = 15000;
const GEMMA_GENERATION_TIMEOUT_MS = 45000;

type GemmaErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type GemmaGeneratePayload = {
  contents: Array<{
    parts: Array<{ text: string }>;
  }>;
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
};

type GenerateGemmaTextOptions = {
  generationConfig?: GemmaGeneratePayload["generationConfig"];
  timeoutMs?: number;
};

type GemmaErrorDetail = {
  payload: GemmaErrorPayload | null;
  fallbackText: string;
};

export class GemmaApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 0) {
    super(message);
    this.name = "GemmaApiError";
    this.statusCode = statusCode;
  }
}

function getGemmaApiKey() {
  return process.env.GEMMA_API_KEY?.trim() || "";
}

function getGemmaModelCandidates() {
  return [GEMMA_MODEL, ...GEMMA_FALLBACK_MODELS];
}

function buildGemmaUrl(model: string, apiKey: string) {
  return `${GEMMA_ENDPOINT}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function parseGemmaErrorMessage(statusCode: number, payload: GemmaErrorPayload | null, fallbackText: string, model: string) {
  const detail = payload?.error?.message?.trim() || fallbackText.trim();
  if (statusCode === 400) return detail || "Gemma rejected the request.";
  if (statusCode === 401 || statusCode === 403) return "Gemma authentication failed. Check GEMMA_API_KEY.";
  if (statusCode === 404) return `The configured Gemma model (${model}) is unavailable.`;
  if (statusCode === 429) return "Gemma rate limit reached. Try again in a moment.";
  if (statusCode >= 500) return "Gemma is unavailable right now. Try again later.";
  return detail || `Gemma request failed (${statusCode}).`;
}

async function safeJson<T>(rawText: string) {
  try {
    return JSON.parse(rawText) as T;
  } catch {
    return null;
  }
}

async function readGemmaErrorDetail(response: Response): Promise<GemmaErrorDetail> {
  const rawText = await response.text();
  const payload = await safeJson<GemmaErrorPayload>(rawText);
  return {
    payload,
    fallbackText: payload ? "" : rawText.slice(0, 200),
  };
}

async function postGemma(model: string, body: GemmaGeneratePayload, timeoutMs = GEMMA_GENERATION_TIMEOUT_MS) {
  const apiKey = getGemmaApiKey();
  if (!apiKey) {
    throw new GemmaApiError("Gemma is unavailable because GEMMA_API_KEY is not configured.");
  }

  try {
    return await fetch(buildGemmaUrl(model, apiKey), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new GemmaApiError("Timed out waiting for the Gemma API response.");
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new GemmaApiError(`Unable to reach the Gemma API: ${detail}`);
  }
}

export async function generateGemmaText(
  prompt: string,
  options: GenerateGemmaTextOptions = {},
) {
  const {
    generationConfig,
    timeoutMs = GEMMA_GENERATION_TIMEOUT_MS,
  } = options;
  let lastError: GemmaApiError | null = null;

  for (const model of getGemmaModelCandidates()) {
    try {
      const response = await postGemma(model, {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig,
      }, timeoutMs);

      if (!response.ok) {
        const { payload, fallbackText } = await readGemmaErrorDetail(response);
        throw new GemmaApiError(
          parseGemmaErrorMessage(response.status, payload, fallbackText, model),
          response.status,
        );
      }

      const json = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const responseText = json.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join(" ")
        .trim();

      if (!responseText) {
        throw new GemmaApiError("Gemma returned an empty response.");
      }

      return responseText;
    } catch (error) {
      const gemmaError = error instanceof GemmaApiError
        ? error
        : new GemmaApiError(error instanceof Error ? error.message : String(error));
      lastError = gemmaError;

      const shouldRetryWithFallback = gemmaError.statusCode === 0 || gemmaError.statusCode === 404 || gemmaError.statusCode >= 500;
      if (!shouldRetryWithFallback || model === getGemmaModelCandidates()[getGemmaModelCandidates().length - 1]) {
        throw gemmaError;
      }
    }
  }

  throw lastError ?? new GemmaApiError("Gemma returned an empty response.");
}

export async function verifyGemmaConnectivity(): Promise<GemmaConnectivityResponse> {
  const apiKey = getGemmaApiKey();
  if (!apiKey) {
    return {
      connected: false,
      reason: "Gemma is unavailable because GEMMA_API_KEY is not configured.",
      statusCode: 0,
      model: GEMMA_MODEL,
    };
  }

  try {
    await generateGemmaText("Reply with OK only.", {
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8,
      },
      timeoutMs: GEMMA_CONNECTIVITY_TIMEOUT_MS,
    });

    return {
      connected: true,
      reason: null,
      statusCode: 200,
      model: GEMMA_MODEL,
    };
  } catch (error) {
    if (error instanceof GemmaApiError) {
      return {
        connected: false,
        reason: error.message,
        statusCode: error.statusCode,
        model: GEMMA_MODEL,
      };
    }

    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        connected: false,
        reason: "Timed out connecting to the Gemma API.",
        statusCode: 0,
        model: GEMMA_MODEL,
      };
    }

    const detail = error instanceof Error ? error.message : String(error);
    return {
      connected: false,
      reason: `Unable to reach the Gemma API: ${detail}`,
      statusCode: 0,
      model: GEMMA_MODEL,
    };
  }
}
