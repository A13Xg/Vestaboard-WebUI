"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Wifi, Moon, Sun, KeyRound, Sliders } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from "@/components/ui";
import { TransitionSelector } from "@/components/board";
import { boardApi, authApi } from "@/lib/api-client";
import type { CurrentDisplayResponse, VestaboardTransition } from "@/types";
import { pushClientLog } from "@/lib/client-logger";
import { useBoardModel } from "@/hooks/use-board-model";
import { toast } from "@/hooks/use-toast";

const DEFAULT_TRANSITION: VestaboardTransition = { transition: "classic", transitionSpeed: "gentle" };

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, type: "spring" as const, stiffness: 300, damping: 28 },
  }),
};

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-neutral-800/60 last:border-0">
      <div>
        <p className="text-sm text-neutral-200">{label}</p>
        {description && <p className="text-xs text-neutral-600 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { model, setModel, profile } = useBoardModel();
  const [connectivity, setConnectivity] = useState<{ connected: boolean; reason: string | null; statusCode: number } | null>(null);
  const [currentDisplay, setCurrentDisplay] = useState<CurrentDisplayResponse | null>(null);
  const [transition, setTransition] = useState<VestaboardTransition>(DEFAULT_TRANSITION);
  const [applyingTransition, setApplyingTransition] = useState(false);

  async function refreshConnectivityAndBoard() {
    const conn = await boardApi.connectivity();
    if (conn.error) {
      pushClientLog("error", "Connectivity check failed", conn.error.error);
      setConnectivity(null);
      return;
    }

    setConnectivity(conn.data);
    if (!conn.data.connected) {
      pushClientLog("warn", "Vestaboard connectivity not ready", conn.data.reason ?? "Unknown reason");
      return;
    }

    pushClientLog("success", "Vestaboard API key validated", `HTTP ${conn.data.statusCode}`);
    const current = await boardApi.current();
    if (current.error) {
      pushClientLog("error", "Current board fetch failed", current.error.error);
      return;
    }
    setCurrentDisplay(current.data);
    pushClientLog("success", "Current board content loaded into settings");
  }

  async function signOut() {
    const result = await authApi.logout();
    if (result.error) {
      pushClientLog("error", "Sign out failed", result.error.error);
      return;
    }
    pushClientLog("info", "Session ended", "Redirecting to login");
    router.replace("/login");
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshConnectivityAndBoard();
    boardApi.getTransition().then((result) => {
      if (!result.error) setTransition(result.data);
    });
  }, []);

  async function applyTransition() {
    setApplyingTransition(true);
    const result = await boardApi.setTransition(transition);
    if (result.error) {
      toast(result.error.error, "error");
    } else {
      toast(`Transition set: ${transition.transition} / ${transition.transitionSpeed}`, "success");
    }
    setApplyingTransition(false);
  }

  return (
    <div className="p-4 lg:p-6 max-w-[720px] mx-auto">
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show" className="mb-6">
        <h1 className="text-xl font-bold text-neutral-100">Settings</h1>
        <p className="text-sm text-neutral-500 mt-1">Manage your board and application preferences</p>
      </motion.div>

      <div className="flex flex-col gap-4">
        {/* API Connectivity */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
          <Card variant="inset" padding="lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-neutral-500" />
                API Connectivity
              </CardTitle>
              <CardDescription>Vestaboard API connection status</CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsRow label="Vestaboard API" description="Read/Write key authentication">
                <Badge variant={connectivity?.connected ? "success" : "warning"} dot>
                  {connectivity?.connected ? "Connected" : "Pending"}
                </Badge>
              </SettingsRow>
              <SettingsRow label="API Token" description="Set via VESTABOARD_API_TOKEN env variable">
                <Badge variant="default">Env Var</Badge>
              </SettingsRow>
              <SettingsRow label="Last Sync" description="Time of last successful board sync">
                <span className="text-xs text-neutral-500">
                  {connectivity ? `HTTP ${connectivity.statusCode || 0}` : "Checking..."}
                </span>
              </SettingsRow>
              <SettingsRow label="Current Loaded Message" description="Pulled immediately after API validation">
                <span className="text-xs text-neutral-400 max-w-[320px] truncate">
                  {currentDisplay?.message?.text || currentDisplay?.message?.label || "No live message text available"}
                </span>
              </SettingsRow>
              <div className="pt-2">
                <Button variant="secondary" size="sm" onClick={refreshConnectivityAndBoard}>Re-validate and fetch current</Button>
              </div>
              {connectivity?.reason && (
                <p className="text-xs text-amber-400 mt-2">{connectivity.reason}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Appearance */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
          <Card variant="inset" padding="lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-neutral-500" />
                Appearance
              </CardTitle>
              <CardDescription>Theme and display preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsRow label="Theme" description="Dark mode only — light theme coming soon">
                <div className="flex gap-1">
                  <Button variant="secondary" size="xs">
                    <Moon className="w-3 h-3" /> Dark
                  </Button>
                  <Button variant="ghost" size="xs" disabled title="Light theme not yet available">
                    <Sun className="w-3 h-3" /> Light
                  </Button>
                </div>
              </SettingsRow>
            </CardContent>
          </Card>
        </motion.div>

        {/* Board Settings */}
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show">
          <Card variant="inset" padding="lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-neutral-500" />
                Board Settings
              </CardTitle>
              <CardDescription>Display behavior and transition preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsRow label="Transition" description="Effect applied when sending new messages to the board">
                <div />
              </SettingsRow>
              <div className="pb-3 border-b border-neutral-800/60">
                <TransitionSelector
                  value={transition}
                  onChange={setTransition}
                  onApply={applyTransition}
                  applying={applyingTransition}
                />
              </div>
              <SettingsRow label="Board Model" description="Target device format">
                <Badge variant="default">{profile.rows}x{profile.cols}</Badge>
              </SettingsRow>
              <SettingsRow label="Display Type" description="Choose full Vestaboard or Vestaboard Note visuals">
                <div className="flex gap-1">
                  <Button
                    variant={model === "flagship" ? "secondary" : "ghost"}
                    size="xs"
                    onClick={() => setModel("flagship")}
                  >
                    Full 6x22
                  </Button>
                  <Button
                    variant={model === "note" ? "secondary" : "ghost"}
                    size="xs"
                    onClick={() => setModel("note")}
                  >
                    Note 3x15
                  </Button>
                </div>
              </SettingsRow>
            </CardContent>
          </Card>
        </motion.div>

        {/* Session */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show">
          <Card variant="inset" padding="lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-neutral-500" />
                Session
              </CardTitle>
              <CardDescription>Current authentication session</CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsRow label="Status" description="Currently authenticated">
                <Badge variant="success" dot>Active</Badge>
              </SettingsRow>
              <SettingsRow label="Sign Out" description="Clear session and return to login">
                <Button variant="destructive" size="sm" onClick={signOut}>Sign Out</Button>
              </SettingsRow>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
