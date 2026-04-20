import type { BoardMatrix } from "@/types";
import { BOARD_ROWS, BOARD_COLS } from "@/config";

/**
 * Maps printable characters to their Vestaboard numeric character codes.
 * Codes 1–26 = A–Z, digits use 27–36 with '1'..'9' = 27..35 and '0' = 36,
 * and 37–60 = punctuation (see Vestaboard docs).
 * Code 0 = blank cell. Codes 63–71 are colour-fill tiles (see COLOR_MAP in constants.ts).
 */
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
 * ASCII → Vestaboard character code mapper.
 *
 * Vestaboard digit encoding:
 *   1–9 → codes 27–35
 *   0   → code 36
 */
export function charToCode(ch: string): number {
  if (!ch) return 0;
  if (ch === " ") return 0;

  const special = SPECIAL_CHAR_TO_CODE[ch];
  if (special !== undefined) return special;

  const c = ch.toUpperCase().charCodeAt(0);
  if (c >= 65 && c <= 90) return c - 64; // A=1..Z=26
  if (c === 48) return 36; // '0' = 36
  if (c >= 49 && c <= 57) return c - 48 + 26; // '1'..'9' = 27..35
  return 0;
}

/** Decode a single Vestaboard character code to its displayable character. */
export function codeToChar(code: number): string {
  if (code === 0) return "";
  if (code >= 1 && code <= 26) return String.fromCharCode(64 + code); // A–Z
  if (code >= 27 && code <= 35) return String.fromCharCode(code - 26 + 48); // '1'..'9'
  if (code === 36) return "0";
  return SPECIAL_CODE_TO_CHAR[code] ?? "";
}

/** Returns true when at least one cell in the matrix carries a non-blank code. */
export function matrixHasContent(matrix: BoardMatrix): boolean {
  return matrix.some((row) => row.some((code) => code !== 0));
}

/**
 * Converts a board matrix to a plain-text string for display and history logging.
 * Colour-fill codes (63–71) are rendered as spaces since they have no character glyph.
 * Each row is right-trimmed; the entire result is trimmed of leading/trailing newlines.
 */
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
 * Converts a text string into a full board matrix, word-wrapping across rows
 * and applying per-row alignment (left/center/right).
 *
 * Layout rules:
 * - Explicit `\n` characters force a new row.
 * - Long lines are wrapped at word boundaries; words that exceed `cols` are hard-broken.
 * - Each filled row is placed at the column offset determined by `alignment`.
 * - Rows beyond `rows` are silently discarded.
 */
export function textToMatrix(
  text: string,
  rows = BOARD_ROWS,
  cols = BOARD_COLS,
  alignment: "left" | "center" | "right" = "left",
): BoardMatrix {
  const matrix = emptyMatrix(rows, cols);

  // Collect word-wrapped rows of board-width text
  const wrappedRows: string[] = [];

  for (const line of text.split(/\n/)) {
    if (line.length === 0) {
      wrappedRows.push(""); // preserve explicit blank lines
      continue;
    }
    if (line.length <= cols) {
      wrappedRows.push(line);
      continue;
    }

    // Word-wrap: pack words into rows without splitting mid-word where possible
    let current = "";
    for (const word of line.split(" ")) {
      if (current.length === 0) {
        // Word wider than the board — hard-break at cols
        let remaining = word;
        while (remaining.length > cols) {
          wrappedRows.push(remaining.slice(0, cols));
          remaining = remaining.slice(cols);
        }
        current = remaining;
      } else if (current.length + 1 + word.length <= cols) {
        current += " " + word;
      } else {
        wrappedRows.push(current);
        // New row may also start with an oversized word
        let remaining = word;
        while (remaining.length > cols) {
          wrappedRows.push(remaining.slice(0, cols));
          remaining = remaining.slice(cols);
        }
        current = remaining;
      }
    }
    if (current.length > 0) wrappedRows.push(current);
  }

  // Write each wrapped row into the matrix at the correct column offset
  for (let r = 0; r < Math.min(wrappedRows.length, rows); r++) {
    const rowText = wrappedRows[r].slice(0, cols);
    let startCol = 0;
    if (alignment === "center") {
      startCol = Math.max(0, Math.floor((cols - rowText.length) / 2));
    } else if (alignment === "right") {
      startCol = Math.max(0, cols - rowText.length);
    }
    for (let c = 0; c < rowText.length; c++) {
      matrix[r][startCol + c] = charToCode(rowText[c]);
    }
  }

  return matrix;
}
