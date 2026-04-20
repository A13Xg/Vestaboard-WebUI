"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Send, Save, Eraser, Ban } from "lucide-react";
import { BoardComposerEditor, BoardPreview } from "@/components/board";
import { Button, Card, CardHeader, CardTitle } from "@/components/ui";
import { boardApi } from "@/lib/api-client";
import { emptyMatrix, matrixHasContent, matrixToPlainText, normalizeMatrixSize } from "@/lib/board-utils";
import { toast } from "@/hooks/use-toast";
import type { BoardMatrix } from "@/types";
import { useBoardModel } from "@/hooks/use-board-model";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, type: "spring" as const, stiffness: 300, damping: 28 },
  }),
};

export default function ComposePage() {
  const { profile } = useBoardModel();
  const [sending, setSending] = useState(false);
  const [composeMatrix, setComposeMatrix] = useState<BoardMatrix>(() => emptyMatrix(profile.rows, profile.cols));

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
      submittedBy: "compose-page-clear-board",
    });

    if (result.error === null) {
      setComposeMatrix(blank);
      toast("Board cleared", "success");
    } else {
      toast(result.error.error, "error");
    }
    setSending(false);
  };

  const onSubmit = async () => {
    if (!matrixHasContent(composeMatrix)) {
      toast("Cannot send an empty board", "error");
      return;
    }

    setSending(true);
    const result = await boardApi.send({
      text: matrixToPlainText(composeMatrix),
      matrix: composeMatrix,
      boardModel: profile.key,
      submittedBy: "compose-page",
    });
    if (result.error === null) {
      toast("Message sent to board!", "success");
    } else {
      toast(result.error.error, "error");
    }
    setSending(false);
  };

  return (
    <div className="p-4 lg:p-6 max-w-[960px] mx-auto">
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show" className="mb-6">
        <h1 className="text-xl font-bold text-neutral-100">Compose</h1>
        <p className="text-sm text-neutral-500 mt-1">Create a message and send it to your Vestaboard</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: compose controls */}
        <div className="flex flex-col gap-4">
          <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
            <Card variant="inset" padding="lg">
              <CardHeader>
                <CardTitle>Board Composer ({profile.rows}x{profile.cols})</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-3">
                <BoardComposerEditor
                  matrix={composeMatrix}
                  rows={profile.rows}
                  cols={profile.cols}
                  onChange={setComposeMatrix}
                />
                <p className="text-[11px] text-neutral-600">
                  Type directly into cells. Arrow keys navigate. Backspace/Delete clears. Use color chips to paint selected cells.
                </p>
              </div>
            </Card>
          </motion.div>

          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
            <div className="flex gap-2">
              <Button variant="outline" size="md" className="flex-1" onClick={clearAll}>
                <Eraser className="w-4 h-4" />
                Clear
              </Button>
              <Button variant="destructive" size="md" className="flex-1" onClick={() => void clearBoardNow()} loading={sending}>
                <Ban className="w-4 h-4" />
                Clear Board
              </Button>
              <Button variant="secondary" size="md" className="flex-1">
                <Save className="w-4 h-4" />
                Save Draft
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                onClick={() => void onSubmit()}
                loading={sending}
              >
                <Send className="w-4 h-4" />
                Send to Board
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Right: preview */}
        <div className="flex flex-col gap-4">
          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show">
            <Card variant="inset" padding="md">
              <div className="flex items-center justify-between mb-3">
                <CardTitle>Live Preview</CardTitle>
                <span className="text-[11px] text-neutral-600">{profile.key === "note" ? "Note" : "Flagship"}</span>
              </div>
              <BoardPreview matrix={composeMatrix} />
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
