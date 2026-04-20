import { NextResponse } from "next/server";

interface ApiErrorBody {
  error: string;
  detail?: string;
}

export function errorJson(error: string, status: number, detail?: string) {
  const body: ApiErrorBody = { error };
  if (detail) body.detail = detail;
  return NextResponse.json(body, { status });
}

export function unexpectedError(context: string, err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`[${context}]`, err);
  return errorJson("Internal server error", 500, `${context}: ${detail}`);
}
