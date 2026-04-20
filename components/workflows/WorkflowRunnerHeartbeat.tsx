"use client";

import { useEffect } from "react";
import { workflowApi } from "@/lib/api-client";

export function WorkflowRunnerHeartbeat() {
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        await workflowApi.runDue();
      } catch {
        // Silent heartbeat; visible workflow status remains on the workflows page.
      }
    };

    void tick();
    const interval = setInterval(() => {
      void tick();
    }, 30_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void tick();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
