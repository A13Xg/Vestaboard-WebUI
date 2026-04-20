import type { BoardMatrix } from "@/types";
import { BOARD_ROWS, BOARD_COLS } from "@/config";

const SPECIAL_CHAR_TO_CODE: Record<string, number> = {
  "!": 37,
  "@": 38,
  "#": 39,
  "$": 40,
  "(": 41,
  ")": 42,
  "-": 44,
  "+": 46,
  "&": 47,
  "=": 48,
  ";": 49,
  ":": 50,
  "'": 52,
  '"': 53,
  "%": 54,
  ",": 55,
  ".": 56,
  "/": 59,
  "?": 60,
  "°": 62,
};

const SPECIAL_CODE_TO_CHAR: Record<number, string> = Object.fromEntries(
  Object.entries(SPECIAL_CHAR_TO_CODE).map(([char, code]) => [code, char])
);

/** Returns an empty 6×22 board matrix (all zeros) */
export function emptyMatrix(rows = BOARD_ROWS, cols = BOARD_COLS): BoardMatrix {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

/** Clones a board matrix */
export function cloneMatrix(matrix: BoardMatrix): BoardMatrix {
  return matrix.map((row) => [...row]);
}

/** Fills the matrix with a single character code */
export function fillMatrix(code: number, rows = BOARD_ROWS, cols = BOARD_COLS): BoardMatrix {
  return Array.from({ length: rows }, () => Array(cols).fill(code));
}

/** Crops/pads an input matrix to a fixed board size */
export function normalizeMatrixSize(matrix: BoardMatrix | undefined, rows = BOARD_ROWS, cols = BOARD_COLS): BoardMatrix {
  const normalized = emptyMatrix(rows, cols);
  if (!matrix) return normalized;

  for (let r = 0; r < Math.min(matrix.length, rows); r++) {
    for (let c = 0; c < Math.min(matrix[r].length, cols); c++) {
      normalized[r][c] = matrix[r][c];
    }
  }

  return normalized;
}

/**
 * Very naive ASCII → Vestaboard character code mapper.
 * Real implementation should use the full Vestaboard character set.
 */
export function charToCode(ch: string): number {
  if (!ch) return 0;
  if (ch === " ") return 0;

  const special = SPECIAL_CHAR_TO_CODE[ch];
  if (special !== undefined) return special;

  const c = ch.toUpperCase().charCodeAt(0);
  if (c >= 65 && c <= 90) return c - 64; // A=1..Z=26
  if (c >= 48 && c <= 57) return c - 48 + 27; // 0–9 = 27–36
  return 0;
}

/** Decode a single Vestaboard character code to displayable character */
export function codeToChar(code: number): string {
  if (code === 0) return "";
  if (code >= 1 && code <= 26) return String.fromCharCode(64 + code); // A–Z
  if (code >= 27 && code <= 36) return String.fromCharCode(code - 27 + 48); // 0–9
  return SPECIAL_CODE_TO_CHAR[code] ?? "";
}

export function matrixHasContent(matrix: BoardMatrix): boolean {
  return matrix.some((row) => row.some((code) => code !== 0));
}

export function matrixToPlainText(matrix: BoardMatrix): string {
  const rows = matrix.map((row) => row
    .map((code) => {
      if (code >= 63 && code <= 71) return " ";
      const ch = codeToChar(code);
      return ch || " ";
    })
    .join("")
    .trimEnd()
  );

  return rows.join("\n").trim();
}

/**
 * Encode a string into the first row of a fresh board matrix.
 * Truncates to BOARD_COLS characters.
 */
export function textToMatrix(text: string, rows = BOARD_ROWS, cols = BOARD_COLS): BoardMatrix {
  const matrix = emptyMatrix(rows, cols);
  const chars = text.slice(0, cols).split("");
  chars.forEach((ch, i) => {
    matrix[0][i] = charToCode(ch);
  });
  return matrix;
}
