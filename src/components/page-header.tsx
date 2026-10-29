import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action }: {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl space-y-2">
        <p className="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1">{eyebrow}</p>
        <h1 className="font-heading text-[28px] leading-9 font-normal tracking-[-0.015em] sm:text-[40px] sm:leading-[48px]">{title}</h1>
        {description && <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
