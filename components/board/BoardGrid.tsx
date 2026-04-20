"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { BoardCell } from "./BoardCell";
import { Skeleton } from "@/components/ui";
import type { BoardMatrix } from "@/types";
import type { TransitionStyle, TransitionSpeed } from "@/types";
import { normalizeMatrixSize } from "@/lib/board-utils";

interface BoardGridProps {
  matrix?: BoardMatrix;
  rows?: number;
  cols?: number;
  loading?: boolean;
  cellSize?: number;
  transitionStyle?: TransitionStyle;
  transitionSpeed?: TransitionSpeed;
  animateCells?: boolean;
  animationSeed?: number;
  className?: string;
}

function getDuration(speed: TransitionSpeed | undefined) {
  return speed === "fast" ? 0.22 : 0.5;
}

function getCellDelay(
  style: TransitionStyle | undefined,
  speed: TransitionSpeed | undefined,
  r: number,
  c: number,
  rows: number,
  cols: number
) {
  const step = speed === "fast" ? 0.004 : 0.01;
  switch (style) {
    case "wave":
      return (r + c) * step;
    case "drift": {
      const centerR = (rows - 1) / 2;
      const centerC = (cols - 1) / 2;
      const distance = Math.abs(r - centerR) + Math.abs(c - centerC);
      return distance * step * 0.7;
    }
    case "curtain":
      return c * step;
    case "classic":
    default:
      return r * step * 1.5 + c * step * 0.2;
  }
}

function getCellInitial(style: TransitionStyle | undefined) {
  switch (style) {
    case "wave":
      return { opacity: 0.2, y: -4, scale: 0.95 };
    case "drift":
      return { opacity: 0.1, x: 7, scale: 0.94 };
    case "curtain":
      return { opacity: 0.15, scaleX: 0.2, transformOrigin: "left center" };
    case "classic":
    default:
      return { opacity: 0.25, rotateX: -82, scaleY: 0.84, transformOrigin: "top center" };
  }
}

function getCellAnimate(style: TransitionStyle | undefined) {
  switch (style) {
    case "wave":
      return { opacity: 1, y: 0, scale: 1 };
    case "drift":
      return { opacity: 1, x: 0, scale: 1 };
    case "curtain":
      return { opacity: 1, scaleX: 1, transformOrigin: "left center" };
    case "classic":
    default:
      return { opacity: 1, rotateX: 0, scaleY: 1, transformOrigin: "top center" };
  }
}

export function BoardGrid({
  matrix,
  rows = 6,
  cols = 22,
  loading,
  cellSize = 14,
  transitionStyle,
  transitionSpeed,
  animateCells,
  animationSeed,
  className,
}: BoardGridProps) {
  const displayMatrix = normalizeMatrixSize(matrix, rows, cols);

  if (loading) {
    return (
      <div className={cn("grid gap-[2px]", className)}
        style={{ gridTemplateColumns: `repeat(${cols}, ${cellSize}px)` }}>
        {Array.from({ length: rows * cols }).map((_, i) => (
          <Skeleton key={i} className="rounded-[2px]"
            style={{ width: cellSize, height: cellSize * 1.15 }} />
        ))}
      </div>
    );
  }

  const shouldAnimate = !!animateCells && !!transitionStyle;
  const duration = getDuration(transitionSpeed);
  const initial = getCellInitial(transitionStyle);
  const animate = getCellAnimate(transitionStyle);

  return (
    <motion.div
      layout
      className={cn("grid gap-[2px]", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, ${cellSize}px)` }}
    >
      {displayMatrix.map((row, r) =>
        row.map((code, c) => (
          <motion.div
            key={`${r}-${c}-${animationSeed ?? 0}`}
            initial={shouldAnimate ? initial : false}
            animate={shouldAnimate ? animate : undefined}
            transition={
              shouldAnimate
                ? {
                    delay: getCellDelay(transitionStyle, transitionSpeed, r, c, rows, cols),
                    duration,
                    ease: [0.2, 0.8, 0.2, 1],
                  }
                : undefined
            }
          >
            <BoardCell code={code} size={cellSize} />
          </motion.div>
        ))
      )}
    </motion.div>
  );
}
