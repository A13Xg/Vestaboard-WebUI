"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { Sidebar } from "@/components/navigation";
import { HeaderBar } from "@/components/navigation";
import { LogDock } from "@/components/feedback";
import { WorkflowRunnerHeartbeat } from "@/components/workflows/WorkflowRunnerHeartbeat";
import { useBoardState } from "@/hooks/use-board-state";
import { useSession } from "@/hooks/use-session";
import { pushClientLog } from "@/lib/client-logger";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, isAuthenticated } = useSession();
  const { syncing, refresh } = useBoardState({ enabled: isAuthenticated });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      pushClientLog("warn", "Session is not authenticated", "Redirecting to /login");
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="h-screen bg-neutral-950 flex items-center justify-center text-sm text-neutral-500">
        Restoring session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-neutral-950">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <HeaderBar onRefresh={refresh} syncing={syncing} />
          <WorkflowRunnerHeartbeat />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
          <LogDock />
        </div>
      </div>
    </SidebarProvider>
  );
}
