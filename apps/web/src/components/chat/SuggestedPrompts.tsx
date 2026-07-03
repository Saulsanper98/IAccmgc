"use client";

import clsx from "clsx";
import { PROMPT_CATEGORIES } from "@/lib/suggested-prompts";

interface SuggestedPromptsProps {
  prompts?: string[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  categorized?: boolean;
}

export function SuggestedPrompts({
  prompts,
  onSelect,
  disabled,
  categorized = true,
}: SuggestedPromptsProps) {
  if (categorized && !prompts) {
    return (
      <div className="mt-8 w-full max-w-2xl space-y-6 text-left">
        {PROMPT_CATEGORIES.map((cat) => (
          <div key={cat.id}>
            <p className="section-label mb-2">{cat.label}</p>
            <div className="flex flex-wrap gap-2">
              {cat.prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(prompt)}
                  className="suggested-prompt text-xs px-3.5 py-2 rounded-full border border-stroke-default text-text-secondary hover:border-stroke-default hover:bg-surface-1 hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const list = prompts ?? PROMPT_CATEGORIES.flatMap((c) => c.prompts.slice(0, 2));

  return (
    <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-lg">
      {list.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="suggested-prompt text-xs px-3.5 py-2 rounded-full border border-stroke-default text-text-secondary hover:border-stroke-default hover:bg-surface-1 hover:text-text-primary transition-colors disabled:opacity-50"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
