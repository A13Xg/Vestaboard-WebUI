import type {
  BoardMessage,
  CurrentDisplayResponse,
  Preset,
  TransitionOption,
  TransitionSettings,
  Draft,
} from "@/types";
import { BOARD_ROWS, BOARD_COLS } from "@/config";

// ─── Mock board matrix helpers ───────────────────────────────────────────────

function mockMatrix(): number[][] {
  // Sparse board — a few non-zero cells to look interesting
  const m = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(0));
  // Row 0: "HELLO WORLD"
  const hello = [8, 5, 12, 12, 15, 0, 23, 15, 18, 12, 4];
  hello.forEach((c, i) => { m[0][i + 5] = c; });
  // Row 2: color strip
  [63, 64, 65, 66, 67, 68, 69].forEach((c, i) => { m[2][i + 7] = c; });
  // Row 4: "VESTABOARD"
  const vb = [22, 5, 19, 20, 1, 2, 15, 1, 18, 4];
  vb.forEach((c, i) => { m[4][i + 6] = c; });
  return m;
}

// ─── Mock data ───────────────────────────────────────────────────────────────

export const MOCK_CURRENT_MESSAGE: BoardMessage = {
  id: "msg-001",
  matrix: mockMatrix(),
  text: "HELLO WORLD",
  sentAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  label: "Welcome message",
};

export const MOCK_CURRENT_DISPLAY: CurrentDisplayResponse = {
  message: MOCK_CURRENT_MESSAGE,
  syncedAt: new Date().toISOString(),
  status: "synced",
};

export const MOCK_PRESETS: Preset[] = [
  { id: "preset-1", label: "Welcome", text: "WELCOME", alignment: "center", isFavorite: true },
  { id: "preset-2", label: "Closed Today", text: "CLOSED TODAY", alignment: "center" },
  { id: "preset-3", label: "Open 9–5", text: "OPEN 9AM TO 5PM", alignment: "center", isFavorite: true },
  { id: "preset-4", label: "Meeting Room A", text: "MEETING IN ROOM A", alignment: "left" },
  { id: "preset-5", label: "Coffee Break", text: "COFFEE BREAK - BACK IN 15", alignment: "center" },
  { id: "preset-6", label: "Do Not Disturb", text: "DO NOT DISTURB", alignment: "center" },
];

export const MOCK_DRAFTS: Draft[] = [
  {
    id: "draft-1",
    text: "TEAM STANDUP AT 10AM",
    alignment: "center",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    label: "Standup reminder",
  },
  {
    id: "draft-2",
    text: "HAPPY FRIDAY EVERYONE",
    alignment: "center",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

export const MOCK_TRANSITIONS: TransitionOption[] = [
  { id: "none", label: "Instant", description: "No transition" },
  { id: "fade", label: "Fade", description: "Smooth fade between states", durationMs: 600 },
  { id: "slide-left", label: "Slide Left", description: "Wipe from right to left", durationMs: 800 },
  { id: "slide-right", label: "Slide Right", description: "Wipe from left to right", durationMs: 800 },
  { id: "scroll-up", label: "Scroll Up", description: "Content scrolls upward", durationMs: 1000 },
  { id: "clock", label: "Clock Flip", description: "Classic split-flap reveal", durationMs: 1200 },
];

export const MOCK_TRANSITION_SETTINGS: TransitionSettings = {
  selectedId: "fade",
  speed: "normal",
};
