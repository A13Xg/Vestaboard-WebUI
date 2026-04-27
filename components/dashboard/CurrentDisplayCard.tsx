"use client";

import { motion } from "framer-motion";
import { RefreshCw, Clock, Wifi, WifiOff } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { Button } from "@/components/ui";
import { BoardPreview } from "@/components/board";
import { formatRelativeTime } from "@/lib/utils";
import type { CurrentDisplayResponse } from "@/types";

interface CurrentDisplayCardProps {
  display: CurrentDisplayResponse;
  loading?: boolean;
  onRefresh?: () => void;
}

const STATUS_BADGE = {
  synced: { variant: "success" as const, label: "Synced", icon: Wifi },
  syncing: { variant: "warning" as const, label: "Syncing…", icon: RefreshCw },
  stale: { variant: "warning" as const, label: "Stale", icon: Clock },
  error: { variant: "error" as const, label: "Error", icon: WifiOff },
  offline: { variant: "error" as const, label: "Offline", icon: WifiOff },
};

export function CurrentDisplayCard({ display, loading, onRefresh }: CurrentDisplayCardProps) {
  const statusConfig = STATUS_BADGE[display.status];

  return (
    <Card variant="inset" padding="none" className="overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800/60">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-indigo-500" />
          <span className="text-sm font-semibold text-neutral-200">Currently Displayed</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusConfig.variant} dot>
            {statusConfig.label}
          </Badge>
          {onRefresh && (
            <Button variant="ghost" size="icon-sm" onClick={onRefresh} disabled={loading}>
              <motion.div
                animate={{ rotate: loading ? 360 : 0 }}
                transition={{ duration: 0.8, repeat: loading ? Infinity : 0, ease: "linear" }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </motion.div>
            </Button>
          )}
        </div>
      </div>

      {/* Board preview */}
      <div className="p-5">
        <BoardPreview
          matrix={display.message?.matrix}
          loading={loading}
        />
      </div>

      {/* Footer meta */}
      <div className="flex items-center justify-between px-5 pb-4">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-neutral-600" />
          <span className="text-xs text-neutral-600">
            {display.message?.sentAt
              ? `Last sent ${formatRelativeTime(display.message.sentAt)}`
              : "No message sent yet"}
          </span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] uppercase tracking-wide text-neutral-700">
            {display.source === "live" ? "Live" : "Mock"}
          </span>
          {display.message?.label && (
            <span className="text-xs text-neutral-600 truncate max-w-[160px]">
              {display.message.label}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
