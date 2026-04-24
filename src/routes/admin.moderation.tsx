import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ShieldAlert,
  Download,
  Search,
  Filter,
  Check,
  X,
  Loader2,
  ExternalLink,
  ShieldCheck,
  ShieldX,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileDown,
  Filter as FilterIcon,
  ArrowLeft,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  decision_note?: string;
  trust: "trusted" | "suspicious" | "neutral";
  user_total: number;
  user_csam: number;
}

const DECISION_KEY = "venyx.moderation.decisions.v2";
const PAGE_SIZE = 25;

type DecisionEntry = { decision: "approved" | "rejected"; at: string; by: string; note: string };
type DecisionMap = Record<string, DecisionEntry>;

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

interface PendingDecision {
  id: string;
  decision: "approved" | "rejected";
}

function AdminModerationPage() {
  const { user, loading, isAdmin } = useAuth();
  const nav = useNavigate();
  const [logs, setLogs] = useState<ModLog[]>([]);
  const [busy, setBusy] = useState(true);
  const [query, setQuery] = useState("");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [surfaceFilter, setSurfaceFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [decisionFilter, setDecisionFilter] = useState<string>("all");
  const [trustFilter, setTrustFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sizeMin, setSizeMin] = useState<string>("");
  const [sizeMax, setSizeMax] = useState<string>("");
  const [decisions, setDecisions] = useState<DecisionMap>(loadDecisions);
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionStage, setDecisionStage] = useState<"edit" | "review">("edit");
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/login" });
      return;
    }
    if (!isAdmin) nav({ to: "/feed" });
  }, [user, loading, isAdmin, nav]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setBusy(true);
      const { data, error } = await supabase
        .from("moderation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
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
        userMap = new Map(
          ((profs ?? []) as { user_id: string; username: string }[]).map((p) => [p.user_id, p.username]),
        );
      }
      setLogs(rows.map((r) => ({ ...r, username: userMap.get(r.user_id) })));
      setBusy(false);
    })();
  }, [isAdmin]);

  // reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [query, usernameFilter, surfaceFilter, categoryFilter, decisionFilter, trustFilter, dateFrom, dateTo, sizeMin, sizeMax]);

  const openDecision = (id: string, decision: "approved" | "rejected") => {
    setPendingDecision({ id, decision });
    setDecisionNote("");
  };

  const confirmDecision = () => {
    if (!user || !pendingDecision) return;
    if (decisionNote.trim().length < 5) {
      toast.error("Descreva o motivo (mínimo 5 caracteres) para manter auditoria.");
      return;
    }
    const next: DecisionMap = {
      ...decisions,
      [pendingDecision.id]: {
        decision: pendingDecision.decision,
        at: new Date().toISOString(),
        by: user.id,
        note: decisionNote.trim(),
      },
    };
    setDecisions(next);
    saveDecisions(next);
    toast.success(pendingDecision.decision === "approved" ? "Reupload aprovado" : "Reupload rejeitado");
    setPendingDecision(null);
    setDecisionNote("");
  };

  const undo = (id: string) => {
    const next = { ...decisions };
    delete next[id];
    setDecisions(next);
    saveDecisions(next);
  };

  // Estatísticas por usuário p/ definir confiança
  const userStats = useMemo(() => {
    const m = new Map<string, { total: number; csam: number }>();
    for (const l of logs) {
      const cur = m.get(l.user_id) ?? { total: 0, csam: 0 };
      cur.total += 1;
      if (l.category === "csam") cur.csam += 1;
      m.set(l.user_id, cur);
    }
    return m;
  }, [logs]);

  const enriched = useMemo<EnrichedLog[]>(() => {
    return logs.map((l) => {
      const d = decisions[l.id];
      const stats = userStats.get(l.user_id) ?? { total: 0, csam: 0 };
      let trust: EnrichedLog["trust"] = "neutral";
      if (stats.csam > 0 || stats.total >= 5) trust = "suspicious";
      else if (stats.total === 1 && l.category !== "csam") trust = "trusted";
      return {
        ...l,
        decision: (d?.decision ?? "pending") as Decision,
        decision_at: d?.at,
        decided_by: d?.by,
        decision_note: d?.note,
        trust,
        user_total: stats.total,
        user_csam: stats.csam,
      };
    });
  }, [logs, decisions, userStats]);

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 3600 * 1000 : null;
    const minB = sizeMin ? parseInt(sizeMin, 10) * 1024 : null;
    const maxB = sizeMax ? parseInt(sizeMax, 10) * 1024 : null;
    const uname = usernameFilter.trim().toLowerCase();

    return enriched.filter((l) => {
      if (surfaceFilter !== "all" && l.surface !== surfaceFilter) return false;
      if (categoryFilter !== "all" && l.category !== categoryFilter) return false;
      if (decisionFilter !== "all" && l.decision !== decisionFilter) return false;
      if (trustFilter !== "all" && l.trust !== trustFilter) return false;
      if (uname && !(l.username ?? "").toLowerCase().includes(uname)) return false;
      const ts = new Date(l.created_at).getTime();
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;
      if (minB != null && (l.file_size_bytes ?? 0) < minB) return false;
      if (maxB != null && (l.file_size_bytes ?? Number.MAX_SAFE_INTEGER) > maxB) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${l.username ?? ""} ${l.user_id} ${l.reason ?? ""} ${l.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, surfaceFilter, categoryFilter, decisionFilter, trustFilter, usernameFilter, dateFrom, dateTo, sizeMin, sizeMax, query]);

  // Resumo agrupado por surface × categoria + top razões
  const summary = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {};
    const reasonCount = new Map<string, number>();
    for (const l of filtered) {
      matrix[l.surface] ??= {};
      matrix[l.surface][l.category] = (matrix[l.surface][l.category] ?? 0) + 1;
      if (l.reason) {
        const key = l.reason.length > 60 ? l.reason.slice(0, 60) + "…" : l.reason;
        reasonCount.set(key, (reasonCount.get(key) ?? 0) + 1);
      }
    }
    const topReasons = Array.from(reasonCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return { matrix, topReasons };
  }, [filtered]);

  // Paginação por cursor (índice)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const cursorStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const cursorEnd = Math.min(filtered.length, (safePage + 1) * PAGE_SIZE);

  const downloadCsv = () => {
    const header = [
      "id",
      "created_at",
      "user_id",
      "username",
      "surface",
      "category",
      "trust",
      "reason",
      "mime_type",
      "file_size_bytes",
      "decision",
      "decision_at",
      "decided_by",
      "decision_note",
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
          l.trust,
          l.reason ?? "",
          l.mime_type ?? "",
          l.file_size_bytes ?? "",
          l.decision ?? "pending",
          l.decision_at ?? "",
          l.decided_by ?? "",
          l.decision_note ?? "",
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

        {/* Resumo por surface × categoria + top motivos */}
        {filtered.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Resumo por surface × categoria</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-2">Surface</th>
                      <th className="py-1.5 pr-2">CSAM</th>
                      <th className="py-1.5 pr-2">Outras</th>
                      <th className="py-1.5">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(summary.matrix).map(([surface, cats]) => {
                      const csam = cats.csam ?? 0;
                      const other = cats.other ?? 0;
                      return (
                        <tr key={surface} className="border-t border-border/40">
                          <td className="py-1.5 pr-2 font-medium capitalize">{surface}</td>
                          <td className="py-1.5 pr-2 text-destructive">{csam}</td>
                          <td className="py-1.5 pr-2">{other}</td>
                          <td className="py-1.5 font-semibold">{csam + other}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Top motivos da IA</h2>
              {summary.topReasons.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum motivo registrado nos itens filtrados.</p>
              ) : (
                <ul className="space-y-1.5">
                  {summary.topReasons.map(([reason, count]) => (
                    <li key={reason} className="flex items-start justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">{reason}</span>
                      <Badge variant="secondary" className="shrink-0">{count}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Filtros principais */}
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
            <SelectTrigger className="h-9 w-full sm:w-32">
              <SelectValue placeholder="Surface" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Surfaces</SelectItem>
              <SelectItem value="post">Post</SelectItem>
              <SelectItem value="story">Story</SelectItem>
              <SelectItem value="chat">Chat</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-full sm:w-32">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Categorias</SelectItem>
              <SelectItem value="csam">CSAM</SelectItem>
              <SelectItem value="other">Outras</SelectItem>
            </SelectContent>
          </Select>
          <Select value={decisionFilter} onValueChange={setDecisionFilter}>
            <SelectTrigger className="h-9 w-full sm:w-32">
              <SelectValue placeholder="Decisão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Decisões</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="approved">Aprovados</SelectItem>
              <SelectItem value="rejected">Rejeitados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={trustFilter} onValueChange={setTrustFilter}>
            <SelectTrigger className="h-9 w-full sm:w-32">
              <SelectValue placeholder="Confiança" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Confiança</SelectItem>
              <SelectItem value="trusted">Confiável</SelectItem>
              <SelectItem value="neutral">Neutro</SelectItem>
              <SelectItem value="suspicious">Suspeito</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtros avançados */}
        <div className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">Username</label>
            <Input
              placeholder="@criadora"
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              <Calendar className="h-3 w-3" /> De
            </label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              <Calendar className="h-3 w-3" /> Até
            </label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">Min (KB)</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={sizeMin}
                onChange={(e) => setSizeMin(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">Max (KB)</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="∞"
                value={sizeMax}
                onChange={(e) => setSizeMax(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
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
          <>
            <ul className="space-y-3">
              {pageItems.map((l) => (
                <li key={l.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={l.category === "csam" ? "destructive" : "secondary"}>
                          {l.category.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">{l.surface}</Badge>
                        <TrustBadge trust={l.trust} total={l.user_total} csam={l.user_csam} />
                        {l.mime_type && <span className="text-[11px] text-muted-foreground">{l.mime_type}</span>}
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
                      {l.decision_note && (
                        <div className="rounded-md border border-border bg-background/30 px-2 py-1 text-xs">
                          <span className="text-muted-foreground">Nota da decisão: </span>
                          <span className="text-foreground">{l.decision_note}</span>
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
                            onClick={() => openDecision(l.id, "approved")}
                            className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                            disabled={l.category === "csam"}
                            title={l.category === "csam" ? "CSAM não pode ser aprovado" : "Aprovar reupload"}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDecision(l.id, "rejected")}
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

            {/* Paginação */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              <span>
                Exibindo <strong className="text-foreground">{cursorStart}</strong>–
                <strong className="text-foreground">{cursorEnd}</strong> de{" "}
                <strong className="text-foreground">{filtered.length}</strong>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Anterior
                </Button>
                <span>
                  Página {safePage + 1} / {pageCount}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage >= pageCount - 1}
                >
                  Próxima <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Confirmação com motivo da decisão */}
      <AlertDialog
        open={pendingDecision !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDecision(null);
            setDecisionNote("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDecision?.decision === "approved" ? "Aprovar reupload?" : "Rejeitar reupload?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Descreva o motivo da decisão. Esta nota fica registrada no histórico de auditoria e aparece no CSV exportado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            placeholder="Ex.: falso positivo da IA, mídia já moderada manualmente, criadora confirmou contexto…"
            rows={4}
            className="resize-none"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDecision}>
              Confirmar {pendingDecision?.decision === "approved" ? "aprovação" : "rejeição"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  if (decision === "approved")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400">
        Aprovado
      </Badge>
    );
  if (decision === "rejected")
    return <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20">Rejeitado</Badge>;
  return <Badge variant="outline">Pendente</Badge>;
}

function TrustBadge({ trust, total, csam }: { trust: "trusted" | "suspicious" | "neutral"; total: number; csam: number }) {
  const title = `Usuário tem ${total} bloqueio(s) — ${csam} CSAM`;
  if (trust === "suspicious")
    return (
      <Badge className="gap-1 bg-destructive/15 text-destructive hover:bg-destructive/20" title={title}>
        <ShieldX className="h-3 w-3" /> Suspeito
      </Badge>
    );
  if (trust === "trusted")
    return (
      <Badge
        className="gap-1 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
        title={title}
      >
        <ShieldCheck className="h-3 w-3" /> Confiável
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1" title={title}>
      <ShieldAlert className="h-3 w-3" /> Neutro
    </Badge>
  );
}
