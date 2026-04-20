export const BOARD_ROWS = 6;
export const BOARD_COLS = 22;

export const APP_NAME = "Vestaboard";
export const APP_TAGLINE = "Display Control";

export const ROUTES = {
  login: "/login",
  dashboard: "/",
  compose: "/compose",
  workflows: "/workflows",
  settings: "/settings",
} as const;

export const API_ROUTES = {
  authLogin: "/api/auth/login",
  authLogout: "/api/auth/logout",
  authSession: "/api/auth/session",
  currentDisplay: "/api/vestaboard/current",
  preview: "/api/vestaboard/preview",
  send: "/api/vestaboard/send",
  transitionGet: "/api/vestaboard/transition",
  transitionSet: "/api/vestaboard/transition",
  vestaboardConnectivity: "/api/vestaboard/connectivity",
  messageHistory: "/api/messages/history",
  workflows: "/api/workflows",
  workflowsRunner: "/api/workflows/runner",
} as const;

export const BOARD_BG = "#1a1a1a";
export const BOARD_CELL_DEFAULT = "#F5F0E8";
export const BOARD_FRAME = "#0d0d0d";

/** Vestaboard character code → display color mapping */
export const COLOR_MAP: Record<number, string> = {
  0: "transparent",
  // Standard characters render as off-white/cream
  // Color fill codes
  63: "#FF4136", // red
  64: "#FF851B", // orange
  65: "#FFDC00", // yellow
  66: "#2ECC40", // green
  67: "#0074D9", // blue
  68: "#B10DC9", // violet
  69: "#FFFFFF", // white
  70: "#000000", // black
  71: BOARD_CELL_DEFAULT, // filled flap
};
