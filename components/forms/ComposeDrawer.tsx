"use client";

import { useState, useEffect } from "react";
import { Ban, Eraser, Send, Save, ChevronDown, ChevronUp } from "lucide-react";
import { Drawer } from "@/components/overlays";
import { Button } from "@/components/ui";
import { BoardComposerEditor, BoardPreview, TransitionSelector } from "@/components/board";
import { boardApi } from "@/lib/api-client";
import { emptyMatrix, matrixHasContent, matrixToPlainText, normalizeMatrixSize, textToMatrix } from "@/lib/board-utils";
import { toast } from "@/hooks/use-toast";
import type { BoardMatrix, VestaboardTransition } from "@/types";
import { useBoardModel } from "@/hooks/use-board-model";

const DEFAULT_TRANSITION: VestaboardTransition = { transition: "classic", transitionSpeed: "gentle" };

interface ComposeDrawerProps {
  open: boolean;
  onClose: () => void;
  initialText?: string;
  initialMatrix?: BoardMatrix;
  onSend?: () => void;
}

export function ComposeDrawer({ open, onClose, initialText = "", initialMatrix, onSend }: ComposeDrawerProps) {
  const { profile } = useBoardModel();
  const [sending, setSending] = useState(false);
  const [composeMatrix, setComposeMatrix] = useState<BoardMatrix>(() => textToMatrix(initialText, profile.rows, profile.cols));
  const [transition, setTransition] = useState<VestaboardTransition>(DEFAULT_TRANSITION);
  const [transitionExpanded, setTransitionExpanded] = useState(false);
  const [applyingTransition, setApplyingTransition] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComposeMatrix((prev) => normalizeMatrixSize(prev, profile.rows, profile.cols));
  }, [profile.rows, profile.cols]);

  useEffect(() => {
    if (!open) return;
    if (initialMatrix && initialMatrix.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setComposeMatrix(normalizeMatrixSize(initialMatrix, profile.rows, profile.cols));
      return;
    }
    setComposeMatrix(textToMatrix(initialText, profile.rows, profile.cols));
  }, [open, initialText, initialMatrix, profile.rows, profile.cols]);

  // Load current transition settings when drawer opens
  useEffect(() => {
    if (!open) return;
    boardApi.getTransition().then((result) => {
      if (!result.error) setTransition(result.data);
    });
  }, [open]);

  const clearAll = () => {
    setComposeMatrix(emptyMatrix(profile.rows, profile.cols));
  };

  const clearBoardNow = async () => {
    const blank = emptyMatrix(profile.rows, profile.cols);
    setSending(true);
    const result = await boardApi.send({
      text: "",
      matrix: blank,
      boardModel: profile.key,
      submittedBy: "compose-drawer-clear-board",
    });
    if (result.error === null) {
      setComposeMatrix(blank);
      toast("Board cleared", "success");
      onSend?.();
    } else {
      toast(result.error.error, "error");
    }
    setSending(false);
  };

  const handleSend = async () => {
    if (!matrixHasContent(composeMatrix)) {
      toast("Cannot send an empty board", "error");
      return;
    }

    setSending(true);

    // Apply transition first (best-effort, non-blocking on failure)
    const transResult = await boardApi.setTransition(transition);
    if (transResult.error) {
      toast(`Transition unavailable: ${transResult.error.error}`, "warning");
    }

    const result = await boardApi.send({
      text: matrixToPlainText(composeMatrix),
      matrix: composeMatrix,
      boardModel: profile.key,
      submittedBy: "compose-drawer",
    });
    if (result.error === null) {
      toast("Message sent to board!", "success");
      onSend?.();
      onClose();
    } else {
      toast(result.error.error, "error");
    }
    setSending(false);
  };

  const handleApplyTransitionOnly = async () => {
    setApplyingTransition(true);
    const result = await boardApi.setTransition(transition);
    if (result.error) {
      toast(result.error.error, "error");
    } else {
      toast(`Transition set: ${transition.transition} / ${transition.transitionSpeed}`, "success");
    }
    setApplyingTransition(false);
  };

  return (
    <Drawer open={open} onClose={onClose} title="Compose Message" width={520}>
      <div className="flex flex-col gap-5">
        <div>
          <BoardComposerEditor
            matrix={composeMatrix}
            rows={profile.rows}
            cols={profile.cols}
            onChange={setComposeMatrix}
          />
          <p className="text-[11px] text-neutral-600 mt-2">
            Type directly into cells. Arrow keys move, Backspace/Delete clear, and colors apply to the selected cell.
          </p>
        </div>

        <div>
          <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Preview</span>
          <div className="mt-2">
            <BoardPreview
              matrix={composeMatrix}
              transition={transition.transition}
              transitionSpeed={transition.transitionSpeed}
              animatePreview
            />
          </div>
        </div>

        {/* Transition selector — collapsible */}
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setTransitionExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800/40 transition-colors"
          >
            <span>
              Transition:{" "}
              <span className="text-blue-400 capitalize">
                {transition.transition} / {transition.transitionSpeed}
              </span>
            </span>
            {transitionExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-neutral-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
            )}
          </button>
          {transitionExpanded && (
            <div className="px-3 pb-3 pt-1 border-t border-neutral-800">
              <TransitionSelector
                value={transition}
                onChange={setTransition}
                compact
                onApply={handleApplyTransitionOnly}
                applying={applyingTransition}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-neutral-800">
          <Button variant="ghost" size="md" onClick={clearAll}>
            <Eraser className="w-4 h-4" />
            Clear
          </Button>
          <Button variant="destructive" size="md" onClick={() => void clearBoardNow()} loading={sending}>
            <Ban className="w-4 h-4" />
            Clear Board
          </Button>
          <Button variant="outline" size="md" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" size="md" onClick={() => toast("Draft saving is not yet available", "warning")}>
            <Save className="w-4 h-4" />
            Save Draft
          </Button>
          <Button variant="primary" size="md" onClick={() => void handleSend()} loading={sending}>
            <Send className="w-4 h-4" />
            Send
          </Button>
        </div>
      </div>
    </Drawer>
  );
}


