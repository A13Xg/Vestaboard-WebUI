import type { BoardMatrix, TextAlignment } from "@/types";
import { BOARD_ROWS, BOARD_COLS } from "@/config";
import { BOARD_PROFILES, type BoardModel } from "@/lib/board-model";

export interface WrapTextOptions {
  hyphenateOverflowWords?: boolean;
}

export interface SanitizeBoardTextOptions {
  preserveNewlines?: boolean;
  collapseWhitespace?: boolean;
  trim?: boolean;
}

export interface FitTextToBoardOptions extends WrapTextOptions {
  alignment?: TextAlignment;
}

export interface SequentialBoardTokenParseResult {
  codes: number[];
  normalized: string;
}

const BOARD_SAFE_CHAR = /[^A-Z0-9!@#$()\-+&=;:'"%,./?° \n]/g;

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

export const BOARD_COLOR_TOKENS: Record<string, number> = {
  R: 63,
  O: 64,
  Y: 65,
  G: 66,
  B: 67,
  P: 68,
  W: 69,
};

const BOARD_COLOR_CODES_TO_TOKENS: Record<number, string> = Object.fromEntries(
  Object.entries(BOARD_COLOR_TOKENS).map(([token, code]) => [code, `{${token}}`]),
);

export function sanitizeBoardText(
  value: string,
  options: SanitizeBoardTextOptions = {},
): string {
  const {
    preserveNewlines = false,
    collapseWhitespace = true,
    trim = true,
  } = options;

  let normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\t/g, " ")
    .toUpperCase();

  if (!preserveNewlines) {
    normalized = normalized.replace(/\n/g, " ");
  }

  normalized = normalized.replace(BOARD_SAFE_CHAR, " ");

  if (collapseWhitespace) {
    if (preserveNewlines) {
      normalized = normalized
        .split("\n")
        .map((line) => line.replace(/ +/g, " "))
        .join("\n");
    } else {
      normalized = normalized.replace(/\s+/g, " ");
    }
  } else if (!preserveNewlines) {
    normalized = normalized.replace(/\s/g, " ");
  }

  if (trim) {
    normalized = preserveNewlines
      ? normalized.split("\n").map((line) => line.trim()).join("\n").trim()
      : normalized.trim();
  }

  return normalized;
}

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

export function codeToBoardToken(code: number): string {
  if (code === 0) return "_";
  return BOARD_COLOR_CODES_TO_TOKENS[code] ?? codeToChar(code) ?? "_";
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

export function wrapTextToRows(
  text: string,
  cols = BOARD_COLS,
  options: WrapTextOptions = {},
): string[] {
  const { hyphenateOverflowWords = false } = options;
  const wrappedRows: string[] = [];

  for (const rawLine of text.split(/\n/)) {
    if (rawLine.length === 0) {
      wrappedRows.push("");
      continue;
    }

    let current = "";
    const words = rawLine.split(" ").filter((word, index, wordsArray) => word.length > 0 || wordsArray.length === 1);

    for (const word of words) {
      if (word.length === 0) continue;

      let remaining = word;
      while (remaining.length > 0) {
        const separator = current.length === 0 ? "" : " ";
        const available = cols - current.length - separator.length;

        if (remaining.length <= available) {
          current += separator + remaining;
          remaining = "";
          continue;
        }

        if (remaining.length <= cols) {
          if (current.length > 0) {
            wrappedRows.push(current);
            current = "";
            continue;
          }

          current = remaining;
          remaining = "";
          continue;
        }

        if (available <= 0 || (hyphenateOverflowWords && available <= 1)) {
          if (current.length > 0) {
            wrappedRows.push(current);
            current = "";
            continue;
          }
        }

        const chunkSize = hyphenateOverflowWords
          ? Math.max(1, (current.length === 0 ? cols : available) - 1)
          : current.length === 0
            ? cols
            : available;

        const chunk = remaining.slice(0, chunkSize);
        current += separator + chunk + (hyphenateOverflowWords ? "-" : "");
        remaining = remaining.slice(chunkSize);
        wrappedRows.push(current);
        current = "";
      }
    }

    if (current.length > 0) {
      wrappedRows.push(current);
    }
  }

  return wrappedRows;
}

function alignedRowsToMatrix(
  rowsText: string[],
  rows: number,
  cols: number,
  alignment: TextAlignment = "left",
) {
  const matrix = emptyMatrix(rows, cols);

  for (let r = 0; r < Math.min(rowsText.length, rows); r++) {
    const rowText = rowsText[r].slice(0, cols);
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

export function fitTextToBoard(
  text: string,
  boardModel: BoardModel = "flagship",
  options: FitTextToBoardOptions = {},
) {
  const profile = BOARD_PROFILES[boardModel];
  const sanitized = sanitizeBoardText(text, {
    preserveNewlines: true,
    collapseWhitespace: true,
    trim: true,
  });
  const wrappedRows = wrapTextToRows(sanitized, profile.cols, options);
  const visibleRows = wrappedRows.slice(0, profile.rows).map((row) => row.slice(0, profile.cols));
  const matrix = alignedRowsToMatrix(visibleRows, profile.rows, profile.cols, options.alignment ?? "left");

  return {
    sanitizedText: sanitized,
    wrappedRows,
    truncated: wrappedRows.length > profile.rows,
    matrix,
    renderedText: matrixToPlainText(matrix),
  };
}

export function directCodesToMatrix(
  codes: number[],
  rows = BOARD_ROWS,
  cols = BOARD_COLS,
): BoardMatrix {
  const matrix = emptyMatrix(rows, cols);
  const cappedCodes = codes.slice(0, rows * cols);

  for (let index = 0; index < cappedCodes.length; index++) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    matrix[row][col] = cappedCodes[index];
  }

  return matrix;
}

export function directTextToMatrix(
  text: string,
  rows = BOARD_ROWS,
  cols = BOARD_COLS,
): BoardMatrix {
  const exactText = text.slice(0, rows * cols).padEnd(rows * cols, " ");
  return directCodesToMatrix(Array.from(exactText, (char) => charToCode(char)), rows, cols);
}

export function matrixToSequentialTokens(matrix: BoardMatrix): string {
  return matrix.flat().map((code) => codeToBoardToken(code)).join("");
}

export function parseSequentialBoardTokens(input: string): SequentialBoardTokenParseResult {
  const compact = input.toUpperCase().replace(/\s+/g, "");
  const codes: number[] = [];
  const normalizedParts: string[] = [];

  for (let index = 0; index < compact.length;) {
    const current = compact[index];

    if (current === "{") {
      const token = compact.slice(index, index + 3);
      if (token.length !== 3 || token[2] !== "}") {
        throw new Error("Gemma response contains an invalid color token. Use tokens like {R} or {G}.");
      }

      const colorCode = BOARD_COLOR_TOKENS[token[1]];
      if (colorCode === undefined) {
        throw new Error(`Gemma response contains an unsupported color token ${token}.`);
      }

      codes.push(colorCode);
      normalizedParts.push(token);
      index += 3;
      continue;
    }

    if (current === "_") {
      codes.push(0);
      normalizedParts.push("_");
      index += 1;
      continue;
    }

    const code = charToCode(current);
    if (code === 0) {
      throw new Error(`Gemma response contains an unsupported character '${current}'.`);
    }

    codes.push(code);
    normalizedParts.push(current);
    index += 1;
  }

  return {
    codes,
    normalized: normalizedParts.join(""),
  };
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
  options: WrapTextOptions = {},
): BoardMatrix {
  const wrappedRows = wrapTextToRows(text, cols, options);
  return alignedRowsToMatrix(wrappedRows, rows, cols, alignment);
}
