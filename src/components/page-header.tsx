import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="space-y-2.5">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-heading text-3xl leading-tight tracking-[-0.035em] sm:text-[40px]">{title}</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
