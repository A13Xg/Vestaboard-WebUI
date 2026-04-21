import type { BoardMatrix } from "@/types";
import { BOARD_PROFILES, type BoardModel } from "@/lib/board-model";
import { wrapTextToRows } from "@/lib/board-utils";

export const ALLOWED_MESSAGE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$()-+&=;:'\"%,./?° ";

const ALLOWED_CHAR_SET = new Set(ALLOWED_MESSAGE_CHARS.split(""));

export interface MessageValidationResult {
  valid: boolean;
  normalizedText: string;
  error?: string;
}

export function validateMessageText(text: string, boardModel: BoardModel = "flagship"): MessageValidationResult {
  const profile = BOARD_PROFILES[boardModel];
  const normalizedText = text.toUpperCase().replace(/\r?\n/g, "\n");

  if (!normalizedText.trim()) {
    return {
      valid: false,
      normalizedText,
      error: "Message is required",
    };
  }

  const printableCharCount = normalizedText.replace(/\n/g, "").length;
  if (printableCharCount > profile.rows * profile.cols) {
    return {
      valid: false,
      normalizedText,
      error: `Message exceeds ${profile.rows * profile.cols} characters for ${profile.label}`,
    };
  }

  for (let i = 0; i < normalizedText.length; i++) {
    const ch = normalizedText[i];
    if (ch === "\n") continue;
    if (!ALLOWED_CHAR_SET.has(ch)) {
      return {
        valid: false,
        normalizedText,
        error: `Invalid character '${ch}' at position ${i + 1}`,
      };
    }
  }

  const wrappedRows = wrapTextToRows(normalizedText, profile.cols);
  if (wrappedRows.length > profile.rows) {
    return {
      valid: false,
      normalizedText,
      error: `Message exceeds ${profile.rows} lines for ${profile.label}`,
    };
  }

  return {
    valid: true,
    normalizedText,
  };
}

export function validateMatrix(matrix: BoardMatrix): MessageValidationResult {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    return { valid: false, normalizedText: "", error: "Matrix is required" };
  }

  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) {
      return { valid: false, normalizedText: "", error: `Invalid matrix row at ${r + 1}` };
    }

    for (let c = 0; c < row.length; c++) {
      const code = row[c];
      if (typeof code !== "number" || !Number.isInteger(code) || code < 0 || code > 71) {
        return { valid: false, normalizedText: "", error: `Invalid code ${String(code)} at row ${r + 1}, col ${c + 1}` };
      }
    }
  }

  return { valid: true, normalizedText: "" };
}
