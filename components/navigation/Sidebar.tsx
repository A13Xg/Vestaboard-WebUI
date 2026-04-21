"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  PenLine,
  Smartphone,
  CalendarClock,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/layout/SidebarContext";
import { useIsMobile } from "@/hooks/use-media-query";
import { APP_NAME, APP_TAGLINE } from "@/config";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compose", label: "Compose", icon: PenLine },
  { href: "/quick-send", label: "Quick Send", icon: Smartphone },
  { href: "/workflows", label: "Workflows", icon: CalendarClock },
  { href: "/settings", label: "Settings", icon: Settings },
];

const SIDEBAR_W_OPEN = 240;
const SIDEBAR_W_CLOSED = 64;

export function Sidebar() {
  const { open, toggle, close } = useSidebar();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn("flex items-center px-4 py-5 gap-3", !open && "justify-center px-0")}>
        <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="text-sm font-semibold text-neutral-100 whitespace-nowrap">{APP_NAME}</p>
              <p className="text-[10px] text-neutral-500 whitespace-nowrap">{APP_TAGLINE}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-px bg-neutral-800 mx-3 mb-3" />

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 overflow-y-auto min-h-0">
        <p className={cn("text-[10px] font-semibold text-neutral-600 uppercase tracking-widest px-2 mb-1", !open && "hidden")}>
          Navigation
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={isMobile ? close : undefined}
              className={cn(
                "flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm transition-colors group relative",
                active
                  ? "bg-indigo-600/15 text-indigo-400"
                  : "text-neutral-500 hover:text-neutral-100 hover:bg-neutral-800"
              )}
            >
              <Icon className={cn("shrink-0 w-4 h-4", active && "text-indigo-400")} />
              <AnimatePresence>
                {open && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-indigo-500"
                />
              )}
            </Link>
          );
        })}

      </nav>

      {/* Collapse toggle — desktop only */}
      {!isMobile && (
        <div className="p-3">
          <button
            onClick={toggle}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors border border-neutral-800 hover:border-neutral-700"
          >
            {open ? (
              <>
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Collapse</span>
              </>
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={close}
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: -SIDEBAR_W_OPEN }}
              animate={{ x: 0 }}
              exit={{ x: -SIDEBAR_W_OPEN }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 z-50 bg-neutral-950 border-r border-neutral-800"
              style={{ width: SIDEBAR_W_OPEN }}
            >
              <button
                onClick={close}
                className="absolute right-3 top-4 p-1.5 rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <motion.aside
      animate={{ width: open ? SIDEBAR_W_OPEN : SIDEBAR_W_CLOSED }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="shrink-0 h-full bg-neutral-950 border-r border-neutral-800 overflow-hidden"
    >
      {sidebarContent}
    </motion.aside>
  );
}
