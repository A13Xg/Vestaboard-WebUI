"use client";

import { useState, useEffect } from "react";
import { authApi } from "@/lib/api-client";
import type { SessionData } from "@/types";
import { pushClientLog } from "@/lib/client-logger";

export function useSession() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.session().then((result) => {
      if (result.error === null) {
        setSession(result.data);
        pushClientLog(
          result.data.isAuthenticated ? "success" : "warn",
          "Session check completed",
          result.data.isAuthenticated ? "Authenticated" : "Not authenticated"
        );
      } else {
        pushClientLog("error", "Session check failed", result.error.error);
      }
      setLoading(false);
    });
  }, []);

  return { session, loading, isAuthenticated: session?.isAuthenticated ?? false };
}
