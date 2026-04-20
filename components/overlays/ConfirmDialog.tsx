"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onCancel}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-sm p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
            >
              <div className="flex items-start gap-3 mb-5">
                <div className={cn(
                  "shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
                  destructive ? "bg-red-500/10" : "bg-amber-500/10"
                )}>
                  <AlertTriangle className={cn("w-4 h-4", destructive ? "text-red-400" : "text-amber-400")} />
                </div>
                <div>
                  <h2 id="confirm-title" className="text-sm font-semibold text-neutral-100">{title}</h2>
                  {description && <p className="text-sm text-neutral-500 mt-1">{description}</p>}
                </div>
                <button onClick={onCancel} className="ml-auto p-1 rounded-lg text-neutral-600 hover:text-neutral-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={onCancel}>{cancelLabel}</Button>
                <Button
                  variant={destructive ? "destructive" : "primary"}
                  size="sm"
                  onClick={onConfirm}
                >
                  {confirmLabel}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
