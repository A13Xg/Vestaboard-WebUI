"use client";

import { useEffect, useState } from "react";
import {
  BOARD_MODEL_STORAGE_KEY,
  BOARD_PROFILES,
  type BoardModel,
  type BoardProfile,
  isBoardModel,
} from "@/lib/board-model";

export function useBoardModel() {
  const [model, setModelState] = useState<BoardModel>(() => {
    if (typeof window === "undefined") return "note";
    const raw = window.localStorage.getItem(BOARD_MODEL_STORAGE_KEY);
    return isBoardModel(raw) ? raw : "note";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== BOARD_MODEL_STORAGE_KEY) return;
      if (isBoardModel(e.newValue)) setModelState(e.newValue);
    };
    const onModelChanged = (e: Event) => {
      const detail = (e as CustomEvent<BoardModel>).detail;
      if (isBoardModel(detail)) setModelState(detail);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("board-model-changed", onModelChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("board-model-changed", onModelChanged);
    };
  }, []);

  const setModel = (next: BoardModel) => {
    setModelState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BOARD_MODEL_STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent("board-model-changed", { detail: next }));
    }
  };

  const profile: BoardProfile = BOARD_PROFILES[model];
  return { model, setModel, profile };
}
