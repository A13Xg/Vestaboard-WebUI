"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast, setGlobalToast, type Toast, type ToastVariant } from "@/hooks/use-toast";

const ICONS: Record<ToastVariant, React.ElementType> = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
};

const STYLES: Record<ToastVariant, string> = {
  default: "bg-neutral-800 border-neutral-700 text-neutral-200",
  success: "bg-emerald-950 border-emerald-800 text-emerald-200",
  error: "bg-red-950 border-red-800 text-red-200",
  warning: "bg-amber-950 border-amber-800 text-amber-200",
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const Icon = ICONS[toast.variant];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className={cn(
        "flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm max-w-sm w-full",
        STYLES[toast.variant]
      )}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={onRemove}
        className="p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export function ToastProvider() {
  const { toasts, add, remove } = useToast();

  useEffect(() => {
    setGlobalToast(add);
  }, [add]);

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={() => remove(t.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
