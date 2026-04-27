import fs from "fs/promises";
import path from "path";
import type { TransitionStyle, TransitionSpeed, VestaboardTransition } from "@/types";

const TRANSITION_FILE = path.join(process.cwd(), "data", "transition.json");

const DEFAULT_TRANSITION: VestaboardTransition = {
  transition: "classic",
  transitionSpeed: "gentle",
};

declare global {
  var __transitionWriteQueue: Promise<void> | undefined;
}

async function readFile(): Promise<VestaboardTransition> {
  try {
    const raw = await fs.readFile(TRANSITION_FILE, "utf-8");
    return JSON.parse(raw) as VestaboardTransition;
  } catch {
    return DEFAULT_TRANSITION;
  }
}

async function writeFile(data: VestaboardTransition): Promise<void> {
  const task = async () => {
    await fs.mkdir(path.dirname(TRANSITION_FILE), { recursive: true });
    await fs.writeFile(TRANSITION_FILE, JSON.stringify(data, null, 2), "utf-8");
  };
  global.__transitionWriteQueue = (global.__transitionWriteQueue ?? Promise.resolve()).then(task);
  await global.__transitionWriteQueue;
}

export async function getTransitionSettings(): Promise<VestaboardTransition> {
  return readFile();
}

export async function setTransitionSettings(
  transition: TransitionStyle,
  transitionSpeed: TransitionSpeed
): Promise<VestaboardTransition> {
  const data: VestaboardTransition = { transition, transitionSpeed };
  await writeFile(data);
  return data;
}
