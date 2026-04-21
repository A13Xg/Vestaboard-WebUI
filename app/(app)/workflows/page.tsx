"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CalendarClock,
  Play,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { BoardPreview } from "@/components/board";
import { CurrentDisplayCard } from "@/components/dashboard/CurrentDisplayCard";
import { UpcomingStatsCard } from "@/components/dashboard/UpcomingStatsCard";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui";
import { useBoardState } from "@/hooks/use-board-state";
import { workflowApi } from "@/lib/api-client";
import { WORKFLOW_INTEGRATIONS, getWorkflowIntegrationDefinition } from "@/lib/workflow-integration-defs";
import { getScheduleSummary } from "@/lib/workflow-scheduler";
import { toast } from "@/hooks/use-toast";
import type {
  Workflow,
  WorkflowCreateRequest,
  WorkflowDataSource,
  WorkflowDataSourceProviderId,
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

type WorkflowFormState = {
  name: string;
  enabled: boolean;
  mode: BuilderMode;
  providerId: WorkflowDataSourceProviderId;
  providerConfig: Record<string, string>;
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

const EMPTY_FORM: WorkflowFormState = {
  name: "",
  enabled: true,
  mode: "integration",
  providerId: DEFAULT_PROVIDER,
  providerConfig: defaultsForProvider(DEFAULT_PROVIDER),
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
  const { display, syncing, refresh: refreshBoard } = useBoardState();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkflowFormState>(EMPTY_FORM);
  const [preview, setPreview] = useState<WorkflowPreviewResponse | null>(null);

  const editingWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === editingId) ?? null,
    [workflows, editingId]
  );

  const currentIntegration = useMemo(
    () => getWorkflowIntegrationDefinition(form.providerId),
    [form.providerId]
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

  useEffect(() => {
    void refreshWorkflows();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPreview(null);
  }

  function applyEdit(workflow: Workflow) {
    const providerId = workflow.dataSource?.providerId ?? DEFAULT_PROVIDER;
    setEditingId(workflow.id);
    setForm({
      name: workflow.name,
      enabled: workflow.enabled,
      mode: workflow.dataSource ? "integration" : "static",
      providerId,
      providerConfig: workflow.dataSource?.config ?? defaultsForProvider(providerId),
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

  function changeProvider(providerId: WorkflowDataSourceProviderId) {
    const definition = getWorkflowIntegrationDefinition(providerId);
    setForm((prev) => ({
      ...prev,
      mode: "integration",
      providerId,
      providerConfig: defaultsForProvider(providerId),
      outputTemplate: definition?.defaultTemplate ?? prev.outputTemplate,
    }));
    setPreview(null);
  }

  function buildDataSource(): WorkflowDataSource | null {
    if (form.mode !== "integration") return null;
    return {
      providerId: form.providerId,
      config: form.providerConfig,
    };
  }

  function buildPayload(): WorkflowCreateRequest {
    return {
      name: form.name.trim(),
      enabled: form.enabled,
      message: {
        text: form.outputTemplate.trim(),
        alignment: "center",
        style: "default",
      },
      dataSource: buildDataSource(),
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

    setPreviewing(true);
    const result = await workflowApi.preview({
      message: { text: form.outputTemplate },
      dataSource: buildDataSource(),
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
                      <p className="text-xs text-neutral-600 mt-1">Public integrations are prioritized first so most automations work without any API key setup.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                      {WORKFLOW_INTEGRATIONS.map((provider) => (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => changeProvider(provider.id)}
                          className={cn(
                            "rounded-lg border p-3 text-left transition-colors",
                            form.providerId === provider.id
                              ? "border-indigo-500/50 bg-indigo-500/10"
                              : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-700"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-neutral-200">{provider.label}</p>
                            <Badge variant={provider.priority === "public" ? "success" : "default"}>{provider.priority}</Badge>
                          </div>
                          <p className="text-[11px] text-neutral-600 mt-1">{provider.description}</p>
                        </button>
                      ))}
                    </div>

                    {currentIntegration && currentIntegration.fields.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {currentIntegration.fields.map((field) => (
                          <div key={field.key} className={field.multiline ? "md:col-span-2" : undefined}>
                            {field.multiline ? (
                              <div className="flex flex-col gap-1.5 w-full">
                                <label
                                  htmlFor={`provider-${field.key}`}
                                  className="text-xs font-medium text-neutral-400 uppercase tracking-wider"
                                >
                                  {field.label}
                                </label>
                                <textarea
                                  id={`provider-${field.key}`}
                                  rows={field.rows ?? 4}
                                  value={form.providerConfig[field.key] ?? ""}
                                  placeholder={field.placeholder}
                                  onChange={(e) => setForm((prev) => ({
                                    ...prev,
                                    providerConfig: { ...prev.providerConfig, [field.key]: e.target.value },
                                  }))}
                                  className="min-h-[110px] w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-950"
                                />
                                {field.helpText && (
                                  <p className="text-xs text-neutral-600">{field.helpText}</p>
                                )}
                              </div>
                            ) : (
                              <div>
                                <Input
                                  id={`provider-${field.key}`}
                                  label={field.label}
                                  value={form.providerConfig[field.key] ?? ""}
                                  placeholder={field.placeholder}
                                  onChange={(e) => setForm((prev) => ({
                                    ...prev,
                                    providerConfig: { ...prev.providerConfig, [field.key]: e.target.value },
                                  }))}
                                />
                                {field.helpText && (
                                  <p className="text-xs text-neutral-600 mt-1.5">{field.helpText}</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {currentIntegration && (
                      <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Available Variables</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {currentIntegration.availableVariables.map((variable) => (
                            <Badge key={variable} variant="default">{`{${variable}}`}</Badge>
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
                    placeholder={currentIntegration?.defaultTemplate ?? "GOOD MORNING TEAM"}
                  />
                  <p className="text-xs text-neutral-600">
                    Use wildcards such as {"{tempDeg}"}, {"{headline}"}, or any other listed integration variable. Final output is normalized to board-safe text before sending.
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
                      <BoardPreview matrix={preview.renderedMatrix} />
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-200 truncate">{workflow.name}</p>
                        <p className="text-xs text-neutral-500 mt-0.5 truncate">
                          {workflow.dataSource ? `${getWorkflowIntegrationDefinition(workflow.dataSource.providerId)?.label} integration` : "Static message"}
                        </p>
                      </div>
                      <Badge variant={workflow.enabled ? "success" : "default"}>{workflow.enabled ? "Enabled" : "Disabled"}</Badge>
                    </div>

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
                      <Badge variant={provider.priority === "public" ? "success" : "default"}>{provider.priority}</Badge>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1">{provider.description}</p>
                    <p className="text-[11px] text-neutral-600 mt-2 font-mono break-words">{provider.defaultTemplate}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      {editingWorkflow && (
        <p className="text-xs text-neutral-600 mt-3">Editing {editingWorkflow.name}</p>
      )}
    </div>
  );
}
