import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/search")({
  component: SearchPage,
});

function SearchPage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("nav.search")} className="h-12 pl-11" />
        </div>
        <p className="px-1 text-sm text-muted-foreground">
          Busque por criadoras, hashtags, posts...
        </p>
      </div>
    </AppShell>
  );
}
