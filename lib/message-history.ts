import { promises as fs } from "fs";
import path from "path";
import type { BoardMatrix, MessageHistoryEntry, MessageHistoryFile } from "@/types";

const HISTORY_FILE_PATH = path.join(process.cwd(), "data", "message-history.json");
const HISTORY_DIR_PATH = path.dirname(HISTORY_FILE_PATH);
const MAX_HISTORY_ITEMS = 5000;

const EMPTY_HISTORY: MessageHistoryFile = {
  version: 1,
  messages: [],
};

/**
 * Global write-lock chain for the message history file. Stored on `global` so it
 * survives hot-reloads in Next.js dev mode, preventing concurrent writes from racing.
 */
declare global {
  // eslint-disable-next-line no-var
  var __messageHistoryWrite: Promise<void> | undefined;
}

async function ensureHistoryFile() {
  await fs.mkdir(HISTORY_DIR_PATH, { recursive: true });
  try {
    await fs.access(HISTORY_FILE_PATH);
  } catch {
    await fs.writeFile(HISTORY_FILE_PATH, JSON.stringify(EMPTY_HISTORY, null, 2), "utf8");
  }
}

async function readHistoryFile(): Promise<MessageHistoryFile> {
  await ensureHistoryFile();
  try {
    const raw = await fs.readFile(HISTORY_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<MessageHistoryFile>;
    if (!parsed || !Array.isArray(parsed.messages)) return { ...EMPTY_HISTORY };
    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      messages: parsed.messages,
    };
  } catch {
    return { ...EMPTY_HISTORY };
  }
}

async function writeHistoryFile(file: MessageHistoryFile) {
  await ensureHistoryFile();
  await fs.writeFile(HISTORY_FILE_PATH, JSON.stringify(file, null, 2), "utf8");
}

/**
 * Appends a new entry to the message history, serialising writes through the
 * global promise chain to prevent file corruption under concurrent requests.
 * The `matrix` is stored as a JSON string in `layout` for compact persistence.
 * Entries beyond MAX_HISTORY_ITEMS are silently dropped (newest-first).
 */
export async function appendMessageHistory(entry: Omit<MessageHistoryEntry, "id" | "timestamp" | "layout"> & { matrix: BoardMatrix }) {
  const appendTask = async () => {
    const file = await readHistoryFile();

    const historyEntry: MessageHistoryEntry = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      layout: JSON.stringify(entry.matrix),
    };

    const nextMessages = [historyEntry, ...file.messages].slice(0, MAX_HISTORY_ITEMS);
    await writeHistoryFile({
      version: file.version || 1,
      messages: nextMessages,
    });
  };

  global.__messageHistoryWrite = (global.__messageHistoryWrite ?? Promise.resolve())
    .then(appendTask)
    .catch(async () => {
      await appendTask();
    });

  await global.__messageHistoryWrite;
}

export async function getMessageHistory(limit?: number): Promise<MessageHistoryEntry[]> {
  const file = await readHistoryFile();
  if (!limit || limit <= 0) return file.messages;
  return file.messages.slice(0, limit);
}
