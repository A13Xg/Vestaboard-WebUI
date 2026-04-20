"use client";

import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import { Card } from "@/components/ui";
import type { Preset } from "@/types";

interface PresetCardProps {
  preset: Preset;
  onSelect?: (preset: Preset) => void;
  onEdit?: (preset: Preset) => void;
}

export function PresetCard({ preset, onSelect, onEdit }: PresetCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      <Card
        variant="default"
        padding="sm"
        hoverable
        className="group cursor-pointer"
        onClick={() => onSelect?.(preset)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onSelect?.(preset)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-neutral-200 truncate">{preset.label}</p>
            <p className="text-xs text-neutral-600 truncate mt-0.5 font-mono">{preset.text}</p>
          </div>
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(preset);
              }}
              className="rounded p-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              aria-label={`Edit ${preset.label}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
