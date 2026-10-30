"use client";

import { useState } from "react";
import { ChevronDown, Type, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverClose, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { FONT_SIZE_RANGE, LINE_HEIGHTS, MEASURES, PAPERS, READER_FONTS, READER_FONT_VARS, type Paper, type Preferences, type ReaderFont } from "@/lib/preferences";
import { cn } from "@/lib/utils";

type Typography = Preferences["reader"];

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{children}</p>;
}

function Choice({ selected, onClick, children, className, style }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      style={style}
      className={cn(
        "rounded-lg border px-2 py-1 text-xs font-semibold transition-colors",
        selected ? "border-primary/30 bg-primary text-primary-foreground" : "border-border bg-secondary text-foreground hover:border-sage/40",
        className
      )}
    >
      {children}
    </button>
  );
}

// Live typesetting for EPUBs: changes apply straight away for this
// session; "Save as default" keeps them for every book.
export function Typecraft({ typography, onChange, onSaveDefault }: {
  typography: Typography;
  onChange: (patch: Partial<Typography>) => void;
  onSaveDefault: () => Promise<boolean>;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    setStatus((await onSaveDefault()) ? "saved" : "error");
  }

  function change(patch: Partial<Typography>) {
    setStatus("idle");
    onChange(patch);
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="sm" className="gap-1" />}>
        <Type /> <span className="hidden sm:inline">Typecraft</span> <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="space-y-4">
        <div className="flex items-center justify-between">
          <PopoverTitle className="font-heading text-lg font-semibold">Typesetting</PopoverTitle>
          <PopoverClose render={<Button variant="ghost" size="icon-xs" aria-label="Close typesetting" />}><X /></PopoverClose>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>Scale</Label>
            <span className="text-xs font-semibold tabular-nums">{typography.fontSize}px</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-heading text-sm" aria-hidden="true">A</span>
            <input
              type="range"
              aria-label="Font size"
              min={FONT_SIZE_RANGE.min}
              max={FONT_SIZE_RANGE.max}
              value={typography.fontSize}
              onChange={(event) => change({ fontSize: Number(event.target.value) })}
              className="h-1 flex-1 cursor-pointer accent-[var(--primary)]"
            />
            <span className="font-heading text-xl" aria-hidden="true">A</span>
          </div>
        </div>

        <div>
          <Label>Surface canvas</Label>
          <div role="radiogroup" aria-label="Page colour" className="grid grid-cols-5 gap-1.5">
            {(Object.keys(PAPERS) as Paper[]).map((key) => {
              const paper = PAPERS[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={typography.paper === key}
                  onClick={() => change({ paper: key })}
                  className={cn("flex flex-col items-center gap-1 rounded-lg border p-1 text-[9px] font-semibold transition-colors", typography.paper === key ? "border-sage ring-1 ring-sage/40" : "border-border hover:border-sage/40")}
                >
                  <span
                    className="h-5 w-full rounded-md border border-border"
                    style={paper.background ? { background: paper.background } : { background: "linear-gradient(135deg, #faf7f2 50%, #1a201c 50%)" }}
                    aria-hidden="true"
                  />
                  <span className="w-full truncate text-center">{key === "auto" ? "Theme" : paper.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>Typeface</Label>
          <div role="radiogroup" aria-label="Typeface" className="grid grid-cols-2 gap-1.5">
            {(Object.keys(READER_FONTS) as ReaderFont[]).map((font) => (
              <Choice key={font} selected={typography.font === font} onClick={() => change({ font })} style={{ fontFamily: READER_FONT_VARS[font] }}>
                {READER_FONTS[font].label}
              </Choice>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Line spacing</Label>
            <div role="radiogroup" aria-label="Line spacing" className="grid grid-cols-3 gap-1">
              {LINE_HEIGHTS.map((option) => (
                <Choice key={option.value} selected={typography.lineHeight === option.value} onClick={() => change({ lineHeight: option.value })} className="px-1">
                  {option.value}
                </Choice>
              ))}
            </div>
          </div>
          <div>
            <Label>Margins</Label>
            <div role="radiogroup" aria-label="Column width" className="grid grid-cols-3 gap-1">
              {MEASURES.map((option, index) => (
                <Choice key={option.value} selected={typography.measure === option.value} onClick={() => change({ measure: option.value })} className="px-1">
                  {["Slim", "Classic", "Wide"][index]}
                </Choice>
              ))}
            </div>
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 text-xs font-semibold">
          Justified text
          <Switch checked={typography.justify} onCheckedChange={(justify) => change({ justify })} aria-label="Justified text" />
        </label>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <span role="status" className={cn("text-[11px]", status === "error" ? "text-destructive" : "text-muted-foreground")}>
            {status === "saved" ? "Saved for every book." : status === "error" ? "Couldn't save. Try again." : "Applies to this book now."}
          </span>
          <Button size="sm" variant="outline" onClick={save} disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Save as default"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
