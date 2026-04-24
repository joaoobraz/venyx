import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, Download, Search, Filter, Check, X, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/moderation")({
  component: AdminModerationPage,
});

type Decision = "pending" | "approved" | "rejected";

interface ModLog {
  id: string;
  user_id: string;
  surface: string;
  category: string;
  reason: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  ai_response: unknown;
  created_at: string;
  username?: string;
}

interface EnrichedLog extends ModLog {
  decision: Decision;
  decision_at?: string;
  decided_by?: string;
}

const DECISION_KEY = "venyx.moderation.decisions.v1";

type DecisionMap = Record<string, { decision: "approved" | "rejected"; at: string; by: string }>;

function loadDecisions(): DecisionMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DECISION_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveDecisions(map: DecisionMap) {
  localStorage.setItem(DECISION_KEY, JSON.stringify(map));
}

function AdminModerationPage() {
  const { user, loading, isAdmin } = useAuth();
  const nav = useNavigate();
  const [logs, setLogs] = useState<ModLog[]>([]);
  const [busy, setBusy] = useState(true);
  const [query, setQuery] = useState("");
  const [surfaceFilter, setSurfaceFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [decisionFilter, setDecisionFilter] = useState<string>("all");
  const [decisions, setDecisions] = useState<DecisionMap>(loadDecisions);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/login" });
      return;
    }
    if (!isAdmin) {
      nav({ to: "/feed" });
    }
  }, [user, loading, isAdmin, nav]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setBusy(true);
      const { data, error } = await supabase
        .from("moderation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      const rows = (data ?? []) as ModLog[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      let userMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, username")
          .in("user_id", ids);
        userMap = new Map(((profs ?? []) as { user_id: string; username: string }[]).map((p) => [p.user_id, p.username]));
      }
      setLogs(rows.map((r) => ({ ...r, username: userMap.get(r.user_id) })));
      setBusy(false);
    })();
  }, [isAdmin]);

  const decide = (id: string, decision: "approved" | "rejected") => {
    if (!user) return;
    const next: DecisionMap = {
      ...decisions,
      [id]: { decision, at: new Date().toISOString(), by: user.id },
    };
    setDecisions(next);
    saveDecisions(next);
    toast.success(decision === "approved" ? "Reupload aprovado" : "Reupload rejeitado");
  };

  const undo = (id: string) => {
    const next = { ...decisions };
    delete next[id];
    setDecisions(next);
    saveDecisions(next);
  };

  const enriched = useMemo<EnrichedLog[]>(
    () =>
      logs.map((l) => {
        const d = decisions[l.id];
        return {
          ...l,
          decision: (d?.decision ?? "pending") as Decision,
          decision_at: d?.at,
          decided_by: d?.by,
        };
      }),
    [logs, decisions],
  );

  const filtered = useMemo(() => {
    return enriched.filter((l) => {
      if (surfaceFilter !== "all" && l.surface !== surfaceFilter) return false;
      if (categoryFilter !== "all" && l.category !== categoryFilter) return false;
      if (decisionFilter !== "all" && l.decision !== decisionFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${l.username ?? ""} ${l.user_id} ${l.reason ?? ""} ${l.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, surfaceFilter, categoryFilter, decisionFilter, query]);

  const downloadCsv = () => {
    const header = [
      "id",
      "created_at",
      "user_id",
      "username",
      "surface",
      "category",
      "reason",
      "mime_type",
      "file_size_bytes",
      "decision",
      "decision_at",
      "decided_by",
    ];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    for (const l of filtered) {
      lines.push(
        [
          l.id,
          l.created_at,
          l.user_id,
          l.username ?? "",
          l.surface,
          l.category,
          l.reason ?? "",
          l.mime_type ?? "",
          l.file_size_bytes ?? "",
          l.decision ?? "pending",
          l.decision_at ?? "",
          l.decided_by ?? "",
        ]
          .map(escape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moderation-decisions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !isAdmin) return null;

  const total = filtered.length;
  const pending = filtered.filter((l) => l.decision === "pending").length;
  const approved = filtered.filter((l) => l.decision === "approved").length;
  const rejected = filtered.filter((l) => l.decision === "rejected").length;

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Moderação · Logs</h1>
              <p className="text-sm text-muted-foreground">
                Mídias bloqueadas pela IA. Decida sobre eventuais reuploads e exporte o histórico.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={downloadCsv} disabled={!filtered.length}>
            <Download className="mr-2 h-4 w-4" /> Baixar CSV ({filtered.length})
          </Button>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total" value={total} />
          <StatCard label="Pendentes" value={pending} tone="warning" />
          <StatCard label="Aprovados" value={approved} tone="success" />
          <StatCard label="Rejeitados" value={rejected} tone="danger" />
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuário, motivo ou categoria…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <Filter className="hidden h-4 w-4 text-muted-foreground sm:block" />
          <Select value={surfaceFilter} onValueChange={setSurfaceFilter}>
            <SelectTrigger className="h-9 w-full sm:w-36">
              <SelectValue placeholder="Surface" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas surfaces</SelectItem>
              <SelectItem value="post">Post</SelectItem>
              <SelectItem value="story">Story</SelectItem>
              <SelectItem value="chat">Chat</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-full sm:w-36">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              <SelectItem value="csam">CSAM</SelectItem>
              <SelectItem value="other">Outras</SelectItem>
            </SelectContent>
          </Select>
          <Select value={decisionFilter} onValueChange={setDecisionFilter}>
            <SelectTrigger className="h-9 w-full sm:w-36">
              <SelectValue placeholder="Decisão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas decisões</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="approved">Aprovados</SelectItem>
              <SelectItem value="rejected">Rejeitados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {busy ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando logs…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            Nenhum log corresponde aos filtros.
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((l) => (
              <li key={l.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={l.category === "csam" ? "destructive" : "secondary"}>
                        {l.category.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">{l.surface}</Badge>
                      {l.mime_type && (
                        <span className="text-[11px] text-muted-foreground">{l.mime_type}</span>
                      )}
                      {l.file_size_bytes != null && (
                        <span className="text-[11px] text-muted-foreground">
                          {(l.file_size_bytes / 1024).toFixed(1)} KB
                        </span>
                      )}
                      <DecisionBadge decision={l.decision ?? "pending"} />
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {l.username ? (
                        <Link
                          to="/profile/$username"
                          params={{ username: l.username }}
                          className="inline-flex items-center gap-1 hover:text-primary"
                        >
                          @{l.username}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">{l.user_id.slice(0, 8)}…</span>
                      )}
                    </div>
                    {l.reason && (
                      <div className="rounded-md bg-background/40 px-2 py-1 text-xs text-muted-foreground">
                        Motivo da IA: <span className="text-foreground">{l.reason}</span>
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                      {l.decision_at && l.decision !== "pending" && (
                        <> · Decidido em {new Date(l.decision_at).toLocaleString("pt-BR")}</>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {l.decision === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decide(l.id, "approved")}
                          className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                          disabled={l.category === "csam"}
                          title={l.category === "csam" ? "CSAM não pode ser aprovado" : "Aprovar reupload"}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decide(l.id, "rejected")}
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        >
                          <X className="mr-1 h-3.5 w-3.5" /> Rejeitar
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => undo(l.id)}>
                        Desfazer
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "danger" }) {
  const toneCls =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${toneCls}`}>{value}</div>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: "pending" | "approved" | "rejected" }) {
  if (decision === "approved") return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400">Aprovado</Badge>;
  if (decision === "rejected") return <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20">Rejeitado</Badge>;
  return <Badge variant="outline">Pendente</Badge>;
}
