"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Coffee, Hourglass, Minus, Monitor, Moon, Plus, RotateCcw, Save, Sun, Target, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AUTO_PAUSE_OPTIONS,
  BREAK_OPTIONS,
  CHIME_OPTIONS,
  FOCUS_OPTIONS,
  DEFAULT_PREFERENCES,
  FONT_SIZE_RANGE,
  LINE_HEIGHTS,
  MEASURES,
  PAPERS,
  READER_FONTS,
  type Paper,
  type Preferences,
  type ReaderFont,
} from "@/lib/preferences";
import { applyThemeChoice, readThemeChoice, type ThemeChoice } from "@/lib/theme";
import { playChime } from "@/lib/chime";
import { cn } from "@/lib/utils";

// CSS variables from next/font: Newsreader and Jakarta are app-wide; the
// settings page adds Garamond and Literata (lib/reader-fonts.ts).
const FONT_VARS: Record<ReaderFont, string> = {
  newsreader: "var(--font-newsreader)",
  garamond: "var(--font-garamond)",
  literata: "var(--font-literata)",
  jakarta: "var(--font-jakarta)",
};

function Section({ id, index, title, description, children }: { id: string; index: string; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="surface space-y-5 p-5 sm:p-6">
      <div>
        <p className="eyebrow">Section {index}</p>
        <h2 id={id} className="mt-1 font-heading text-xl leading-7 font-semibold">{title}</h2>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg border border-border bg-secondary p-1">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
            value === option.value ? "border border-primary/30 bg-primary text-primary-foreground shadow-sm" : "border border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
          {option.hint && <span className="block text-[10px] font-normal opacity-80">{option.hint}</span>}
        </button>
      ))}
    </div>
  );
}

function Stepper({ label, value, unit, step, min, max, onChange }: {
  label: string;
  value: number | null;
  unit: string;
  step: number;
  min: number;
  max: number;
  onChange: (value: number | null) => void;
}) {
  const current = value ?? 0;
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="icon" aria-label={`Decrease ${label}`} disabled={current <= 0} onClick={() => onChange(current - step < min ? null : current - step)}><Minus /></Button>
      <output aria-label={label} className="flex h-10 min-w-28 flex-1 flex-col items-center justify-center rounded-lg border border-border bg-background dark:bg-secondary">
        <span className="font-heading text-lg leading-5 font-semibold tabular-nums">{value ? `${value} ${unit}` : "Off"}</span>
      </output>
      <Button type="button" variant="outline" size="icon" aria-label={`Increase ${label}`} disabled={current >= max} onClick={() => onChange(Math.min(max, Math.max(min, current + step)))}><Plus /></Button>
    </div>
  );
}

export function SettingsForm({ initial, profile }: {
  initial: Preferences;
  profile: ReactNode;
}) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [theme, setTheme] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    // localStorage is only readable after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readThemeChoice());
  }, []);

  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);
  const reader = prefs.reader;
  const setReader = (patch: Partial<Preferences["reader"]>) => setPrefs((value) => ({ ...value, reader: { ...value.reader, ...patch } }));
  const setGoals = (patch: Partial<Preferences["goals"]>) => setPrefs((value) => ({ ...value, goals: { ...value.goals, ...patch } }));
  const setTimer = (patch: Partial<Preferences["timer"]>) => setPrefs((value) => ({ ...value, timer: { ...value.timer, ...patch } }));

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });
      if (!response.ok) throw new Error();
      setMessage({ tone: "ok", text: "Settings saved." });
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Settings couldn't be saved. If this keeps happening, re-run supabase/schema.sql to add the preferences table." });
    } finally {
      setSaving(false);
    }
  }

  function chooseTheme(choice: ThemeChoice) {
    setTheme(choice);
    applyThemeChoice(choice);
  }

  const paper = PAPERS[reader.paper];

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8 xl:-mx-12 xl:px-12">
        <p role="status" className={cn("text-xs", message?.tone === "error" ? "text-destructive" : "text-muted-foreground")}>
          {message?.text ?? (dirty ? "You have unsaved changes." : "Changes apply to your account on every device.")}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPrefs(DEFAULT_PREFERENCES)} disabled={saving}><RotateCcw /> Reset to defaults</Button>
          <Button onClick={save} disabled={saving || !dirty}><Save /> {saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Section id="typography" index="01" title="Reading experience & typography" description="How EPUB books are typeset in the reader. PDFs keep their original layout.">
            <div>
              <p className="meta mb-2">Typeface</p>
              <div role="radiogroup" aria-label="Typeface" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {(Object.keys(READER_FONTS) as ReaderFont[]).map((font) => {
                  const selected = reader.font === font;
                  return (
                    <button
                      key={font}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setReader({ font })}
                      className={cn(
                        "relative rounded-lg border p-3 text-left transition-colors",
                        selected ? "border-sage bg-accent/60 ring-1 ring-sage/40" : "border-border bg-background hover:border-sage/40 dark:bg-secondary"
                      )}
                    >
                      {selected && <Check className="absolute top-2 right-2 size-3.5 text-sage" aria-hidden="true" />}
                      <span className="text-[10px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{READER_FONTS[font].note}</span>
                      <span className="mt-1 block text-2xl leading-8" style={{ fontFamily: FONT_VARS[font] }}>Aa</span>
                      <span className="block truncate text-sm font-semibold" style={{ fontFamily: FONT_VARS[font] }}>{READER_FONTS[font].label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="font-size" className="meta mb-2 flex items-center justify-between">
                  <span>Font size</span>
                  <span className="rounded-sm bg-accent px-1.5 py-0.5 font-semibold text-sage">{reader.fontSize}px</span>
                </label>
                <div className="flex items-center gap-3">
                  <span className="meta">{FONT_SIZE_RANGE.min}</span>
                  <input id="font-size" type="range" min={FONT_SIZE_RANGE.min} max={FONT_SIZE_RANGE.max} step={1} value={reader.fontSize} onChange={(event) => setReader({ fontSize: Number(event.target.value) })} className="h-1.5 flex-1 cursor-pointer accent-[var(--primary)]" />
                  <span className="meta">{FONT_SIZE_RANGE.max}</span>
                </div>
              </div>
              <div>
                <p className="meta mb-2">Line spacing</p>
                <Segmented label="Line spacing" value={reader.lineHeight} options={LINE_HEIGHTS.map((option) => ({ value: option.value, label: option.label, hint: `${option.value}×` }))} onChange={(lineHeight) => setReader({ lineHeight })} />
              </div>
              <div>
                <p className="meta mb-2">Column width</p>
                <Segmented label="Column width" value={reader.measure} options={MEASURES.map((option) => ({ value: option.value, label: option.label, hint: `${option.value}ch` }))} onChange={(measure) => setReader({ measure })} />
              </div>
              <div>
                <p className="meta mb-2">Page colour</p>
                <div role="radiogroup" aria-label="Page colour" className="flex flex-wrap gap-2">
                  {(Object.keys(PAPERS) as Paper[]).map((key) => {
                    const option = PAPERS[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={reader.paper === key}
                        onClick={() => setReader({ paper: key })}
                        className={cn("flex flex-col items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-colors", reader.paper === key ? "border-sage ring-1 ring-sage/40" : "border-border hover:border-sage/40")}
                      >
                        <span
                          className="size-6 rounded-full border border-border"
                          style={option.background ? { background: option.background } : { background: "linear-gradient(135deg, #fdfbf7 50%, #121614 50%)" }}
                          aria-hidden="true"
                        />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <label className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-3 dark:bg-secondary">
              <span>
                <span className="block text-sm font-semibold">Justified text</span>
                <span className="block text-xs text-muted-foreground">Align both edges of each line, like a printed book.</span>
              </span>
              <Switch checked={reader.justify} onCheckedChange={(justify) => setReader({ justify })} aria-label="Justified text" />
            </label>
          </Section>

          <Section id="appearance" index="02" title="Appearance" description="Light or dark for the whole app. Saved on this device.">
            <Segmented<ThemeChoice>
              label="Theme"
              value={theme ?? "system"}
              options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "Match device" }]}
              onChange={chooseTheme}
            />
            <p className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Sun className="size-3.5" aria-hidden="true" /> Editorial sanctuary</span>
              <span className="flex items-center gap-1.5"><Moon className="size-3.5" aria-hidden="true" /> Obsidian sanctuary</span>
              <span className="flex items-center gap-1.5"><Monitor className="size-3.5" aria-hidden="true" /> Follows your device</span>
            </p>
          </Section>

          <Section id="timer" index="03" title="Timer & focus" description="How the session clock behaves while you read.">
            <div className="rounded-lg border border-border bg-background p-4 dark:bg-secondary/50">
              <p className="flex items-center gap-2 text-sm font-semibold"><Hourglass className="size-4 text-sage" aria-hidden="true" /> Automatic pause</p>
              <p className="mt-1 mb-3 text-xs text-muted-foreground">Pause the clock when you haven&apos;t turned a page for a while. The next page turn resumes it.</p>
              <Segmented
                label="Automatic pause"
                value={prefs.timer.autoPauseMinutes ?? 0}
                options={[{ value: 0, label: "Off" }, ...AUTO_PAUSE_OPTIONS.map((minutes) => ({ value: minutes, label: `${minutes} min` }))]}
                onChange={(minutes) => setTimer({ autoPauseMinutes: minutes || null })}
              />
            </div>
            <div className="rounded-lg border border-border bg-background p-4 dark:bg-secondary/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold"><Bell className="size-4 text-amber" aria-hidden="true" /> Interval chime</p>
                  <p className="mt-1 mb-3 text-xs text-muted-foreground">A soft bell each time you&apos;ve read for this long. Paused time doesn&apos;t count.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => playChime()}>Preview</Button>
              </div>
              <Segmented
                label="Interval chime"
                value={prefs.timer.chimeMinutes ?? 0}
                options={[{ value: 0, label: "Off" }, ...CHIME_OPTIONS.map((minutes) => ({ value: minutes, label: `${minutes} min` }))]}
                onChange={(minutes) => setTimer({ chimeMinutes: minutes || null })}
              />
            </div>
            <div className="space-y-3 rounded-lg border border-border bg-background p-4 dark:bg-secondary/50">
              <label className="flex items-start justify-between gap-4">
                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold"><Coffee className="size-4 text-sage" aria-hidden="true" /> Pomodoro focus cycles</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Read in focused blocks with short breaks. A chime marks each change; breaks don&apos;t count as reading time.</span>
                </span>
                <Switch checked={prefs.timer.pomodoro} onCheckedChange={(pomodoro) => setTimer({ pomodoro })} aria-label="Pomodoro focus cycles" />
              </label>
              {prefs.timer.pomodoro && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="meta mb-2">Focus</p>
                    <Segmented label="Focus length" value={prefs.timer.focusMinutes} options={FOCUS_OPTIONS.map((minutes) => ({ value: minutes, label: `${minutes}m` }))} onChange={(focusMinutes) => setTimer({ focusMinutes })} />
                  </div>
                  <div>
                    <p className="meta mb-2">Break</p>
                    <Segmented label="Break length" value={prefs.timer.breakMinutes} options={BREAK_OPTIONS.map((minutes) => ({ value: minutes, label: `${minutes}m` }))} onChange={(breakMinutes) => setTimer({ breakMinutes })} />
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Section id="goals" index="04" title="Reading goals" description="Targets shown in the reader and on your statistics. Set to Off to hide them.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-border bg-background p-4 dark:bg-secondary/50">
                <p className="flex items-center gap-2 text-sm font-semibold"><Target className="size-4 text-amber" aria-hidden="true" /> Daily reading target</p>
                <p className="text-xs text-muted-foreground">Most readers aim for 20–60 minutes.</p>
                <Stepper label="daily reading target" value={prefs.goals.dailyMinutes} unit="min" step={5} min={5} max={600} onChange={(dailyMinutes) => setGoals({ dailyMinutes })} />
              </div>
              <div className="space-y-2 rounded-lg border border-border bg-background p-4 dark:bg-secondary/50">
                <p className="flex items-center gap-2 text-sm font-semibold"><Type className="size-4 text-sage" aria-hidden="true" /> Books this year</p>
                <p className="text-xs text-muted-foreground">Counted when you mark a book finished.</p>
                <Stepper label="yearly book target" value={prefs.goals.yearlyBooks} unit={prefs.goals.yearlyBooks === 1 ? "book" : "books"} step={1} min={1} max={500} onChange={(yearlyBooks) => setGoals({ yearlyBooks })} />
              </div>
            </div>
          </Section>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          <section aria-labelledby="preview-heading" className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 id="preview-heading" className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Live preview</h2>
              <span className="meta">{reader.fontSize}px · {reader.lineHeight}×</span>
            </div>
            <div
              className={cn("px-5 py-6", !paper.background && "bg-background")}
              style={paper.background ? { background: paper.background, color: paper.color ?? undefined } : undefined}
            >
              <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] uppercase opacity-60">Chapter one</p>
              <p
                style={{
                  fontFamily: FONT_VARS[reader.font],
                  fontSize: reader.fontSize,
                  lineHeight: reader.lineHeight,
                  textAlign: reader.justify ? "justify" : "left",
                  hyphens: reader.justify ? "auto" : "manual",
                  maxWidth: `${reader.measure}ch`,
                }}
              >
                There is a quiet kind of attention that only a book can ask of us. The noise of the day recedes, and for a while there is only the page, the next sentence, and the slow work of thinking.
              </p>
            </div>
          </section>
          {profile}
        </aside>
      </div>
    </div>
  );
}
