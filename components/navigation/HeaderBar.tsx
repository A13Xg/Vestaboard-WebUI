"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Align updates to wall-clock second boundaries.
    const msToNextSecond = 1000 - (Date.now() % 1000);
    let interval: ReturnType<typeof setInterval> | null = null;

    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 1000);
    }, msToNextSecond);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  const pstClock = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
  }, [now]);

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
        <div className="hidden sm:flex items-center rounded-md border border-neutral-800 bg-neutral-900/60 px-2.5 py-1">
          <span className="text-[11px] text-neutral-500 mr-1.5">PST</span>
          <span className="text-xs font-mono text-neutral-200 tabular-nums tracking-wide">{pstClock}</span>
        </div>
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
