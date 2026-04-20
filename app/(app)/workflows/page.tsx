"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Play, Save, Trash2, Plus } from "lucide-react";
import { workflowApi } from "@/lib/api-client";
import { getScheduleSummary } from "@/lib/workflow-scheduler";
import { toast } from "@/hooks/use-toast";
import type { Workflow, WorkflowCreateRequest, WorkflowScheduleType } from "@/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui";
import { validateMessageText } from "@/lib/message-validation";

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

type WorkflowFormState = {
  name: string;
  text: string;
  enabled: boolean;
  scheduleType: WorkflowScheduleType;
  timeHHMM: string;
  onceAt: string;
  cron: string;
  daysOfWeek: number[];
};

const EMPTY_FORM: WorkflowFormState = {
  name: "",
  text: "",
  enabled: true,
  scheduleType: "daily",
  timeHHMM: "09:00",
  onceAt: "",
  cron: "0 9 * * *",
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
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkflowFormState>(EMPTY_FORM);
  const [messageError, setMessageError] = useState<string | null>(null);

  const editingWorkflow = useMemo(
    () => workflows.find((w) => w.id === editingId) ?? null,
    [workflows, editingId]
  );

  async function refresh() {
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
    refresh();
  }, []);

  function applyEdit(workflow: Workflow) {
    setEditingId(workflow.id);
    setForm({
      name: workflow.name,
      text: workflow.message.text,
      enabled: workflow.enabled,
      scheduleType: workflow.schedule.type,
      timeHHMM: workflow.schedule.timeHHMM ?? "09:00",
      onceAt: toLocalInputValue(workflow.schedule.at),
      cron: workflow.schedule.cron ?? "0 9 * * *",
      daysOfWeek: workflow.schedule.daysOfWeek ?? [1],
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function toggleWeekday(day: number) {
    setForm((prev) => {
      const exists = prev.daysOfWeek.includes(day);
      return {
        ...prev,
        daysOfWeek: exists ? prev.daysOfWeek.filter((d) => d !== day) : [...prev.daysOfWeek, day].sort(),
      };
    });
  }

  function buildPayload(): WorkflowCreateRequest {
    return {
      name: form.name.trim(),
      enabled: form.enabled,
      message: {
        text: form.text.trim(),
        alignment: "center",
        style: "default",
      },
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

  async function onSubmit() {
    if (!form.name.trim() || !form.text.trim()) {
      toast("Name and message are required", "warning");
      return;
    }

    const validation = validateMessageText(form.text, "flagship");
    if (!validation.valid) {
      setMessageError(validation.error ?? "Invalid message");
      toast(validation.error ?? "Invalid message", "error");
      return;
    }
    setMessageError(null);
    setForm((prev) => ({ ...prev, text: validation.normalizedText }));

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
      await refresh();
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
    await refresh();
  }

  async function onRunNow(id: string) {
    const result = await workflowApi.runById(id);
    if (result.error) {
      toast(result.error.error, "error");
      return;
    }
    const run = result.data.results[0];
    toast(run?.success ? `Executed: ${run.workflowName}` : run?.message ?? "Execution failed", run?.success ? "success" : "warning");
    await refresh();
  }

  async function onRunDue() {
    const result = await workflowApi.runDue();
    if (result.error) {
      toast(result.error.error, "error");
      return;
    }
    toast(`Triggered ${result.data.triggered} due workflow(s)`, "success");
    await refresh();
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1200px] mx-auto">
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show" className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-100">Automated Workflows</h1>
          <p className="text-sm text-neutral-500 mt-1">Create, modify, and schedule board automations</p>
        </div>
        <Button variant="secondary" onClick={onRunDue}>
          <Play className="w-4 h-4" />
          Run Due Now
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
          <Card variant="inset" padding="lg">
            <CardHeader>
              <CardTitle>{editingId ? "Edit Workflow" : "New Workflow"}</CardTitle>
              <CardDescription>Configure message and schedule</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                id="workflow-name"
                label="Name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Morning welcome"
              />

              <Input
                id="workflow-message"
                label="Message"
                value={form.text}
                onChange={(e) => {
                  const normalized = e.target.value.toUpperCase();
                  setForm((p) => ({ ...p, text: normalized }));
                  const validation = validateMessageText(normalized, "flagship");
                  setMessageError(validation.valid ? null : validation.error ?? "Invalid message");
                }}
                placeholder="GOOD MORNING TEAM"
                className="font-mono uppercase"
              />
              {messageError && (
                <p className="text-xs text-red-400" role="alert">{messageError}</p>
              )}

              <div className="flex items-center justify-between rounded-lg border border-neutral-800 p-2.5">
                <span className="text-sm text-neutral-300">Enabled</span>
                <label className="inline-flex items-center gap-2 text-sm text-neutral-400">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
                  />
                </label>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Schedule Type</span>
                <div className="grid grid-cols-4 gap-1">
                  {(["once", "daily", "weekly", "cron"] as WorkflowScheduleType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`rounded-lg border px-2 py-1.5 text-xs capitalize transition-colors ${
                        form.scheduleType === type
                          ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10"
                          : "border-neutral-700 text-neutral-500 hover:text-neutral-200"
                      }`}
                      onClick={() => setForm((p) => ({ ...p, scheduleType: type }))}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {form.scheduleType === "once" && (
                <Input
                  id="once-at"
                  label="Run At"
                  type="datetime-local"
                  value={form.onceAt}
                  onChange={(e) => setForm((p) => ({ ...p, onceAt: e.target.value }))}
                />
              )}

              {(form.scheduleType === "daily" || form.scheduleType === "weekly") && (
                <Input
                  id="time-hhmm"
                  label="Time"
                  type="time"
                  value={form.timeHHMM}
                  onChange={(e) => setForm((p) => ({ ...p, timeHHMM: e.target.value }))}
                />
              )}

              {form.scheduleType === "weekly" && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Days</span>
                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAYS.map((d) => {
                      const active = form.daysOfWeek.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => toggleWeekday(d.value)}
                          className={`rounded-md border py-1 text-xs transition-colors ${
                            active
                              ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10"
                              : "border-neutral-700 text-neutral-500"
                          }`}
                        >
                          {d.label}
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
                  onChange={(e) => setForm((p) => ({ ...p, cron: e.target.value }))}
                  placeholder="0 9 * * *"
                />
              )}

              <div className="flex gap-2 pt-2">
                <Button onClick={onSubmit} loading={saving} disabled={!!messageError} className="flex-1">
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

        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
          <Card variant="inset" padding="lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4" />
                Scheduled Workflows
              </CardTitle>
              <CardDescription>
                {loading ? "Loading..." : `${workflows.length} configured`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
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
                      <p className="text-xs text-neutral-500 mt-0.5 font-mono truncate">{workflow.message.text}</p>
                    </div>
                    <Badge variant={workflow.enabled ? "success" : "default"}>{workflow.enabled ? "Enabled" : "Disabled"}</Badge>
                  </div>

                  <div className="mt-2 text-xs text-neutral-600">
                    <p>{getScheduleSummary(workflow.schedule)}</p>
                    <p>Next run: {workflow.nextRunAt ? new Date(workflow.nextRunAt).toLocaleString() : "Not scheduled"}</p>
                    <p>Last run: {workflow.lastRunAt ? new Date(workflow.lastRunAt).toLocaleString() : "Never"}</p>
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
      </div>

      {editingWorkflow && (
        <p className="text-xs text-neutral-600 mt-3">
          Editing {editingWorkflow.name}
        </p>
      )}
    </div>
  );
}
