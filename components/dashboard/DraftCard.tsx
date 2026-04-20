"use client";

import { motion } from "framer-motion";
import { FileText, Clock } from "lucide-react";
import { Card } from "@/components/ui";
import type { Draft } from "@/types";
import { formatRelativeTime } from "@/lib/utils";

interface DraftCardProps {
  draft: Draft;
  onSelect?: (draft: Draft) => void;
}

export function DraftCard({ draft, onSelect }: DraftCardProps) {
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
        className="cursor-pointer group"
        onClick={() => onSelect?.(draft)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onSelect?.(draft)}
      >
        <div className="flex items-start gap-2">
          <FileText className="w-3.5 h-3.5 text-neutral-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            {draft.label && (
              <p className="text-xs font-medium text-neutral-300 truncate">{draft.label}</p>
            )}
            <p className="text-xs text-neutral-500 truncate font-mono">{draft.text}</p>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="w-2.5 h-2.5 text-neutral-700" />
              <span className="text-[10px] text-neutral-700">{formatRelativeTime(draft.updatedAt)}</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
