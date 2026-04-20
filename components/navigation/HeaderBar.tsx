"use client";

import { Menu, RefreshCw, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useSidebar } from "@/components/layout/SidebarContext";
import { Button } from "@/components/ui";
import { useIsMobile } from "@/hooks/use-media-query";
import { APP_NAME } from "@/config";

interface HeaderBarProps {
  title?: string;
  onRefresh?: () => void;
  syncing?: boolean;
}

export function HeaderBar({ title, onRefresh, syncing }: HeaderBarProps) {
  const { toggle } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <header className="shrink-0 h-14 flex items-center gap-3 px-4 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-sm">
      {isMobile && (
        <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Toggle sidebar">
          <Menu className="w-4 h-4" />
        </Button>
      )}

      <div className="flex-1 flex items-center gap-2">
        {isMobile && (
          <span className="text-sm font-semibold text-neutral-100">{APP_NAME}</span>
        )}
        {title && !isMobile && (
          <span className="text-sm text-neutral-400">{title}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onRefresh && (
          <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label="Refresh">
            <motion.div animate={{ rotate: syncing ? 360 : 0 }} transition={{ duration: 1, repeat: syncing ? Infinity : 0, ease: "linear" }}>
              <RefreshCw className="w-3.5 h-3.5" />
            </motion.div>
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Notifications">
          <Bell className="w-3.5 h-3.5" />
        </Button>
        <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold text-white">
          U
        </div>
      </div>
    </header>
  );
}
