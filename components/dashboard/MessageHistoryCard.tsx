"use client";

import { useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import type { MessageHistoryEntry } from "@/types";
import { boardApi } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardDescription, Button } from "@/components/ui";

function HistoryItem({ item }: { item: MessageHistoryEntry }) {
  const modelLabel = item.boardModel === "note" ? "3x15" : "6x22";
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-neutral-200 truncate">{item.text || "(no text)"}</p>
          <p className="text-[11px] text-neutral-500 truncate mt-0.5">
            {item.submittedBy} · {item.source} · {modelLabel}
          </p>
        </div>
        <span className="text-[10px] text-neutral-600 whitespace-nowrap">
          {new Date(item.timestamp).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export function MessageHistoryCard() {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<MessageHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    const res = await boardApi.history(50);
    if (res.error) {
      setError(res.error.error);
      setLoading(false);
      return;
    }
    setHistory(res.data.messages);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Card variant="inset" padding="md">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="inline-flex items-center gap-2">
              <History className="w-4 h-4 text-neutral-500" />
              Message History
            </CardTitle>
            <CardDescription>Every sent message with timestamp, layout and submitter</CardDescription>
          </div>
          <Button variant="ghost" size="xs" onClick={refresh} loading={loading}>
            <RefreshCw className="w-3 h-3" />
            Refresh
          </Button>
        </div>
      </CardHeader>

      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : history.length === 0 ? (
        <p className="text-xs text-neutral-600">No messages sent yet.</p>
      ) : (
        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {history.map((item) => (
            <HistoryItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </Card>
  );
}
