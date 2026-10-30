import type { ReactNode } from "react";

export function SettingsSection({ id, index, title, description, children }: { id: string; index: string; title: string; description: string; children: ReactNode }) {
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
