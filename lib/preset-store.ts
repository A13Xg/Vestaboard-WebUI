import { promises as fs } from "fs";
import path from "path";
import type { Preset, PresetCreateRequest, PresetListResponse, PresetUpdateRequest } from "@/types";
import { validateMessageText } from "@/lib/message-validation";

interface PresetFile {
  version: number;
  presets: Preset[];
}

const PRESET_FILE_PATH = path.join(process.cwd(), "data", "presets.json");
const PRESET_DIR_PATH = path.dirname(PRESET_FILE_PATH);

declare global {
  // eslint-disable-next-line no-var
  var __presetWriteQueue: Promise<void> | undefined;
}

async function ensurePresetFile() {
  await fs.mkdir(PRESET_DIR_PATH, { recursive: true });
  try {
    await fs.access(PRESET_FILE_PATH);
  } catch {
    const init: PresetFile = { version: 1, presets: [] };
    await fs.writeFile(PRESET_FILE_PATH, JSON.stringify(init, null, 2), "utf8");
  }
}

async function readPresetFile(): Promise<PresetFile> {
  await ensurePresetFile();
  try {
    const raw = await fs.readFile(PRESET_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<PresetFile>;
    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      presets: Array.isArray(parsed.presets) ? parsed.presets : [],
    };
  } catch {
    return { version: 1, presets: [] };
  }
}

async function writePresetFile(data: PresetFile) {
  await ensurePresetFile();
  await fs.writeFile(PRESET_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  let out: T;
  const run = async () => {
    out = await fn();
  };

  global.__presetWriteQueue = (global.__presetWriteQueue ?? Promise.resolve())
    .then(run)
    .catch(run);

  await global.__presetWriteQueue;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return out!;
}

function validatePresetPayload(label: string, text: string) {
  if (!label.trim()) return "Preset label is required";
  const validation = validateMessageText(text, "flagship");
  if (!validation.valid) return validation.error ?? "Invalid preset message";
  return null;
}

export async function listPresets(): Promise<PresetListResponse> {
  const file = await readPresetFile();
  return { presets: file.presets };
}

export async function createPreset(input: PresetCreateRequest): Promise<Preset> {
  return withWriteLock(async () => {
    const err = validatePresetPayload(input.label, input.text);
    if (err) throw new Error(err);

    const file = await readPresetFile();
    const now = new Date().toISOString();
    const validation = validateMessageText(input.text, "flagship");

    const preset: Preset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: input.label.trim(),
      description: input.description?.trim() || undefined,
      text: validation.normalizedText,
      alignment: input.alignment ?? "center",
      style: input.style ?? "default",
      colorInserts: input.colorInserts ?? [],
      createdAt: now,
      updatedAt: now,
    };

    file.presets.unshift(preset);
    await writePresetFile(file);
    return preset;
  });
}

export async function updatePreset(id: string, patch: PresetUpdateRequest): Promise<Preset | null> {
  return withWriteLock(async () => {
    const file = await readPresetFile();
    const idx = file.presets.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const existing = file.presets[idx];
    const nextLabel = patch.label ?? existing.label;
    const nextText = patch.text ?? existing.text;
    const err = validatePresetPayload(nextLabel, nextText);
    if (err) throw new Error(err);

    const textValidation = validateMessageText(nextText, "flagship");

    const updated: Preset = {
      ...existing,
      ...patch,
      label: nextLabel.trim(),
      description: patch.description === undefined ? existing.description : patch.description?.trim() || undefined,
      text: textValidation.normalizedText,
      updatedAt: new Date().toISOString(),
    };

    file.presets[idx] = updated;
    await writePresetFile(file);
    return updated;
  });
}

export async function deletePreset(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const file = await readPresetFile();
    const before = file.presets.length;
    file.presets = file.presets.filter((p) => p.id !== id);
    if (file.presets.length === before) return false;
    await writePresetFile(file);
    return true;
  });
}
