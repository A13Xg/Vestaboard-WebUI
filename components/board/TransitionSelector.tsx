"use client";

import { Layers, Waves, Wind, RectangleHorizontal } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { TransitionStyle, TransitionSpeed, VestaboardTransition } from "@/types";

// ─── Static option tables ─────────────────────────────────────────────────────

const STYLE_OPTIONS: {
  id: TransitionStyle;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Traditional flip-style",
    icon: Layers,
  },
  {
    id: "wave",
    label: "Wave",
    description: "Wave sweeps across",
    icon: Waves,
  },
  {
    id: "drift",
    label: "Drift",
    description: "Content drifts in",
    icon: Wind,
  },
  {
    id: "curtain",
    label: "Curtain",
    description: "Curtain-style reveal",
    icon: RectangleHorizontal,
  },
];

const SPEED_OPTIONS: {
  id: TransitionSpeed;
  label: string;
  sub: string;
}[] = [
  { id: "gentle", label: "Gentle", sub: "Slower, smoother" },
  { id: "fast", label: "Fast", sub: "Quicker transition" },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface TransitionSelectorProps {
  value: VestaboardTransition;
  onChange: (val: VestaboardTransition) => void;
  /** When provided, renders an "Apply to Board" button */
  onApply?: () => void;
  applying?: boolean;
  /** Compact mode: smaller cards, no descriptions — for use inside compose drawer */
  compact?: boolean;
  className?: string;
}

export function TransitionSelector({
  value,
  onChange,
  onApply,
  applying,
  compact,
  className,
}: TransitionSelectorProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Style chips */}
      {!compact && (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Transition Style
        </p>
      )}
      <div className={cn("grid gap-2", compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4")}>
        {STYLE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = value.transition === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange({ ...value, transition: opt.id })}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all text-center",
                active
                  ? "border-blue-500 bg-blue-950/30 text-blue-300"
                  : "border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-600 hover:bg-neutral-800/40"
              )}
            >
              <Icon
                className={cn("shrink-0", compact ? "w-4 h-4" : "w-5 h-5", active ? "text-blue-400" : "text-neutral-600")}
              />
              <span className={cn("font-medium leading-tight", compact ? "text-[10px]" : "text-xs")}>
                {opt.label}
              </span>
              {!compact && (
                <span className="text-[10px] text-neutral-600 leading-tight">{opt.description}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Speed toggle */}
      {!compact && (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mt-1">
          Speed
        </p>
      )}
      <div className="flex gap-2">
        {SPEED_OPTIONS.map((opt) => {
          const active = value.transitionSpeed === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange({ ...value, transitionSpeed: opt.id })}
              className={cn(
                "flex-1 rounded-lg border py-2 px-3 text-xs font-medium transition-all text-center",
                active
                  ? "border-blue-500 bg-blue-950/30 text-blue-300"
                  : "border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-600 hover:bg-neutral-800/40"
              )}
            >
              {opt.label}
              {!compact && (
                <span className="block text-[10px] font-normal text-neutral-600 mt-0.5">
                  {opt.sub}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {onApply && (
        <Button
          variant="primary"
          size="sm"
          onClick={onApply}
          loading={applying}
          className="mt-1"
        >
          Apply to Board
        </Button>
      )}
    </div>
  );
}
