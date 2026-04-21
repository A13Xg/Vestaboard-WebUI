"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, RefreshCw, Send, X } from "lucide-react";
import { BoardComposerEditor, BoardGrid } from "@/components/board";
import { Button } from "@/components/ui";
import { useBoardState } from "@/hooks/use-board-state";
import { useSession } from "@/hooks/use-session";
import { boardApi } from "@/lib/api-client";
import { emptyMatrix, matrixHasContent, matrixToPlainText, normalizeMatrixSize } from "@/lib/board-utils";
import { BOARD_PROFILES } from "@/lib/board-model";
import { toast } from "@/hooks/use-toast";
import type { BoardMatrix } from "@/types";

const BOARD_GAP = 2;
const BOARD_FRAME_PADDING = 28;
const NOTE_PROFILE = BOARD_PROFILES.note;

function matricesMatch(left?: BoardMatrix | null, right?: BoardMatrix | null) {
  if (!left || !right) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function QuickSendBoard({
  matrix,
  loading,
}: {
  matrix?: BoardMatrix;
  loading?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(13);

  useEffect(() => {
      const update = () => {
        if (!containerRef.current) return;
        const width = containerRef.current.clientWidth - BOARD_FRAME_PADDING;
        const nextCell = Math.floor((width - (NOTE_PROFILE.cols - 1) * BOARD_GAP) / NOTE_PROFILE.cols);
        setCellSize(Math.min(Math.max(nextCell, 13), 28));
      };

    update();
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="rounded-[28px] border border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-5">
      <div className="mb-3 flex justify-end">
        <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_14px_rgba(34,197,94,0.6)] animate-pulse" />
      </div>
      <div
        ref={containerRef}
        className="overflow-hidden rounded-[22px] border border-neutral-800 bg-neutral-950/90 p-3 sm:p-4"
      >
        <div className="flex justify-center">
          <BoardGrid
            matrix={matrix}
            rows={NOTE_PROFILE.rows}
            cols={NOTE_PROFILE.cols}
            loading={loading}
            cellSize={cellSize}
          />
        </div>
      </div>
    </div>
  );
}

export default function QuickSendPage() {
  const router = useRouter();
  const { loading: sessionLoading, isAuthenticated } = useSession();
  const { display, syncing, refresh } = useBoardState({ enabled: isAuthenticated });
  const [composing, setComposing] = useState(false);
  const [sending, setSending] = useState(false);
  const [composeMatrix, setComposeMatrix] = useState<BoardMatrix>(() => emptyMatrix(NOTE_PROFILE.rows, NOTE_PROFILE.cols));

  useEffect(() => {
    if (!sessionLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router, sessionLoading]);

  const currentMatrix = useMemo(
    () => normalizeMatrixSize(display.message?.matrix, NOTE_PROFILE.rows, NOTE_PROFILE.cols),
    [display.message?.matrix],
  );

  async function confirmCurrentMessage(expectedMatrix: BoardMatrix) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const current = await boardApi.current();
      const currentMatrix = current.error
        ? null
        : normalizeMatrixSize(current.data.message?.matrix, NOTE_PROFILE.rows, NOTE_PROFILE.cols);
      if (!current.error && matricesMatch(currentMatrix, expectedMatrix)) {
        await refresh();
        toast("Message sent successfully", "success");
        return true;
      }

      await sleep(1000);
    }

    await refresh();
    toast("Message sent, but board confirmation is still pending", "warning");
    return false;
  }

  function resetComposer() {
    setComposeMatrix(emptyMatrix(NOTE_PROFILE.rows, NOTE_PROFILE.cols));
    setComposing(false);
  }

  async function handleSend() {
    const normalizedDraft = normalizeMatrixSize(composeMatrix, NOTE_PROFILE.rows, NOTE_PROFILE.cols);
    if (!matrixHasContent(normalizedDraft)) {
      toast("Cannot send an empty board", "warning");
      return;
    }

    setSending(true);

    const sent = await boardApi.send({
      text: matrixToPlainText(normalizedDraft),
      matrix: normalizedDraft,
      boardModel: "note",
      submittedBy: "quick-send",
    });

    if (sent.error) {
      toast(sent.error.error, "error");
      setSending(false);
      return;
    }

    const confirmed = await confirmCurrentMessage(normalizedDraft);
    if (confirmed) {
      resetComposer();
    }

    setSending(false);
  }

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm text-neutral-500">
        Restoring session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-4 py-5 sm:py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-800 px-3 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-700 hover:bg-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <Button variant="ghost" size="icon" onClick={() => void refresh()} loading={syncing} aria-label="Refresh board">
            {!syncing && <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        <div className="pt-2">
          <h1 className="whitespace-nowrap text-[2rem] font-semibold tracking-[0.18em] text-neutral-100 sm:text-[2.6rem]">
            QUICK SEND
          </h1>
        </div>

        <QuickSendBoard matrix={currentMatrix} loading={syncing} />

        <motion.div layout>
          <AnimatePresence initial={false} mode="popLayout">
            {!composing ? (
              <motion.div
                key="send-button"
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Button
                  size="xl"
                  className="min-h-16 w-full rounded-[22px] text-lg shadow-[0_18px_40px_rgba(79,70,229,0.28)]"
                  onClick={() => setComposing(true)}
                >
                  <Send className="h-5 w-5" />
                  Send Message
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="send-editor"
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="overflow-hidden rounded-[28px] border border-neutral-800 bg-neutral-900/70 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-sm"
              >
                <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-4">
                  <div>
                    <p className="text-lg font-semibold text-neutral-100">Send Message</p>
                    <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Tap squares, type, and add colors</p>
                  </div>
                  <button
                    type="button"
                    onClick={resetComposer}
                    className="rounded-full border border-neutral-800 p-2 text-neutral-400 transition-colors hover:border-neutral-700 hover:bg-neutral-800 hover:text-neutral-100"
                    aria-label="Close composer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 p-4">
                  <QuickSendBoard matrix={composeMatrix} />
                  <BoardComposerEditor
                    matrix={composeMatrix}
                    rows={NOTE_PROFILE.rows}
                    cols={NOTE_PROFILE.cols}
                    onChange={setComposeMatrix}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Button type="button" variant="outline" size="lg" onClick={resetComposer}>
                      Cancel
                    </Button>
                    <Button type="button" size="lg" loading={sending} onClick={() => void handleSend()}>
                      <CheckCircle2 className="h-4 w-4" />
                      Send Message
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
