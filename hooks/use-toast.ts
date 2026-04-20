"use client";

import { useState, useCallback } from "react";

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

let globalToastFn: ((message: string, variant?: ToastVariant) => void) | null = null;

export function setGlobalToast(fn: (message: string, variant?: ToastVariant) => void) {
  globalToastFn = fn;
}

export function toast(message: string, variant: ToastVariant = "default") {
  globalToastFn?.(message, variant);
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((message: string, variant: ToastVariant = "default") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, add, remove };
}
