export type ClientLogLevel = "info" | "success" | "warn" | "error";

export interface ClientLogEntry {
  id: string;
  at: string;
  level: ClientLogLevel;
  message: string;
  details?: string;
}

type Listener = () => void;

/**
 * In-memory log ring buffer. Intentionally module-level (not React state) so logs
 * persist across renders and are accessible from server-side code in the same process.
 * Capped at MAX_LOGS entries; oldest entries are evicted when the limit is exceeded.
 */
const listeners = new Set<Listener>();
const entries: ClientLogEntry[] = [];
const MAX_LOGS = 500;

/** Notifies all registered listeners that the log has changed. */
function emit() {
  listeners.forEach((listener) => listener());
}

/** Returns a shallow copy of all current log entries, oldest-first. */
export function getClientLogs() {
  return [...entries];
}

/**
 * Subscribes a callback that fires whenever a log entry is added or cleared.
 * Returns an unsubscribe function for use in useEffect cleanup.
 */
export function subscribeClientLogs(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function pushClientLog(level: ClientLogLevel, message: string, details?: string) {
  const entry: ClientLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    level,
    message,
    details,
  };

  entries.push(entry);
  if (entries.length > MAX_LOGS) entries.splice(0, entries.length - MAX_LOGS);

  if (typeof window !== "undefined") {
    const base = `[${entry.level.toUpperCase()}] ${entry.message}`;
    if (entry.level === "error") console.error(base, details ?? "");
    else if (entry.level === "warn") console.warn(base, details ?? "");
    else console.log(base, details ?? "");
  }

  emit();
}

export function clearClientLogs() {
  entries.splice(0, entries.length);
  emit();
}

pushClientLog("info", "Log system initialized");
