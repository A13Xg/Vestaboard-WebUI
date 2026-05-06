"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { COLOR_MAP } from "@/config";
import type { BoardMatrix, TextAlignment } from "@/types";
import { charToCode, codeToChar, normalizeMatrixSize } from "@/lib/board-utils";
import { cn } from "@/lib/utils";

interface BoardComposerEditorProps {
  matrix: BoardMatrix;
  rows: number;
  cols: number;
  onChange: (matrix: BoardMatrix) => void;
  alignment?: TextAlignment;
  onAlignmentChange?: (alignment: TextAlignment) => void;
  className?: string;
}

const COLOR_CHOICES: Array<{ code: number; label: string }> = [
  { code: 63, label: "Red" },
  { code: 64, label: "Orange" },
  { code: 65, label: "Yellow" },
  { code: 66, label: "Green" },
  { code: 67, label: "Blue" },
  { code: 68, label: "Violet" },
  { code: 69, label: "White" },
  { code: 70, label: "Black" },
  { code: 71, label: "Filled" },
];

function indexOf(row: number, col: number, cols: number) {
  return row * cols + col;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function BoardComposerEditor({ matrix, rows, cols, onChange, alignment = "left", onAlignmentChange, className }: BoardComposerEditorProps) {
  const normalized = useMemo(() => normalizeMatrixSize(matrix, rows, cols), [matrix, rows, cols]);
  const [selected, setSelected] = useState({ row: 0, col: 0 });
  const [inputError, setInputError] = useState<string | null>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const idx = indexOf(selected.row, selected.col, cols);
    refs.current[idx]?.focus();
  }, [selected, cols]);

  const applyAt = (row: number, col: number, code: number, moveNext = false) => {
    const next = normalizeMatrixSize(normalized, rows, cols).map((r) => [...r]);
    next[row][col] = code;
    onChange(next);

    if (moveNext) {
      const flat = indexOf(row, col, cols);
      const nextFlat = clamp(flat + 1, 0, rows * cols - 1);
      setSelected({ row: Math.floor(nextFlat / cols), col: nextFlat % cols });
    }
  };

  const move = (rowDelta: number, colDelta: number) => {
    setSelected((prev) => ({
      row: clamp(prev.row + rowDelta, 0, rows - 1),
      col: clamp(prev.col + colDelta, 0, cols - 1),
    }));
  };

  const onCellKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, row: number, col: number) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1, 0);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1, 0);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(0, -1);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      move(0, 1);
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      applyAt(row, col, 0, false);
      const flat = indexOf(row, col, cols);
      const prevFlat = clamp(flat - 1, 0, rows * cols - 1);
      setSelected({ row: Math.floor(prevFlat / cols), col: prevFlat % cols });
      return;
    }
    if (e.key === "Delete") {
      e.preventDefault();
      applyAt(row, col, 0, false);
      return;
    }
    if (e.key === " ") {
      e.preventDefault();
      applyAt(row, col, 0, true);
      return;
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const code = charToCode(e.key);
      if (code === 0 && e.key !== " ") {
        setInputError(`Invalid character '${e.key}'. Allowed: A-Z, 0-9, ! @ # $ ( ) - + & = ; : ' \" % , . / ? ° and space.`);
        return;
      }
      setInputError(null);
      applyAt(row, col, code, true);
    }
  };

  const selectedCode = normalized[selected.row]?.[selected.col] ?? 0;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-auto rounded-lg border border-neutral-800 bg-neutral-900/40 p-2">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {normalized.map((row, r) =>
            row.map((code, c) => {
              const idx = indexOf(r, c, cols);
              const isColor = code >= 63 && code <= 71;
              const isSelected = selected.row === r && selected.col === c;
              const char = isColor ? "" : codeToChar(code);
              const bg = isColor ? COLOR_MAP[code] : undefined;

              return (
                <button
                  key={`${r}-${c}`}
                  ref={(el) => {
                    refs.current[idx] = el;
                  }}
                  type="button"
                  onClick={() => setSelected({ row: r, col: c })}
                  onKeyDown={(e) => onCellKeyDown(e, r, c)}
                  className={cn(
                    "h-7 rounded-[3px] border text-xs font-bold leading-none transition-colors",
                    isSelected ? "border-indigo-500 ring-1 ring-indigo-500/40" : "border-neutral-800",
                    !isColor && code === 0 ? "bg-neutral-950 text-neutral-700" : "text-neutral-100"
                  )}
                  style={isColor ? { backgroundColor: bg } : undefined}
                  aria-label={`Cell ${r + 1},${c + 1}`}
                >
                  {char}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
        <span>Selected: R{selected.row + 1} C{selected.col + 1}</span>
        <div className="flex items-center gap-1">
          {onAlignmentChange && (
            <div className="flex items-center gap-0.5 mr-1 border border-neutral-700 rounded p-0.5">
              {(["left", "center", "right"] as TextAlignment[]).map((a) => {
                const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => onAlignmentChange(a)}
                    title={`Align ${a}`}
                    className={cn(
                      "rounded px-1.5 py-0.5 transition-colors",
                      alignment === a
                        ? "bg-indigo-600/70 text-indigo-200"
                        : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
                    )}
                  >
                    <Icon className="w-3 h-3" />
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => applyAt(selected.row, selected.col, 0, false)}
            className="rounded px-2 py-1 border border-neutral-700 hover:border-neutral-600 hover:text-neutral-300"
          >
            Clear Cell
          </button>
        </div>
      </div>

      {inputError && (
        <p className="text-xs text-red-400" role="alert">{inputError}</p>
      )}

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2">
        <p className="text-[11px] text-neutral-400 uppercase tracking-wider mb-1">Keyboard</p>
        <p className="text-[11px] text-neutral-500">Type character: place and advance | Arrow keys: move | Backspace/Delete: clear | Space: blank</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {COLOR_CHOICES.map((choice) => (
          <button
            key={choice.code}
            type="button"
            onClick={() => applyAt(selected.row, selected.col, choice.code, false)}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] border transition-colors",
              selectedCode === choice.code ? "border-indigo-500 text-indigo-300" : "border-neutral-700 text-neutral-400 hover:text-neutral-200"
            )}
          >
            <span className="w-2.5 h-2.5 rounded-sm border border-black/30" style={{ backgroundColor: COLOR_MAP[choice.code] }} />
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}
