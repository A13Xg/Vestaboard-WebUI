"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, TerminalSquare, Trash2 } from "lucide-react";
import { useClientLogs } from "@/hooks/use-client-logs";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

function levelStyle(level: string) {
  if (level === "error") return "text-red-400";
  if (level === "warn") return "text-amber-400";
  if (level === "success") return "text-emerald-400";
  return "text-blue-400";
}

export function LogDock() {
  const { logs, clear, last } = useClientLogs();
  const [expanded, setExpanded] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded || !scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [logs, expanded]);

  return (
    <div className="shrink-0 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <TerminalSquare className="w-4 h-4 text-neutral-500" />
        <button
          className="flex items-center gap-2 min-w-0 text-left flex-1"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="text-xs font-semibold text-neutral-300">Logs</span>
          <span className="text-xs text-neutral-600 truncate">
            {last ? `${new Date(last.at).toLocaleTimeString()} · ${last.message}` : "No log entries"}
          </span>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-neutral-500" />
          )}
        </button>
        <Button variant="ghost" size="icon-sm" onClick={clear} aria-label="Clear logs">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 200, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-neutral-800"
          >
            <div ref={scrollerRef} className="h-full overflow-y-auto px-3 py-2 space-y-1.5">
              {logs.length === 0 && (
                <p className="text-xs text-neutral-600">No logs yet.</p>
              )}
              {logs.map((entry) => (
                <div key={entry.id} className="text-xs font-mono leading-relaxed">
                  <span className="text-neutral-600">[{new Date(entry.at).toLocaleTimeString()}]</span>{" "}
                  <span className={cn("uppercase", levelStyle(entry.level))}>{entry.level}</span>{" "}
                  <span className="text-neutral-300">{entry.message}</span>
                  {entry.details && (
                    <p className="text-neutral-500 whitespace-pre-wrap ml-2">{entry.details}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
