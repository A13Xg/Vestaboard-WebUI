"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: "left" | "right";
  width?: number;
}

export function Drawer({ open, onClose, title, children, side = "right", width = 480 }: DrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: side === "right" ? width : -width }}
            animate={{ x: 0 }}
            exit={{ x: side === "right" ? width : -width }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className={cn(
              "fixed top-0 bottom-0 z-50 flex flex-col bg-neutral-950 border-neutral-800",
              side === "right" ? "right-0 border-l" : "left-0 border-r"
            )}
            style={{ width }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
              {title && <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>}
              <button
                onClick={onClose}
                className="ml-auto p-1.5 rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
