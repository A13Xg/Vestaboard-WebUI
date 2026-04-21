"use client";

import { useEffect } from "react";

export function WorkflowRunnerHeartbeat() {
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        await fetch("/api/workflows/runner", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Workflow-Runner-Source": "heartbeat",
          },
          body: JSON.stringify({ mode: "due" }),
        });
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
