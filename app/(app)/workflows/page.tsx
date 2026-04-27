"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  CalendarClock,
  Check,
  Play,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Workflow as WorkflowIcon,
  X,
} from "lucide-react";
import { BoardPreview } from "@/components/board";
import { CurrentDisplayCard } from "@/components/dashboard/CurrentDisplayCard";
import { UpcomingStatsCard } from "@/components/dashboard/UpcomingStatsCard";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui";
import { useBoardState } from "@/hooks/use-board-state";
import { useBoardModel } from "@/hooks/use-board-model";
import { workflowApi } from "@/lib/api-client";
import { BOARD_COLOR_TOKENS } from "@/lib/board-utils";
import { GEMMA_MODEL } from "@/lib/gemma-server";
import { WORKFLOW_INTEGRATIONS, getWorkflowIntegrationDefinition } from "@/lib/workflow-integration-defs";
import { getScheduleSummary } from "@/lib/workflow-scheduler";
import { toast } from "@/hooks/use-toast";
import type {
  Workflow,
  WorkflowCreateRequest,
  WorkflowDataSource,
  WorkflowDataSourceProviderId,
  GemmaConnectivityResponse,
  WorkflowPreviewResponse,
  WorkflowScheduleType,
} from "@/types";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, type: "spring" as const, stiffness: 320, damping: 26 },
  }),
};

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

type BuilderMode = "static" | "integration";

type WorkflowSourceForm = {
  enabled: boolean;
  config: Record<string, string>;
};

type WorkflowFormState = {
  name: string;
  enabled: boolean;
  mode: BuilderMode;
  sources: Partial<Record<WorkflowDataSourceProviderId, WorkflowSourceForm>>;
  outputTemplate: string;
  scheduleType: WorkflowScheduleType;
  timeHHMM: string;
  onceAt: string;
  cron: string;
  daysOfWeek: number[];
};

function defaultsForProvider(providerId: WorkflowDataSourceProviderId) {
  const definition = getWorkflowIntegrationDefinition(providerId);
  return Object.fromEntries((definition?.fields ?? []).map((field) => [field.key, field.defaultValue ?? ""]));
}

const DEFAULT_PROVIDER: WorkflowDataSourceProviderId = "weather";

const COLOR_PLACEHOLDER_BADGES = Object.keys(BOARD_COLOR_TOKENS).map((token) => `{${token}}`);

function buildDefaultSources() {
  return {
    [DEFAULT_PROVIDER]: {
      enabled: true,
      config: defaultsForProvider(DEFAULT_PROVIDER),
    },
  } satisfies Partial<Record<WorkflowDataSourceProviderId, WorkflowSourceForm>>;
}

const EMPTY_FORM: WorkflowFormState = {
  name: "",
  enabled: true,
  mode: "integration",
  sources: buildDefaultSources(),
  outputTemplate: getWorkflowIntegrationDefinition(DEFAULT_PROVIDER)?.defaultTemplate ?? "",
  scheduleType: "daily",
  timeHHMM: "09:00",
  onceAt: "",
  cron: "0 * * * *",
  daysOfWeek: [1, 2, 3, 4, 5],
};

function toIsoLocal(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toLocalInputValue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export default function WorkflowsPage() {
  const { model } = useBoardModel();
  const { display, syncing, refresh: refreshBoard } = useBoardState();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkflowFormState>(EMPTY_FORM);
  const [preview, setPreview] = useState<WorkflowPreviewResponse | null>(null);
  const [gemmaStatus, setGemmaStatus] = useState<GemmaConnectivityResponse | null>(null);
  const [checkingGemma, setCheckingGemma] = useState(false);
  const [activeProviderDialog, setActiveProviderDialog] = useState<WorkflowDataSourceProviderId | null>(null);

  const editingWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === editingId) ?? null,
    [workflows, editingId]
  );

  const activeProviders = useMemo(
    () => Object.entries(form.sources)
      .filter(([, source]) => !!source && source.enabled !== false)
      .map(([providerId]) => providerId as WorkflowDataSourceProviderId),
    [form.sources],
  );

  const activeIntegration = useMemo(
    () => activeProviderDialog ? getWorkflowIntegrationDefinition(activeProviderDialog) : undefined,
    [activeProviderDialog],
  );

  async function refreshWorkflows() {
    setLoading(true);
    const result = await workflowApi.list();
    if (result.error) {
      toast(result.error.error, "error");
    } else {
      setWorkflows(result.data.workflows);
    }
    setLoading(false);
  }

  async function refreshGemmaConnectivity({ silent = false }: { silent?: boolean } = {}) {
    setCheckingGemma(true);
    const result = await workflowApi.gemmaConnectivity();
    setCheckingGemma(false);

    if (result.error) {
      const unavailable: GemmaConnectivityResponse = {
        connected: false,
        reason: result.error.error,
        statusCode: 0,
        model: GEMMA_MODEL,
      };
      setGemmaStatus(unavailable);
      if (!silent) {
        toast(unavailable.reason ?? "Unable to verify Gemma connectivity", "error");
      }
      return unavailable;
    }

    setGemmaStatus(result.data);
    if (!result.data.connected && !silent) {
      toast(result.data.reason ?? "Gemma is unavailable", "error");
    }
    return result.data;
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshWorkflows();
    void refreshGemmaConnectivity({ silent: true });
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sources: buildDefaultSources() });
    setPreview(null);
  }

  function applyEdit(workflow: Workflow) {
    const existingSources = workflow.dataSources ?? (workflow.dataSource ? [workflow.dataSource] : []);
    const sourceMap: Partial<Record<WorkflowDataSourceProviderId, WorkflowSourceForm>> = {};
    for (const source of existingSources) {
      sourceMap[source.providerId] = {
        enabled: source.enabled !== false,
        config: source.config,
      };
    }

    if (Object.keys(sourceMap).length === 0) {
      sourceMap[DEFAULT_PROVIDER] = { enabled: true, config: defaultsForProvider(DEFAULT_PROVIDER) };
    }

    setEditingId(workflow.id);
    setForm({
      name: workflow.name,
      enabled: workflow.enabled,
      mode: existingSources.length > 0 ? "integration" : "static",
      sources: sourceMap,
      outputTemplate: workflow.message.text,
      scheduleType: workflow.schedule.type,
      timeHHMM: workflow.schedule.timeHHMM ?? "09:00",
      onceAt: toLocalInputValue(workflow.schedule.at),
      cron: workflow.schedule.cron ?? "0 * * * *",
      daysOfWeek: workflow.schedule.daysOfWeek ?? [1, 2, 3, 4, 5],
    });
    setPreview(null);
  }

  function toggleWeekday(day: number) {
    setForm((prev) => {
      const exists = prev.daysOfWeek.includes(day);
      return {
        ...prev,
        daysOfWeek: exists ? prev.daysOfWeek.filter((item) => item !== day) : [...prev.daysOfWeek, day].sort(),
      };
    });
  }

  function toggleProvider(providerId: WorkflowDataSourceProviderId, enabled: boolean) {
    setForm((prev) => ({
      ...prev,
      mode: "integration",
      sources: {
        ...prev.sources,
        [providerId]: {
          enabled,
          config: prev.sources[providerId]?.config ?? defaultsForProvider(providerId),
        },
      },
      outputTemplate: prev.outputTemplate || getWorkflowIntegrationDefinition(providerId)?.defaultTemplate || prev.outputTemplate,
    }));
  }

  function updateProviderConfig(providerId: WorkflowDataSourceProviderId, key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      sources: {
        ...prev.sources,
        [providerId]: {
          enabled: prev.sources[providerId]?.enabled !== false,
          config: {
            ...(prev.sources[providerId]?.config ?? defaultsForProvider(providerId)),
            [key]: value,
          },
        },
      },
    }));
  }

  async function ensureGemmaReady() {
    if (form.mode !== "integration") return true;
    if (!form.sources.gemma || form.sources.gemma.enabled === false) return true;
    if (gemmaStatus?.connected) return true;
    const status = await refreshGemmaConnectivity();
    return status.connected;
  }

  function buildDataSources(): WorkflowDataSource[] {
    if (form.mode !== "integration") return [];
    return (Object.entries(form.sources) as [WorkflowDataSourceProviderId, WorkflowSourceForm | undefined][])
      .filter(([, source]) => !!source && source.enabled !== false)
      .map(([providerId, source]) => ({
        providerId,
        config: source?.config ?? {},
        enabled: source?.enabled !== false,
      }));
  }

  function buildPayload(): WorkflowCreateRequest {
    const dataSources = buildDataSources();
    const outputTemplate = form.outputTemplate.trim();

    return {
      name: form.name.trim(),
      enabled: form.enabled,
      message: {
        text: outputTemplate,
        alignment: "center",
        style: "default",
      },
      dataSource: dataSources[0] ?? null,
      dataSources,
      schedule:
        form.scheduleType === "once"
          ? { type: "once", at: toIsoLocal(form.onceAt) }
          : form.scheduleType === "daily"
            ? { type: "daily", timeHHMM: form.timeHHMM }
            : form.scheduleType === "weekly"
              ? { type: "weekly", timeHHMM: form.timeHHMM, daysOfWeek: form.daysOfWeek }
              : { type: "cron", cron: form.cron },
    };
  }

  async function refreshPreview() {
    if (!form.outputTemplate.trim()) {
      toast("Output template is required", "warning");
      return;
    }

    if (!(await ensureGemmaReady())) {
      setPreview(null);
      return;
    }

    setPreviewing(true);
    const dataSources = buildDataSources();
    const result = await workflowApi.preview({
      message: { text: form.outputTemplate },
      dataSource: dataSources[0] ?? null,
      dataSources,
      boardModel: model,
    });

    if (result.error) {
      toast(result.error.error, "error");
      setPreview(null);
    } else {
      setPreview(result.data);
      toast("Preview rendered", "success");
    }

    setPreviewing(false);
  }

  async function onSubmit() {
    if (!form.name.trim()) {
      toast("Workflow name is required", "warning");
      return;
    }
    if (!form.outputTemplate.trim()) {
      toast("Workflow output template is required", "warning");
      return;
    }

    if (!(await ensureGemmaReady())) {
      return;
    }

    setSaving(true);
    const payload = buildPayload();
    const result = editingId
      ? await workflowApi.update(editingId, payload)
      : await workflowApi.create(payload);

    if (result.error) {
      toast(result.error.error, "error");
    } else {
      toast(editingId ? "Workflow updated" : "Workflow created", "success");
      resetForm();
      await refreshWorkflows();
    }
    setSaving(false);
  }

  async function onDelete(id: string) {
    const result = await workflowApi.remove(id);
    if (result.error) {
      toast(result.error.error, "error");
      return;
    }
    toast("Workflow deleted", "success");
    if (editingId === id) resetForm();
    await refreshWorkflows();
  }

  async function onRunNow(id: string) {
    const result = await workflowApi.runById(id);
    if (result.error) {
      toast(result.error.error, "error");
      return;
    }
    const run = result.data.results[0];
    toast(run?.success ? `Executed: ${run.workflowName}` : run?.message ?? "Execution failed", run?.success ? "success" : "warning");
    await refreshWorkflows();
    await refreshBoard();
  }

  async function onRunDue() {
    const result = await workflowApi.runDue();
    if (result.error) {
      toast(result.error.error, "error");
      return;
    }
    toast(`Triggered ${result.data.triggered} due workflow(s)`, "success");
    await refreshWorkflows();
    await refreshBoard();
  }

  const schedulerDiagnosis = [
    "Workflows previously lived only in server memory, so they vanished on reload or restart.",
    "Nothing automatically evaluated due jobs unless /api/workflows/runner was called manually.",
    "The app now persists workflows in data/workflows.json and silently checks due jobs every 30 seconds while the Web UI is open.",
    "For unattended execution with no browser open, call /api/workflows/runner using CRON_SECRET from a system or Vercel cron.",
  ];
  const gemmaBadgeVariant = checkingGemma
    ? "info"
    : gemmaStatus?.connected
      ? "success"
      : "error";
  const gemmaStatusLabel = checkingGemma
    ? "Checking"
    : gemmaStatus?.connected
      ? "Verified"
      : "Unavailable";

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show" className="mx-auto max-w-[980px]">
        <CurrentDisplayCard display={display} loading={syncing} onRefresh={refreshBoard} />
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 mt-5">
        <div className="flex flex-col gap-5 min-w-0">
          <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
            <UpcomingStatsCard presetsCount={0} />
          </motion.div>

          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
            <Card variant="inset" padding="lg">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="inline-flex items-center gap-2">
                      <WorkflowIcon className="w-4 h-4 text-neutral-500" />
                      Workflow Studio
                    </CardTitle>
                    <CardDescription>Build static or integration-driven automations with reusable output templates.</CardDescription>
                  </div>
                  <Button variant="secondary" onClick={onRunDue}>
                    <Play className="w-4 h-4" />
                    Run Due Now
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    id="workflow-name"
                    label="Workflow Name"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Hourly Weather Los Angeles"
                  />

                  <div className="flex items-end">
                    <div className="w-full rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Enabled</p>
                        <p className="text-xs text-neutral-600 mt-0.5">Disable to keep the workflow saved without running.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.enabled}
                        onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Mode</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(["integration", "static"] as BuilderMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, mode }))}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm transition-colors text-left",
                          form.mode === mode
                            ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                            : "border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700"
                        )}
                      >
                        <span className="block font-medium capitalize">{mode}</span>
                        <span className="block text-[11px] text-neutral-600 mt-0.5">
                          {mode === "integration" ? "Fetch live data and render it into a message template." : "Send a fixed message on a schedule."}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {form.mode === "integration" && (
                  <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/30 p-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Data Providers</p>
                      <p className="text-xs text-neutral-600 mt-1">Click any integration to open settings, wildcards, and enable controls. Mix multiple providers in one template.</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-neutral-500">Gemma connection</span>
                        <Badge variant={gemmaBadgeVariant} dot>{gemmaStatusLabel}</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => void refreshGemmaConnectivity()}
                          loading={checkingGemma}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Verify Gemma
                        </Button>
                        {gemmaStatus?.reason && !gemmaStatus.connected && (
                          <span className="text-[11px] text-red-400">{gemmaStatus.reason}</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                      {WORKFLOW_INTEGRATIONS.map((provider) => (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => {
                            setActiveProviderDialog(provider.id);
                            if (!form.sources[provider.id]) {
                              toggleProvider(provider.id, true);
                            }
                          }}
                          disabled={provider.id === "gemma" && !gemmaStatus?.connected}
                          className={cn(
                            "rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                            form.sources[provider.id]?.enabled
                              ? "border-indigo-500/50 bg-indigo-500/10"
                              : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-700"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-neutral-200">{provider.label}</p>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={form.sources[provider.id]?.enabled !== false}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => toggleProvider(provider.id, e.target.checked)}
                                aria-label={`Enable ${provider.label} integration`}
                              />
                              {provider.id === "gemma" ? (
                                <Badge variant={gemmaBadgeVariant}>{gemmaStatusLabel}</Badge>
                              ) : (
                                <Badge variant={provider.priority === "public" ? "success" : "default"}>{provider.priority}</Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] text-neutral-600 mt-1">{provider.description}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[11px] text-neutral-500">{form.sources[provider.id]?.enabled ? "Enabled" : "Disabled"}</span>
                            {form.sources[provider.id]?.enabled && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          {provider.id === "gemma" && gemmaStatus?.reason && !gemmaStatus.connected && (
                            <p className="mt-2 text-[11px] text-red-400">{gemmaStatus.reason}</p>
                          )}
                        </button>
                      ))}
                    </div>

                    {form.sources.gemma?.enabled && !gemmaStatus?.connected && (
                      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                        <p className="text-sm font-medium text-red-300">Gemma cannot be used yet.</p>
                        <p className="mt-1 text-xs text-red-200/80">
                          {gemmaStatus?.reason ?? "Gemma must verify successfully before previewing or saving a workflow."}
                        </p>
                      </div>
                    )}

                    {activeProviders.length > 0 && (
                      <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Enabled Wildcards</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {activeProviders.flatMap((providerId) => {
                            const integration = getWorkflowIntegrationDefinition(providerId);
                            if (!integration) return [];
                            return integration.availableVariables.map((variable) => (
                              <Badge key={`${providerId}-${variable}`} variant="default">{`{${variable}}`}</Badge>
                            ));
                          })}
                          {COLOR_PLACEHOLDER_BADGES.map((token) => (
                            <Badge key={`color-${token}`} variant="success">{token}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="workflow-output-template" className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Output Template
                  </label>
                  <textarea
                    id="workflow-output-template"
                    value={form.outputTemplate}
                    onChange={(e) => setForm((prev) => ({ ...prev, outputTemplate: e.target.value }))}
                    className="min-h-[110px] w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-950"
                    placeholder="NOW {time} | {headline} | {quote} {R}"
                  />
                  <p className="text-xs text-neutral-600">
                    Use plain text and any enabled wildcards together, like {"{tempDeg}"} + {"{headline}"}. Color placeholders {COLOR_PLACEHOLDER_BADGES.join(" ")} are also supported.
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-3 space-y-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Schedule</p>
                    <p className="text-xs text-neutral-600 mt-1">Choose exactly when this workflow should evaluate and send.</p>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {(["once", "daily", "weekly", "cron"] as WorkflowScheduleType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={cn(
                          "rounded-lg border px-2 py-2 text-xs capitalize transition-colors",
                          form.scheduleType === type
                            ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10"
                            : "border-neutral-700 text-neutral-500 hover:text-neutral-200"
                        )}
                        onClick={() => setForm((prev) => ({ ...prev, scheduleType: type }))}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {form.scheduleType === "once" && (
                    <Input
                      id="once-at"
                      label="Run At"
                      type="datetime-local"
                      value={form.onceAt}
                      onChange={(e) => setForm((prev) => ({ ...prev, onceAt: e.target.value }))}
                    />
                  )}

                  {(form.scheduleType === "daily" || form.scheduleType === "weekly") && (
                    <Input
                      id="time-hhmm"
                      label="Time"
                      type="time"
                      value={form.timeHHMM}
                      onChange={(e) => setForm((prev) => ({ ...prev, timeHHMM: e.target.value }))}
                    />
                  )}

                  {form.scheduleType === "weekly" && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Days</span>
                      <div className="grid grid-cols-7 gap-1">
                        {WEEKDAYS.map((day) => {
                          const active = form.daysOfWeek.includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleWeekday(day.value)}
                              className={cn(
                                "rounded-md border py-1 text-xs transition-colors",
                                active ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10" : "border-neutral-700 text-neutral-500"
                              )}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {form.scheduleType === "cron" && (
                    <Input
                      id="cron"
                      label="Cron"
                      value={form.cron}
                      onChange={(e) => setForm((prev) => ({ ...prev, cron: e.target.value }))}
                      placeholder="0 * * * *"
                    />
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={refreshPreview} loading={previewing}>
                    <Sparkles className="w-4 h-4" />
                    Preview Output
                  </Button>
                  <Button onClick={onSubmit} loading={saving}>
                    {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingId ? "Save Changes" : "Create Workflow"}
                  </Button>
                  {editingId && (
                    <Button variant="ghost" onClick={resetForm}>Cancel</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show">
            <Card variant="inset" padding="md">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-neutral-500" />
                  Rendered Output Preview
                </CardTitle>
                <CardDescription>Preview the fully resolved board message before saving or running the automation.</CardDescription>
              </CardHeader>
              {preview ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-neutral-500">Rendered Board Output</p>
                    <p className="text-sm font-mono text-neutral-100 mt-2 break-words whitespace-pre-wrap">{preview.renderedText}</p>
                  </div>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-neutral-500">Board Preview</p>
                    <div className="mt-3">
                      <BoardPreview matrix={preview.renderedMatrix} boardModel={preview.boardModel} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-neutral-500">Resolved Variables</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {Object.entries(preview.variables).map(([key, value]) => (
                        <div key={key} className="rounded-md border border-neutral-800 px-2.5 py-2">
                          <p className="text-[11px] text-neutral-500">{key}</p>
                          <p className="text-xs text-neutral-200 truncate mt-1">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-neutral-600">Run a preview to resolve live integration data and see exactly what will be sent.</p>
              )}
            </Card>
          </motion.div>

          <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show">
            <Card variant="inset" padding="md">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <Activity className="w-4 h-4 text-neutral-500" />
                  Scheduler Status
                </CardTitle>
                <CardDescription>Diagnosis of why scheduled tasks were not firing and what now triggers them.</CardDescription>
              </CardHeader>
              <div className="space-y-2">
                {schedulerDiagnosis.map((line) => (
                  <div key={line} className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-300">
                    {line}
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        <div className="flex flex-col gap-5">
          <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show">
            <Card variant="inset" padding="lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-neutral-500" />
                  Configured Automations
                </CardTitle>
                <CardDescription>{loading ? "Loading..." : `${workflows.length} configured`}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
                {!loading && workflows.length === 0 && (
                  <div className="rounded-xl border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-600">
                    No workflows yet
                  </div>
                )}

                {workflows.map((workflow) => (
                  <div key={workflow.id} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
                    {(() => {
                      const sources = workflow.dataSources ?? (workflow.dataSource ? [workflow.dataSource] : []);
                      const sourceLabels = sources
                        .filter((source) => source.enabled !== false)
                        .map((source) => getWorkflowIntegrationDefinition(source.providerId)?.label ?? source.providerId);
                      return (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-200 truncate">{workflow.name}</p>
                        <p className="text-xs text-neutral-500 mt-0.5 truncate">
                          {sourceLabels.length > 0 ? `${sourceLabels.join(" + ")} integration` : "Static message"}
                        </p>
                      </div>
                      <Badge variant={workflow.enabled ? "success" : "default"}>{workflow.enabled ? "Enabled" : "Disabled"}</Badge>
                    </div>
                      );
                    })()}

                    <div className="mt-2 rounded-lg border border-neutral-800 px-2.5 py-2">
                      <p className="text-[11px] uppercase tracking-wider text-neutral-500">Template</p>
                      <p className="text-xs text-neutral-300 mt-1 font-mono break-words">{workflow.message.text}</p>
                    </div>

                    <div className="mt-2 text-xs text-neutral-600 space-y-1">
                      <p>{getScheduleSummary(workflow.schedule)}</p>
                      <p>Next run: {workflow.nextRunAt ? new Date(workflow.nextRunAt).toLocaleString() : "Not scheduled"}</p>
                      <p>Last run: {workflow.lastRunAt ? new Date(workflow.lastRunAt).toLocaleString() : "Never"}</p>
                      {workflow.lastExecution && (
                        <p className={workflow.lastExecution.success ? "text-emerald-400" : "text-red-400"}>
                          Last execution: {workflow.lastExecution.summary}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" size="xs" onClick={() => applyEdit(workflow)} className="flex-1">
                        Edit
                      </Button>
                      <Button variant="ghost" size="xs" onClick={() => onRunNow(workflow.id)}>
                        <Play className="w-3.5 h-3.5" /> Run
                      </Button>
                      <Button variant="destructive" size="xs" onClick={() => onDelete(workflow.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div custom={6} variants={fadeUp} initial="hidden" animate="show">
            <Card variant="inset" padding="md">
              <CardHeader>
                <CardTitle>Integration Catalog</CardTitle>
                <CardDescription>Weather, stocks, news, quotes, FX, time, jokes, and crypto are ready out of the box.</CardDescription>
              </CardHeader>
              <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
                {WORKFLOW_INTEGRATIONS.map((provider) => (
                  <div key={provider.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-neutral-200">{provider.label}</p>
                      {provider.id === "gemma" ? (
                        <Badge variant={gemmaBadgeVariant}>{gemmaStatusLabel}</Badge>
                      ) : (
                        <Badge variant={provider.priority === "public" ? "success" : "default"}>{provider.priority}</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1">{provider.description}</p>
                    {provider.id === "gemma" && gemmaStatus?.reason && !gemmaStatus.connected && (
                      <p className="text-[11px] text-red-400 mt-2">{gemmaStatus.reason}</p>
                    )}
                    <p className="text-[11px] text-neutral-600 mt-2 font-mono break-words">{provider.defaultTemplate}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {activeProviderDialog && activeIntegration && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              onClick={() => setActiveProviderDialog(null)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl"
                role="dialog"
                aria-modal="true"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-100">{activeIntegration.label} Settings</p>
                    <p className="mt-1 text-xs text-neutral-500">{activeIntegration.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveProviderDialog(null)}
                    className="rounded-lg p-1 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Enabled</p>
                      <p className="text-xs text-neutral-600 mt-0.5">Include this provider when resolving template placeholders.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.sources[activeProviderDialog]?.enabled !== false}
                      onChange={(e) => toggleProvider(activeProviderDialog, e.target.checked)}
                    />
                  </div>

                  <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Wildcards</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {activeIntegration.availableVariables.map((variable) => (
                        <Badge key={variable} variant="default">{`{${variable}}`}</Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-neutral-600">Namespaced versions also work: {`{${activeProviderDialog}.variable}`} and {`{${activeProviderDialog}_variable}`}</p>
                  </div>

                  {activeIntegration.fields.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeIntegration.fields.map((field) => {
                        const fieldValue = form.sources[activeProviderDialog]?.config?.[field.key] ?? field.defaultValue ?? "";
                        const isCheckbox = field.inputType === "checkbox";
                        const isTextarea = field.inputType === "textarea" || field.multiline;

                        if (isCheckbox) {
                          return (
                            <div key={field.key} className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs font-medium text-neutral-300 uppercase tracking-wider">{field.label}</p>
                                  {field.helpText && <p className="mt-1 text-xs text-neutral-600">{field.helpText}</p>}
                                </div>
                                <input
                                  type="checkbox"
                                  checked={fieldValue === "true"}
                                  onChange={(e) => updateProviderConfig(activeProviderDialog, field.key, e.target.checked ? "true" : "false")}
                                />
                              </div>
                            </div>
                          );
                        }

                        if (isTextarea) {
                          return (
                            <div key={field.key} className="md:col-span-2">
                              <label htmlFor={`dlg-${activeProviderDialog}-${field.key}`} className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                                {field.label}
                              </label>
                              <textarea
                                id={`dlg-${activeProviderDialog}-${field.key}`}
                                rows={field.rows ?? 4}
                                value={fieldValue}
                                placeholder={field.placeholder}
                                onChange={(e) => updateProviderConfig(activeProviderDialog, field.key, e.target.value)}
                                className="mt-1 min-h-[110px] w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-950"
                              />
                              {field.helpText && <p className="mt-1.5 text-xs text-neutral-600">{field.helpText}</p>}
                            </div>
                          );
                        }

                        return (
                          <div key={field.key}>
                            <Input
                              id={`dlg-${activeProviderDialog}-${field.key}`}
                              label={field.label}
                              value={fieldValue}
                              placeholder={field.placeholder}
                              onChange={(e) => updateProviderConfig(activeProviderDialog, field.key, e.target.value)}
                            />
                            {field.helpText && <p className="mt-1.5 text-xs text-neutral-600">{field.helpText}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Color Placeholders</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {COLOR_PLACEHOLDER_BADGES.map((token) => (
                        <Badge key={`dlg-color-${token}`} variant="success">{token}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {editingWorkflow && (
        <p className="text-xs text-neutral-600 mt-3">Editing {editingWorkflow.name}</p>
      )}
    </div>
  );
}
