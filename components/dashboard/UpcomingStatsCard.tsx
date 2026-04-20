"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarClock, RefreshCw } from "lucide-react";
import { boardApi, workflowApi } from "@/lib/api-client";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import type { Workflow } from "@/types";

interface UpcomingStatsCardProps {
  presetsCount: number;
}

function formatUpcomingTime(value: string | null) {
  if (!value) return "No schedule";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleString();
}

export function UpcomingStatsCard({ presetsCount }: UpcomingStatsCardProps) {
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [historyTodayCount, setHistoryTodayCount] = useState(0);

  async function refresh() {
    setLoading(true);
    const [wfRes, historyRes] = await Promise.all([
      workflowApi.list(),
      boardApi.history(300),
    ]);

    if (!wfRes.error) {
      setWorkflows(wfRes.data.workflows);
    }

    if (!historyRes.error) {
      const messages = historyRes.data.messages;
      setHistoryCount(messages.length);

      const today = new Date();
      const y = today.getFullYear();
      const m = today.getMonth();
      const d = today.getDate();
      const todayCount = messages.filter((msg) => {
        const t = new Date(msg.timestamp);
        return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
      }).length;

      setHistoryTodayCount(todayCount);
    }

    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const upcoming = useMemo(() => {
    return workflows
      .filter((wf) => wf.enabled && !!wf.nextRunAt)
      .sort((a, b) => new Date(a.nextRunAt ?? 0).getTime() - new Date(b.nextRunAt ?? 0).getTime())
      .slice(0, 5);
  }, [workflows]);

  const activeWorkflowCount = useMemo(() => workflows.filter((wf) => wf.enabled).length, [workflows]);

  return (
    <Card variant="inset" padding="md">
      <CardHeader className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="inline-flex items-center gap-2">
              <Activity className="w-4 h-4 text-neutral-500" />
              Operations Snapshot
            </CardTitle>
            <CardDescription>Upcoming scheduled actions and live usage stats</CardDescription>
          </div>
          <Button variant="ghost" size="xs" onClick={refresh} loading={loading}>
            <RefreshCw className="w-3 h-3" />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="w-4 h-4 text-neutral-500" />
            <p className="text-xs font-semibold text-neutral-300 uppercase tracking-wide">Upcoming Scheduled Actions</p>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-xs text-neutral-600">No enabled workflows with future runs.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((wf) => (
                <div key={wf.id} className="flex items-start justify-between gap-2 rounded-md border border-neutral-800/80 px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-200 truncate">{wf.name}</p>
                    <p className="text-[11px] text-neutral-500 truncate mt-0.5">{wf.message.text}</p>
                  </div>
                  <span className="text-[10px] text-neutral-600 whitespace-nowrap">
                    {formatUpcomingTime(wf.nextRunAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
          <p className="text-xs font-semibold text-neutral-300 uppercase tracking-wide mb-2">Statistics</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-neutral-800 px-2.5 py-2">
              <p className="text-[11px] text-neutral-500">Messages Logged</p>
              <p className="text-base font-semibold text-neutral-100">{historyCount}</p>
            </div>
            <div className="rounded-md border border-neutral-800 px-2.5 py-2">
              <p className="text-[11px] text-neutral-500">Sent Today</p>
              <p className="text-base font-semibold text-neutral-100">{historyTodayCount}</p>
            </div>
            <div className="rounded-md border border-neutral-800 px-2.5 py-2">
              <p className="text-[11px] text-neutral-500">Active Workflows</p>
              <p className="text-base font-semibold text-neutral-100">{activeWorkflowCount}</p>
            </div>
            <div className="rounded-md border border-neutral-800 px-2.5 py-2">
              <p className="text-[11px] text-neutral-500">Presets</p>
              <p className="text-base font-semibold text-neutral-100">{presetsCount}</p>
            </div>
          </div>
          <div className="mt-2">
            <Badge variant="default">Live snapshot</Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}
