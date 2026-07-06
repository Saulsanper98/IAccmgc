"use client";

import { useMemo } from "react";
import { welcomeQuickActions, type ContextualPromptOptions } from "@/lib/suggested-prompts";

interface SuggestedPromptsProps {
  promptOptions?: ContextualPromptOptions;
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function SuggestedPrompts({ promptOptions, onSelect, disabled }: SuggestedPromptsProps) {
  const actions = useMemo(() => welcomeQuickActions(promptOptions), [promptOptions]);

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-center gap-2 w-full max-w-xl">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(action.prompt)}
          title={action.prompt}
          className="inline-flex items-center px-3.5 py-2 rounded-full text-sm text-text-secondary bg-surface-2/60 hover:bg-surface-2 hover:text-text-primary transition-colors disabled:opacity-50"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
