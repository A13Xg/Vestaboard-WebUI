"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { BoardCell } from "./BoardCell";
import { Skeleton } from "@/components/ui";
import type { BoardMatrix } from "@/types";
import { normalizeMatrixSize } from "@/lib/board-utils";

interface BoardGridProps {
  matrix?: BoardMatrix;
  rows?: number;
  cols?: number;
  loading?: boolean;
  cellSize?: number;
  className?: string;
}

export function BoardGrid({ matrix, rows = 6, cols = 22, loading, cellSize = 14, className }: BoardGridProps) {
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

  return (
    <motion.div
      layout
      className={cn("grid gap-[2px]", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, ${cellSize}px)` }}
    >
      {displayMatrix.map((row, r) =>
        row.map((code, c) => (
          <motion.div
            key={`${r}-${c}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: (r * cols + c) * 0.001, duration: 0.2 }}
          >
            <BoardCell code={code} size={cellSize} />
          </motion.div>
        ))
      )}
    </motion.div>
  );
}
