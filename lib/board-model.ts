export type BoardModel = "flagship" | "note";

export interface BoardProfile {
  key: BoardModel;
  label: string;
  rows: number;
  cols: number;
}

export const BOARD_MODEL_STORAGE_KEY = "vestaboard.boardModel";

export const BOARD_PROFILES: Record<BoardModel, BoardProfile> = {
  flagship: {
    key: "flagship",
    label: "Vestaboard Full (6x22)",
    rows: 6,
    cols: 22,
  },
  note: {
    key: "note",
    label: "Vestaboard Note (3x15)",
    rows: 3,
    cols: 15,
  },
};

export function isBoardModel(value: string | null | undefined): value is BoardModel {
  return value === "flagship" || value === "note";
}

export function getBoardProfile(model: BoardModel) {
  return BOARD_PROFILES[model];
}
