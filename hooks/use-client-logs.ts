"use client";

import { useEffect, useState } from "react";
import { clearClientLogs, getClientLogs, subscribeClientLogs } from "@/lib/client-logger";

export function useClientLogs() {
  const [logs, setLogs] = useState(getClientLogs());

  useEffect(() => {
    return subscribeClientLogs(() => {
      setLogs(getClientLogs());
    });
  }, []);

  return {
    logs,
    clear: clearClientLogs,
    last: logs[logs.length - 1] ?? null,
  };
}
