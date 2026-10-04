export function StatTile({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-3xl">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
    </div>
  );
}
