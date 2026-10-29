import { AppShell } from "@/components/shell/app-shell";

export default function ReaderLayout({ children }: { children: React.ReactNode }) {
  return <AppShell fill>{children}</AppShell>;
}
