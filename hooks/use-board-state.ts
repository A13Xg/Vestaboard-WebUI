"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { boardApi } from "@/lib/api-client";
import type { CurrentDisplayResponse, BoardSyncStatus } from "@/types";
import { MOCK_CURRENT_DISPLAY } from "@/lib/mock-data";
import { pushClientLog } from "@/lib/client-logger";

interface UseBoardStateOptions {
  enabled?: boolean;
}

export function useBoardState(options: UseBoardStateOptions = {}) {
  const { enabled = true } = options;
  const [display, setDisplay] = useState<CurrentDisplayResponse>(MOCK_CURRENT_DISPLAY);
  const [syncing, setSyncing] = useState(false);
  const didAutoRefresh = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setSyncing(true);
    setDisplay((prev) => ({ ...prev, status: "syncing" as BoardSyncStatus }));
    pushClientLog("info", "Refreshing board state");

    const connectivity = await boardApi.connectivity();
    if (connectivity.error) {
      pushClientLog("warn", "Connectivity check failed", connectivity.error.error);
    } else if (connectivity.data.connected) {
      pushClientLog("success", "Vestaboard API validated", `HTTP ${connectivity.data.statusCode}`);
    } else {
      pushClientLog("warn", "Vestaboard API not connected", connectivity.data.reason ?? "Unknown reason");
    }

    const result = await boardApi.current();
    if (result.error === null) {
      setDisplay(result.data);
      const source = result.data.source ?? "unknown";
      pushClientLog("success", "Current board message loaded", `source=${source}, status=${result.data.status}`);
    } else {
      setDisplay((prev) => ({ ...prev, status: "error" as BoardSyncStatus }));
      pushClientLog("error", "Failed to load current board state", result.error.error);
    }
    setSyncing(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || didAutoRefresh.current) return;
    didAutoRefresh.current = true;
    void refresh();
  }, [enabled, refresh]);

  return { display, syncing, refresh };
}
