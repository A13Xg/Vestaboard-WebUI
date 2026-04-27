"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Card, CardHeader, CardTitle, CardDescription, Input } from "@/components/ui";
import type { Preset, PresetCreateRequest, PresetUpdateRequest, TextAlignment } from "@/types";

interface PresetEditorDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initialPreset?: Preset | null;
  onClose: () => void;
  onSave: (value: PresetCreateRequest | PresetUpdateRequest, id?: string) => void;
  onDelete?: (id: string) => void;
}

export function PresetEditorDialog({ open, mode, initialPreset, onClose, onSave, onDelete }: PresetEditorDialogProps) {
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [alignment, setAlignment] = useState<TextAlignment>("center");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialPreset) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLabel(initialPreset.label);
      setText(initialPreset.text);
      setAlignment(initialPreset.alignment ?? "center");
      setError(null);
      return;
    }

    setLabel("");
    setText("");
    setAlignment("center");
    setError(null);
  }, [open, initialPreset]);

  const save = () => {
    const normalizedLabel = label.trim();
    const normalizedText = text.trim().toUpperCase();

    if (!normalizedLabel) {
      setError("Preset label is required.");
      return;
    }
    if (!normalizedText) {
      setError("Preset text is required.");
      return;
    }

    onSave(
      {
        label: normalizedLabel,
        text: normalizedText,
        alignment,
      },
      initialPreset?.id
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-[460px] -translate-x-1/2 -translate-y-1/2"
          >
            <Card variant="inset" padding="lg" className="border border-neutral-800">
              <CardHeader>
                <CardTitle>{mode === "create" ? "Create Preset" : "Edit Preset"}</CardTitle>
                <CardDescription>Update label, message text, and alignment.</CardDescription>
              </CardHeader>

              <div className="space-y-3">
                <Input
                  id="preset-label"
                  label="Label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Welcome"
                />
                <Input
                  id="preset-text"
                  label="Message"
                  value={text}
                  onChange={(e) => setText(e.target.value.toUpperCase())}
                  placeholder="WELCOME"
                  className="font-mono uppercase"
                />

                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Alignment</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["left", "center", "right"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setAlignment(option)}
                        className={`rounded-lg border px-2 py-1.5 text-xs capitalize transition-colors ${
                          alignment === option
                            ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10"
                            : "border-neutral-700 text-neutral-500 hover:text-neutral-200"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-400" role="alert">{error}</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  {mode === "edit" && initialPreset?.id && onDelete && (
                    <Button variant="destructive" size="sm" onClick={() => onDelete(initialPreset.id)}>
                      Delete
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                  <Button variant="primary" size="sm" onClick={save}>
                    {mode === "create" ? "Add Preset" : "Save Preset"}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
