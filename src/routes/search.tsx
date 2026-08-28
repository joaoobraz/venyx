import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { CreatorCard, type CreatorSummary } from "@/components/CreatorCard";
import { searchCreators } from "@/_server/discovery.functions";
import { useI18n } from "@/lib/i18n";
import { DEMO_CREATORS, DEMO_MODE } from "@/lib/demo-creators";

export type SearchRouteSearch = { q?: string };

export const searchRouteSearchValidator = (s: Record<string, unknown>): SearchRouteSearch => ({
  q: typeof s.q === "string" ? s.q : undefined,
});

export const Route = createFileRoute("/search")({
  validateSearch: searchRouteSearchValidator,
  component: SearchPage,
});

export function SearchPage() {
  const { tr } = useI18n();
  const initial = (useSearch({ strict: false }) as SearchRouteSearch).q ?? "";
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<CreatorSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const run = useServerFn(searchCreators);
  const reqId = useRef(0);

  useEffect(() => {
    const term = query.trim();
    const id = ++reqId.current;
    if (DEMO_MODE) {
      const normalized = term.toLocaleLowerCase();
      const creators = DEMO_CREATORS.filter((creator) =>
        [creator.display_name, creator.username, creator.category, creator.category_en]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalized),
      );
      setResults(creators);
      setSearched(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await run({
          data: { query: term, sort: term ? "top" : "new", limit: 30 },
        });
        if (id === reqId.current) {
          setResults(res.creators);
          setSearched(true);
        }
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, run]);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr(
              "Busque por criadoras (nome ou @usuário)...",
              "Search creators by name or @username...",
            )}
            className="h-12 pl-11 pr-11"
          />
        </div>

        {results.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {results.map((c) => (
              <CreatorCard key={c.user_id} c={c} visitSource="venyx_search" />
            ))}
          </div>
        ) : (
          <p className="px-1 text-sm text-muted-foreground">
            {loading
              ? tr("Buscando...", "Searching...")
              : searched && query.trim()
                ? tr(
                    `Nenhuma criadora encontrada para "${query.trim()}".`,
                    `No creators found for "${query.trim()}".`,
                  )
                : tr(
                    "Comece a digitar para encontrar criadoras.",
                    "Start typing to find creators.",
                  )}
          </p>
        )}
      </div>
    </AppShell>
  );
}
