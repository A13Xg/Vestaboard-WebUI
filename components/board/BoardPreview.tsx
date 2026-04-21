"use client";

import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { BoardGrid } from "./BoardGrid";
import type { BoardMatrix } from "@/types";
import type { TransitionStyle, TransitionSpeed } from "@/types";
import { useBoardModel } from "@/hooks/use-board-model";
import { BOARD_PROFILES, type BoardModel } from "@/lib/board-model";

interface BoardPreviewProps {
  matrix?: BoardMatrix;
  loading?: boolean;
  className?: string;
  boardModel?: BoardModel;
  /** Override cell size in px — auto-calculated from container if omitted */
  cellSize?: number;
  /** Vestaboard transition style to visualise */
  transition?: TransitionStyle;
  /** Vestaboard transition speed to visualise */
  transitionSpeed?: TransitionSpeed;
  /** When true, loops the chosen transition animation every few seconds */
  animatePreview?: boolean;
}

const GAP = 2;
const FRAME_PADDING = 20; // px on each side

// ─── Duration helpers ─────────────────────────────────────────────────────────

function enterDuration(speed: TransitionSpeed | undefined): number {
  return speed === "fast" ? 0.45 : 0.95;
}

function exitDuration(speed: TransitionSpeed | undefined): number {
  return speed === "fast" ? 0.2 : 0.45;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BoardPreview({ matrix, loading, className, boardModel, cellSize: propCellSize, transition, transitionSpeed, animatePreview }: BoardPreviewProps) {
  const { profile } = useBoardModel();
  const resolvedProfile = boardModel ? BOARD_PROFILES[boardModel] : profile;
  const rows = resolvedProfile.rows;
  const cols = resolvedProfile.cols;
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(propCellSize ?? 14);
  const [animationSeed, setAnimationSeed] = useState(0);

  useEffect(() => {
    if (propCellSize) return;
    const calc = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth - FRAME_PADDING * 2;
      const maxCellW = Math.floor((w - (cols - 1) * GAP) / cols);
      setCellSize(Math.min(Math.max(maxCellW, 8), 24));
    };
    calc();
    const ro = new ResizeObserver(calc);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [propCellSize, cols]);

  useEffect(() => {
    if (!animatePreview || !transition) return;
    const idleMs = 2800;
    const enterMs = enterDuration(transitionSpeed) * 1000;
    const exitMs = exitDuration(transitionSpeed) * 1000;
    const period = Math.round(idleMs + enterMs + exitMs);
    const timer = setInterval(() => {
      setAnimationSeed((prev) => prev + 1);
    }, period);

    return () => {
      clearInterval(timer);
    };
  }, [animatePreview, transition, transitionSpeed]);

  // Re-trigger transition animation when message or settings change.
  useEffect(() => {
    setAnimationSeed((prev) => prev + 1);
  }, [matrix, transition, transitionSpeed]);

  const animateCells = !!animatePreview && !!transition;

  return (
    <motion.div
      ref={containerRef}
      className={cn(
        "relative w-full rounded-2xl overflow-hidden",
        "bg-[#111111] border border-neutral-800",
        "shadow-2xl shadow-black/60",
        className
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Top bezel accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Brand strip */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800/60">
        <span className="text-[10px] font-semibold tracking-[0.25em] text-neutral-600 uppercase">
          Vestaboard
        </span>
        <div className="flex items-center gap-1.5">
          {loading ? (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          )}
          <span className="text-[10px] text-neutral-600">
            {loading ? "Syncing" : "Live"}
          </span>
        </div>
      </div>

      {/* Display area */}
      <div className="flex items-center justify-center p-5">
        {/* Inner frame / bezel */}
        <div
          className="relative rounded-lg overflow-hidden bg-neutral-950 border border-neutral-800 p-4"
          style={{ boxShadow: "inset 0 2px 12px rgba(0,0,0,0.8)" }}
        >
          {/* Subtle inner vignette */}
          <div
            className="absolute inset-0 pointer-events-none rounded-lg"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)",
            }}
          />

          <BoardGrid
            matrix={matrix}
            rows={rows}
            cols={cols}
            loading={loading}
            cellSize={cellSize}
            transitionStyle={transition}
            transitionSpeed={transitionSpeed}
            animateCells={animateCells}
            animationSeed={animationSeed}
          />
        </div>
      </div>

      {/* Bottom bezel accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </motion.div>
  );
}



