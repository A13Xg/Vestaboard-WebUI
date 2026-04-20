"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CurrentDisplayCard } from "@/components/dashboard/CurrentDisplayCard";
import { QuickActionGrid } from "@/components/dashboard/QuickActionGrid";
import { PresetCard } from "@/components/dashboard/PresetCard";
import { PresetEditorDialog } from "@/components/dashboard/PresetEditorDialog";
import { MessageHistoryCard } from "@/components/dashboard/MessageHistoryCard";
import { ComposeDrawer } from "@/components/forms/ComposeDrawer";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import { Card, CardHeader, CardTitle, CardDescription, Button } from "@/components/ui";
import { useBoardState } from "@/hooks/use-board-state";
import { MOCK_PRESETS } from "@/lib/mock-data";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Preset } from "@/types";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, type: "spring" as const, stiffness: 300, damping: 28 },
  }),
};

export default function DashboardPage() {
  const { display, syncing, refresh } = useBoardState();
  const [composeOpen, setComposeOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [presetsCollapsed, setPresetsCollapsed] = useState(false);
  const [presets, setPresets] = useState<Preset[]>(MOCK_PRESETS);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [createPresetOpen, setCreatePresetOpen] = useState(false);
  const [hasDraft] = useState(false);

  const savePreset = (value: Omit<Preset, "id">, id?: string) => {
    if (!id) {
      const created: Preset = {
        id: `preset-${Date.now()}`,
        ...value,
      };
      setPresets((prev) => [created, ...prev]);
      setCreatePresetOpen(false);
      toast(`Preset created: ${created.label}`, "success");
      return;
    }

    setPresets((prev) => prev.map((preset) => (
      preset.id === id ? { ...preset, ...value } : preset
    )));
    setEditingPreset(null);
    toast("Preset updated", "success");
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      {/* Two-column layout on large screens */}
      <div
        className={cn(
          "grid grid-cols-1 gap-5",
          presetsCollapsed ? "xl:grid-cols-[minmax(0,1fr)_56px]" : "xl:grid-cols-[minmax(0,1fr)_320px]"
        )}
      >

        {/* ── Left / Main column ─────────────────────────────── */}
        <div className="flex flex-col gap-5 min-w-0">

          {/* Current display */}
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
            <CurrentDisplayCard
              display={display}
              loading={syncing}
              onRefresh={refresh}
            />
          </motion.div>

          {/* Quick actions */}
          <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
            <Card variant="inset" padding="md">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common board operations</CardDescription>
              </CardHeader>
              <QuickActionGrid
                onCompose={() => setComposeOpen(true)}
                onSend={() => toast("No draft to send", "warning")}
                onRefresh={refresh}
                onClearDraft={() => setClearConfirmOpen(true)}
                onTransitionSettings={() => toast("Transitions coming soon", "default")}
                onLoadPreset={() => toast("Preset picker coming soon", "default")}
                hasDraft={hasDraft}
                sending={false}
              />
            </Card>
          </motion.div>

          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
            <MessageHistoryCard />
          </motion.div>
        </div>

        {/* ── Right / Sidebar column ─────────────────────────── */}
        <div className="flex flex-col gap-5">
          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show">
            <Card variant="inset" padding="md">
              <CardHeader className="pb-2">
                <div className={cn("flex gap-2", presetsCollapsed ? "items-center justify-center" : "items-center justify-between")}>
                  {!presetsCollapsed && (
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div>
                        <CardTitle>Presets</CardTitle>
                        <CardDescription>Quick-send saved messages</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setCreatePresetOpen(true)}
                        aria-label="Create preset"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </Button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setPresetsCollapsed((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-200 transition-colors"
                    aria-label={presetsCollapsed ? "Expand presets" : "Collapse presets"}
                  >
                    {presetsCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    {!presetsCollapsed && "Collapse"}
                  </button>
                </div>
              </CardHeader>
              {!presetsCollapsed && (
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[50vh] pr-1">
                  {presets.map((preset) => (
                    <PresetCard
                      key={preset.id}
                      preset={preset}
                      onSelect={() => toast(`Loading preset: ${preset.label}`, "default")}
                      onEdit={() => setEditingPreset(preset)}
                    />
                  ))}
                </div>
              )}
              {presetsCollapsed && (
                <div className="h-[50vh] flex items-center justify-center">
                  <span className="text-[11px] uppercase tracking-widest text-neutral-700 [writing-mode:vertical-rl]">
                    Presets
                  </span>
                </div>
              )}
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Compose Drawer */}
      <ComposeDrawer
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSend={refresh}
      />

      {/* Clear draft confirm */}
      <ConfirmDialog
        open={clearConfirmOpen}
        title="Clear draft?"
        description="This will discard your current unsaved draft."
        confirmLabel="Clear"
        destructive
        onConfirm={() => {
          setClearConfirmOpen(false);
          toast("Draft cleared", "default");
        }}
        onCancel={() => setClearConfirmOpen(false)}
      />

      <PresetEditorDialog
        open={createPresetOpen}
        mode="create"
        onClose={() => setCreatePresetOpen(false)}
        onSave={savePreset}
      />

      <PresetEditorDialog
        open={!!editingPreset}
        mode="edit"
        initialPreset={editingPreset}
        onClose={() => setEditingPreset(null)}
        onSave={savePreset}
      />
    </div>
  );
}
