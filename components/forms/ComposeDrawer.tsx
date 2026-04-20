"use client";

import { useState, useEffect } from "react";
import { Ban, Eraser, Send, Save } from "lucide-react";
import { Drawer } from "@/components/overlays";
import { Button } from "@/components/ui";
import { BoardComposerEditor, BoardPreview } from "@/components/board";
import { boardApi } from "@/lib/api-client";
import { emptyMatrix, matrixHasContent, matrixToPlainText, normalizeMatrixSize, textToMatrix } from "@/lib/board-utils";
import { toast } from "@/hooks/use-toast";
import type { BoardMatrix } from "@/types";
import { useBoardModel } from "@/hooks/use-board-model";

interface ComposeDrawerProps {
  open: boolean;
  onClose: () => void;
  initialText?: string;
  onSend?: () => void;
}

export function ComposeDrawer({ open, onClose, initialText = "", onSend }: ComposeDrawerProps) {
  const { profile } = useBoardModel();
  const [sending, setSending] = useState(false);
  const [composeMatrix, setComposeMatrix] = useState<BoardMatrix>(() => textToMatrix(initialText, profile.rows, profile.cols));

  useEffect(() => {
    setComposeMatrix((prev) => normalizeMatrixSize(prev, profile.rows, profile.cols));
  }, [profile.rows, profile.cols]);

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
            <BoardPreview matrix={composeMatrix} />
          </div>
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
          <Button variant="secondary" size="md">
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
