"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FolderOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { journalHref, UNGROUPED, type JournalGroup, type JournalTab } from "@/lib/journal";
import { GROUP_NAME_MAX } from "@/lib/journal-groups";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:border-sage/60 focus-visible:ring-3 focus-visible:ring-primary/15 dark:bg-secondary";

// The journal's groups: pick one to filter by, or create, rename and delete
// them. Deleting a group keeps its entries; they become ungrouped.
export function JournalGroups({ groups, counts, total, active, query, tab, tag }: {
  groups: JournalGroup[];
  counts: Record<string, number>;
  total: number;
  active: string | undefined;
  query: string;
  tab: JournalTab;
  tag?: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error();
      return (await response.json()) as { group?: JournalGroup };
    } catch {
      setError("That didn't work. Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    const name = newName.trim();
    if (!name || busy) return;
    const result = await request("/api/journal-groups", "POST", { name });
    if (!result?.group) return;
    setNewName("");
    setCreating(false);
    router.push(journalHref({ tab, q: query, tag, group: result.group.id }));
    router.refresh();
  }

  async function rename(id: string) {
    const name = editName.trim();
    if (!name || busy) return;
    if (await request(`/api/journal-groups/${id}`, "PATCH", { name })) {
      setEditingId(null);
      router.refresh();
    }
  }

  async function remove(group: JournalGroup) {
    if (busy) return;
    if (!window.confirm(`Delete the group “${group.name}”? Its entries stay in your journal, ungrouped.`)) return;
    if (await request(`/api/journal-groups/${group.id}`, "DELETE")) {
      if (active === group.id) router.push(journalHref({ tab, q: query, tag }));
      router.refresh();
    }
  }

  const rows: { key: string | undefined; name: string; count: number; group?: JournalGroup }[] = [
    { key: undefined, name: "All entries", count: total },
    ...groups.map((group) => ({ key: group.id, name: group.name, count: counts[group.id] ?? 0, group })),
    { key: UNGROUPED, name: "Ungrouped", count: counts[UNGROUPED] ?? 0 },
  ];

  return (
    <section aria-labelledby="groups-heading" className="surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="groups-heading" className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          <FolderOpen className="size-3.5" aria-hidden="true" /> Groups
        </h2>
        {!creating && (
          <Button variant="ghost" size="xs" onClick={() => setCreating(true)} disabled={busy}>
            <Plus /> New group
          </Button>
        )}
      </div>

      {creating && (
        <form
          className="mb-3 flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <label htmlFor="new-group-name" className="sr-only">New group name</label>
          <input
            id="new-group-name"
            autoFocus
            value={newName}
            maxLength={GROUP_NAME_MAX}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setCreating(false)}
            placeholder="e.g. Dream log"
            disabled={busy}
            className={fieldClass}
          />
          <Button type="submit" size="icon-sm" aria-label="Create group" disabled={busy || !newName.trim()}><Check /></Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancel" onClick={() => { setCreating(false); setNewName(""); }}><X /></Button>
        </form>
      )}

      <ul className="space-y-1">
        {rows.map((row) => {
          const isActive = active === row.key;
          if (row.group && editingId === row.group.id) {
            const id = row.group.id;
            return (
              <li key={id}>
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    rename(id);
                  }}
                >
                  <label htmlFor={`rename-${id}`} className="sr-only">Rename {row.name}</label>
                  <input
                    id={`rename-${id}`}
                    autoFocus
                    value={editName}
                    maxLength={GROUP_NAME_MAX}
                    onChange={(event) => setEditName(event.target.value)}
                    onKeyDown={(event) => event.key === "Escape" && setEditingId(null)}
                    disabled={busy}
                    className={fieldClass}
                  />
                  <Button type="submit" size="icon-sm" aria-label="Save name" disabled={busy || !editName.trim()}><Check /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancel" onClick={() => setEditingId(null)}><X /></Button>
                </form>
              </li>
            );
          }
          return (
            <li key={row.key ?? "all"} className="group/row flex items-center gap-1">
              <Link
                href={journalHref({ tab, q: query, tag, group: row.key })}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                  isActive ? "border-primary/30 bg-primary text-primary-foreground" : "border-transparent hover:bg-secondary",
                  !row.group && row.key && "text-muted-foreground italic"
                )}
              >
                <span className="truncate">{row.name}</span>
                <span className={cn("rounded-sm px-1.5 py-px text-[10px] font-semibold tabular-nums", isActive ? "bg-black/15" : "bg-secondary")}>{row.count}</span>
              </Link>
              {row.group && (
                <span className="flex shrink-0 opacity-100 transition-opacity lg:opacity-0 lg:group-focus-within/row:opacity-100 lg:group-hover/row:opacity-100">
                  <Button variant="ghost" size="icon-xs" aria-label={`Rename ${row.name}`} disabled={busy} onClick={() => { setEditingId(row.group!.id); setEditName(row.name); }} className="text-muted-foreground"><Pencil /></Button>
                  <Button variant="ghost" size="icon-xs" aria-label={`Delete ${row.name}`} disabled={busy} onClick={() => remove(row.group!)} className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {groups.length === 0 && !creating && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Create groups to keep related entries together.</p>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </section>
  );
}
