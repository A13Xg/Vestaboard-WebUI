"use client";

import { cn } from "@/lib/utils";
import { COLOR_MAP, BOARD_CELL_DEFAULT } from "@/config";
import { codeToChar } from "@/lib/board-utils";

interface BoardCellProps {
  code: number;
  size?: number;
  animate?: boolean;
}

function isColorCode(code: number): boolean {
  return code >= 63 && code <= 71;
}

export function BoardCell({ code, size = 14 }: BoardCellProps) {
  const isColor = isColorCode(code);
  const fillColor = isColor ? COLOR_MAP[code] : undefined;
  const char = isColor ? "" : codeToChar(code);
  const isEmpty = code === 0;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-[2px] select-none overflow-hidden transition-colors duration-300",
        isEmpty ? "bg-neutral-900/60" : !isColor ? "bg-neutral-800" : ""
      )}
      style={{
        width: size,
        height: size * 1.15,
        backgroundColor: isColor ? fillColor : undefined,
        fontSize: Math.max(size * 0.6, 6),
        lineHeight: 1,
        fontFamily: "var(--font-board)",
      }}
      aria-label={char || undefined}
    >
      {!isColor && char && (
        <span
          className="font-bold tracking-tighter text-neutral-100 leading-none"
          style={{ fontSize: size * 0.62 }}
        >
          {char}
        </span>
      )}
    </div>
  );
}
