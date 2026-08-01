import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { useAuth } from "@/lib/auth";

export function AppShell({ children, withSidebar = true }: { children: ReactNode; withSidebar?: boolean }) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto flex max-w-7xl gap-6 px-3 py-4 pb-24 sm:px-4 sm:py-6 lg:pb-6">
        {withSidebar && <Sidebar />}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      {user && <MobileNav />}
    </div>
  );
}
