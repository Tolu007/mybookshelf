"use client";

import { useId, useState } from "react";
import { Hash, X } from "lucide-react";
import { MAX_TAGS, normalizeTag, TAG_MAX_LENGTH } from "@/lib/journal";

// Type a tag and press Enter, comma or space to add it; Backspace in an
// empty field removes the last one. Suggestions come from tags already in use.
export function TagInput({ tags, onChange, suggestions = [], disabled = false }: {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const full = tags.length >= MAX_TAGS;

  function add(value: string) {
    const tag = normalizeTag(value);
    setDraft("");
    if (!tag || tags.includes(tag) || full) return;
    onChange([...tags, tag]);
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <label htmlFor={id} className="meta flex items-center gap-1"><Hash className="size-3" aria-hidden="true" /> Tags</label>
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-0.5 rounded-sm bg-secondary py-0.5 pr-0.5 pl-1.5 text-[11px] font-semibold text-sage">
          #{tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            disabled={disabled}
            onClick={() => onChange(tags.filter((item) => item !== tag))}
            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      {!full && (
        <>
          <input
            id={id}
            value={draft}
            list={suggestions.length ? `${id}-suggestions` : undefined}
            maxLength={TAG_MAX_LENGTH + 1}
            disabled={disabled}
            placeholder={tags.length ? "Add another" : "Add a tag"}
            onChange={(event) => {
              const value = event.target.value;
              // A pasted or typed separator commits the tag before it.
              if (/[,\s]/.test(value)) {
                const parts = value.split(/[,\s]+/);
                const rest = parts.pop() ?? "";
                const next = [...tags];
                for (const part of parts) {
                  const tag = normalizeTag(part);
                  if (tag && !next.includes(tag) && next.length < MAX_TAGS) next.push(tag);
                }
                if (next.length !== tags.length) onChange(next);
                setDraft(rest);
              } else {
                setDraft(value);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add(draft);
              } else if (event.key === "Backspace" && !draft && tags.length) {
                onChange(tags.slice(0, -1));
              }
            }}
            onBlur={() => draft && add(draft)}
            className="h-7 w-28 min-w-0 rounded-md border border-border bg-background px-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-sage/60 focus-visible:ring-3 focus-visible:ring-primary/15 dark:bg-secondary"
          />
          {suggestions.length > 0 && (
            <datalist id={`${id}-suggestions`}>
              {suggestions.filter((tag) => !tags.includes(tag)).map((tag) => <option key={tag} value={tag} />)}
            </datalist>
          )}
        </>
      )}
    </div>
  );
}
