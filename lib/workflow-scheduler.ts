import type { WorkflowSchedule, WorkflowScheduleType } from "@/types";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function startOfMinute(date: Date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}

function parseHHMM(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return { h: 9, m: 0 };
  }
  return { h, m };
}

function nextDaily(now: Date, timeHHMM: string) {
  const { h, m } = parseHHMM(timeHHMM);
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

function nextWeekly(now: Date, timeHHMM: string, daysOfWeek: number[]) {
  const safeDays = daysOfWeek.length ? daysOfWeek : [1];
  const { h, m } = parseHHMM(timeHHMM);
  for (let i = 0; i < 8; i++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + i);
    candidate.setHours(h, m, 0, 0);
    if (safeDays.includes(candidate.getDay()) && candidate > now) return candidate;
  }
  const fallback = new Date(now);
  fallback.setDate(now.getDate() + 7);
  fallback.setHours(h, m, 0, 0);
  return fallback;
}

// Minimal cron support: "m h * * *" (minute + hour only)
function nextSimpleCron(now: Date, cron: string) {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 2) return nextDaily(now, "09:00");
  const [minuteRaw, hourRaw] = parts;

  const minuteValues = minuteRaw === "*" ? Array.from({ length: 60 }, (_, i) => i) : [Number(minuteRaw)];
  const hourValues = hourRaw === "*" ? Array.from({ length: 24 }, (_, i) => i) : [Number(hourRaw)];

  const start = new Date(now.getTime() + 60 * 1000);
  const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  for (let t = new Date(start); t <= end; t = new Date(t.getTime() + 60 * 1000)) {
    if (hourValues.includes(t.getHours()) && minuteValues.includes(t.getMinutes())) {
      t.setSeconds(0, 0);
      return t;
    }
  }

  return nextDaily(now, "09:00");
}

export function computeNextRunAt(schedule: WorkflowSchedule, now: Date = new Date()): string | null {
  const current = startOfMinute(now);

  if (schedule.type === "once") {
    if (!schedule.at) return null;
    const at = new Date(schedule.at);
    return at > current ? at.toISOString() : null;
  }

  if (schedule.type === "daily") {
    return nextDaily(current, schedule.timeHHMM ?? "09:00").toISOString();
  }

  if (schedule.type === "weekly") {
    return nextWeekly(current, schedule.timeHHMM ?? "09:00", schedule.daysOfWeek ?? [1]).toISOString();
  }

  if (schedule.type === "cron") {
    return nextSimpleCron(current, schedule.cron ?? "0 9 * * *").toISOString();
  }

  return null;
}

export function getScheduleSummary(schedule: WorkflowSchedule) {
  if (schedule.type === "once") return schedule.at ? `One-time at ${schedule.at}` : "One-time (unscheduled)";
  if (schedule.type === "daily") return `Daily at ${schedule.timeHHMM ?? "09:00"}`;
  if (schedule.type === "weekly") return `Weekly at ${schedule.timeHHMM ?? "09:00"} on ${(schedule.daysOfWeek ?? [1]).join(",")}`;
  return `Cron: ${schedule.cron ?? "0 9 * * *"}`;
}

export function shouldRunNow(nextRunAt?: string, now: Date = new Date()) {
  if (!nextRunAt) return false;
  return new Date(nextRunAt).getTime() <= now.getTime();
}
