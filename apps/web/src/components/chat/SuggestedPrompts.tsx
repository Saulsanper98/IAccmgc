"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  PROMPT_CATEGORIES,
  extraPromptPool,
  pickRotatingPrompts,
  welcomePromptSections,
  type ContextualPromptOptions,
} from "@/lib/suggested-prompts";
import { IconChevronDown } from "@/components/ui/Icons";

interface SuggestedPromptsProps {
  prompts?: string[];
  promptOptions?: ContextualPromptOptions;
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  categorized?: boolean;
}

function PromptChip({
  prompt,
  disabled,
  onSelect,
}: {
  prompt: string;
  disabled?: boolean;
  onSelect: (prompt: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(prompt)}
      className="suggested-prompt text-xs px-3.5 py-2 rounded-full border border-stroke-default text-text-secondary hover:border-stroke-default hover:bg-surface-1 hover:text-text-primary transition-colors disabled:opacity-50 text-left"
    >
      {prompt}
    </button>
  );
}

function CollapsibleSection({
  id,
  label,
  defaultOpen = true,
  children,
}: {
  id: string;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        id={`${id}-toggle`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((v) => !v)}
        className="md:hidden flex items-center gap-1.5 section-label mb-2 w-full text-left"
      >
        <IconChevronDown className={clsx("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
        {label}
      </button>
      <p className="section-label mb-2 hidden md:block">{label}</p>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-toggle`}
        className={clsx(!open && "hidden md:block")}
      >
        {children}
      </div>
    </div>
  );
}

export function SuggestedPrompts({
  prompts,
  promptOptions,
  onSelect,
  disabled,
  categorized = true,
}: SuggestedPromptsProps) {
  const [extraPrompts, setExtraPrompts] = useState<string[]>([]);
  const [rotationSeed, setRotationSeed] = useState(0);

  const shownPrompts = useMemo(() => {
    const sections = promptOptions
      ? welcomePromptSections(promptOptions)
      : {
          contextual: [] as string[],
          highlights: prompts ?? [],
          categories: PROMPT_CATEGORIES.map((cat) => ({ ...cat, prompts: cat.prompts.slice(0, 2) })),
        };

    if (prompts?.length && !promptOptions) {
      sections.contextual = prompts.filter((p) => p.startsWith("Continúa sobre:"));
      sections.highlights = prompts.filter((p) => !p.startsWith("Continúa sobre:"));
    }

    return new Set(
      [...sections.contextual, ...sections.highlights, ...sections.categories.flatMap((c) => c.prompts), ...extraPrompts].map(
        (p) => p.trim().toLowerCase(),
      ),
    );
  }, [promptOptions, prompts, extraPrompts]);

  function handleMoreSuggestions() {
    const pool = extraPromptPool(promptOptions);
    const next = pickRotatingPrompts(pool, shownPrompts, 3);
    setExtraPrompts(next);
    setRotationSeed((v) => v + 1);
  }

  if (categorized) {
    const sections = promptOptions
      ? welcomePromptSections(promptOptions)
      : {
          contextual: [] as string[],
          highlights: prompts ?? [],
          categories: PROMPT_CATEGORIES.map((cat) => ({ ...cat, prompts: cat.prompts.slice(0, 2) })),
        };

    if (prompts?.length && !promptOptions) {
      sections.contextual = prompts.filter((p) => p.startsWith("Continúa sobre:"));
      sections.highlights = prompts.filter((p) => !p.startsWith("Continúa sobre:"));
    }

    return (
      <div className="mt-8 w-full max-w-2xl space-y-5 text-left">
        {sections.contextual.length > 0 && (
          <CollapsibleSection id="prompts-contextual" label="Para ti">
            <div className="flex flex-wrap gap-2">
              {sections.contextual.map((prompt) => (
                <PromptChip key={prompt} prompt={prompt} disabled={disabled} onSelect={onSelect} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {sections.highlights.length > 0 && (
          <CollapsibleSection id="prompts-highlights" label="Destacados">
            <div className="flex flex-wrap gap-2">
              {sections.highlights.map((prompt) => (
                <PromptChip key={prompt} prompt={prompt} disabled={disabled} onSelect={onSelect} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {sections.categories.map((cat) => (
          <CollapsibleSection key={cat.id} id={`prompts-${cat.id}`} label={cat.label} defaultOpen={false}>
            <div className="flex flex-wrap gap-2">
              {cat.prompts.map((prompt) => (
                <PromptChip key={prompt} prompt={prompt} disabled={disabled} onSelect={onSelect} />
              ))}
            </div>
          </CollapsibleSection>
        ))}

        {extraPrompts.length > 0 && (
          <CollapsibleSection id="prompts-extra" label="Más ideas" defaultOpen>
            <div className="flex flex-wrap gap-2">
              {extraPrompts.map((prompt) => (
                <PromptChip key={`${rotationSeed}-${prompt}`} prompt={prompt} disabled={disabled} onSelect={onSelect} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        <button
          type="button"
          disabled={disabled}
          onClick={handleMoreSuggestions}
          className="text-xs text-link hover:underline disabled:opacity-50"
        >
          Más sugerencias
        </button>
      </div>
    );
  }

  const list = prompts ?? PROMPT_CATEGORIES.flatMap((c) => c.prompts.slice(0, 2));

  return (
    <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-lg">
      {list.map((prompt) => (
        <PromptChip key={prompt} prompt={prompt} disabled={disabled} onSelect={onSelect} />
      ))}
    </div>
  );
}
