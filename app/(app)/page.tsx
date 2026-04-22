"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CurrentDisplayCard } from "@/components/dashboard/CurrentDisplayCard";
import { QuickActionGrid } from "@/components/dashboard/QuickActionGrid";
import { PresetCard } from "@/components/dashboard/PresetCard";
import { PresetEditorDialog } from "@/components/dashboard/PresetEditorDialog";
import { MessageHistoryCard } from "@/components/dashboard/MessageHistoryCard";
import { UpcomingStatsCard } from "@/components/dashboard/UpcomingStatsCard";
import { ComposeDrawer } from "@/components/forms/ComposeDrawer";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import { Card, CardHeader, CardTitle, CardDescription, Button } from "@/components/ui";
import { useBoardState } from "@/hooks/use-board-state";
import { presetApi } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { BoardMatrix, MessageHistoryEntry, Preset, PresetCreateRequest, PresetUpdateRequest } from "@/types";

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
  const router = useRouter();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitialText, setComposeInitialText] = useState("");
  const [composeInitialMatrix, setComposeInitialMatrix] = useState<BoardMatrix | undefined>(undefined);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [presetsCollapsed, setPresetsCollapsed] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [createPresetOpen, setCreatePresetOpen] = useState(false);

  async function refreshPresets() {
    const result = await presetApi.list();
    if (result.error) {
      toast(result.error.error, "error");
      return;
    }

    setPresets(result.data.presets);
  }

  useEffect(() => {
    void refreshPresets();
  }, []);

  function openComposeWithPreset(preset: Preset) {
    setComposeInitialMatrix(undefined);
    setComposeInitialText(preset.text);
    setComposeOpen(true);
  }

  function openComposeWithHistory(item: MessageHistoryEntry) {
    setComposeInitialMatrix(item.matrix);
    setComposeInitialText(item.text ?? "");
    setComposeOpen(true);
    toast("Loaded message into composer", "success");
  }

  const savePreset = async (value: PresetCreateRequest | PresetUpdateRequest, id?: string) => {
    const result = id
      ? await presetApi.update(id, value)
      : await presetApi.create(value as PresetCreateRequest);

    if (result.error) {
      toast(result.error.error, "error");
      return;
    }

    if (id) {
      setEditingPreset(null);
      toast("Preset updated", "success");
    } else {
      setCreatePresetOpen(false);
      toast(`Preset created: ${result.data.label}`, "success");
    }

    await refreshPresets();
  };

  const deletePreset = async (id: string) => {
    const result = await presetApi.remove(id);
    if (result.error) {
      toast(result.error.error, "error");
      return;
    }

    setEditingPreset(null);
    toast("Preset deleted", "success");
    await refreshPresets();
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      {/* Board display */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show" className="mx-auto max-w-[980px]">
        <CurrentDisplayCard
          display={display}
          loading={syncing}
          onRefresh={refresh}
        />
      </motion.div>

      <div
        className={cn(
          "grid grid-cols-1 gap-5 mt-5",
          presetsCollapsed ? "xl:grid-cols-[minmax(0,1fr)_56px]" : "xl:grid-cols-[minmax(0,1fr)_320px]"
        )}
      >
        <div className="flex flex-col gap-5 min-w-0">
          <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
            <Card variant="inset" padding="md">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common board operations</CardDescription>
              </CardHeader>
              <QuickActionGrid
                onCompose={() => {
                  setComposeInitialMatrix(undefined);
                  setComposeInitialText("");
                  setComposeOpen(true);
                }}
                onSend={() => toast("No draft to send", "warning")}
                onRefresh={refresh}
                onClearDraft={() => setClearConfirmOpen(true)}
                onTransitionSettings={() => router.push("/settings#transition")}
                onLoadPreset={() => {
                  if (presets.length === 0) {
                    toast("No presets available", "warning");
                    return;
                  }
                  openComposeWithPreset(presets[0]);
                }}
                hasDraft={false}
                sending={false}
              />
            </Card>
          </motion.div>

          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
            <UpcomingStatsCard presetsCount={presets.length} />
          </motion.div>

        </div>

        <div className="flex flex-col gap-5">
          <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show">
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
                      onSelect={() => openComposeWithPreset(preset)}
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

          <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show">
            <MessageHistoryCard
              onSelectMessage={openComposeWithHistory}
              collapsible
              defaultCollapsed
            />
          </motion.div>
        </div>
      </div>

      <ComposeDrawer
        open={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          setComposeInitialText("");
          setComposeInitialMatrix(undefined);
        }}
        initialText={composeInitialText}
        initialMatrix={composeInitialMatrix}
        onSend={refresh}
      />

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
        onDelete={deletePreset}
      />
    </div>
  );
}
