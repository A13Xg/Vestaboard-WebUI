"use client";

import { motion } from "framer-motion";
import {
  PenLine,
  Send,
  LayoutTemplate,
  Trash2,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ActionItem {
  id: string;
  label: string;
  icon: React.ElementType;
  variant?: "primary" | "secondary" | "ghost" | "outline" | "destructive";
  onClick?: () => void;
  disabled?: boolean;
}

interface QuickActionGridProps {
  onCompose?: () => void;
  onSend?: () => void;
  onLoadPreset?: () => void;
  onClearDraft?: () => void;
  onRefresh?: () => void;
  onTransitionSettings?: () => void;
  sending?: boolean;
  hasDraft?: boolean;
  className?: string;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 400, damping: 28 } },
};

export function QuickActionGrid({
  onCompose,
  onSend,
  onLoadPreset,
  onClearDraft,
  onRefresh,
  onTransitionSettings,
  sending,
  hasDraft,
  className,
}: QuickActionGridProps) {
  const allActions: ActionItem[] = [
    { id: "compose", label: "Compose", icon: PenLine, variant: "primary", onClick: onCompose },
    { id: "send", label: "Send to Board", icon: Send, variant: "secondary", onClick: onSend, disabled: !hasDraft || sending },
    { id: "preset", label: "Load Preset", icon: LayoutTemplate, variant: "outline", onClick: onLoadPreset },
    { id: "refresh", label: "Refresh Display", icon: RefreshCw, variant: "ghost", onClick: onRefresh },
    { id: "transition", label: "Transitions", icon: Settings2, variant: "ghost", onClick: onTransitionSettings },
    { id: "clear", label: "Clear Draft", icon: Trash2, variant: "destructive", onClick: onClearDraft, disabled: !hasDraft },
  ];
  // Hide draft-specific actions when no draft is active to avoid permanently-disabled buttons
  const actions = hasDraft ? allActions : allActions.filter((a) => a.id !== "send" && a.id !== "clear");

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={cn("grid grid-cols-2 sm:grid-cols-3 gap-2", className)}
    >
      {actions.map((action) => (
        <motion.div key={action.id} variants={item}>
          <Button
            variant={action.variant ?? "secondary"}
            size="md"
            className="w-full"
            onClick={action.onClick}
            disabled={action.disabled}
            loading={action.id === "send" && sending}
          >
            <action.icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{action.label}</span>
          </Button>
        </motion.div>
      ))}
    </motion.div>
  );
}
