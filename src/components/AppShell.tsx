import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children, withSidebar = true }: { children: ReactNode; withSidebar?: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        {withSidebar && <Sidebar />}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
